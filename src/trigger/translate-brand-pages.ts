import { schedules } from "@trigger.dev/sdk";
import { createHash } from "crypto";

const PAYLOAD_API_BASE = process.env.PAYLOAD_API_URL || 'https://payload-saleor-payload.vercel.app/api';
const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY || '';
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';

// Clean up standard URL to ensure it has /api
const getPayloadUrl = (endpoint: string) => {
    const base = PAYLOAD_API_BASE.endsWith('/') ? PAYLOAD_API_BASE.slice(0, -1) : PAYLOAD_API_BASE;
    const normalizedBase = base.toLowerCase().endsWith('/api') ? base : `${base}/api`;
    return `${normalizedBase}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
};

const SUPPORTED_LOCALES = ['nl', 'de', 'fr', 'it', 'es', 'pt', 'fi', 'et', 'lv', 'lt', 'sk', 'sl', 'el', 'hr', 'mt'];

interface BrandPage {
    id: string;
    vendorId: string;
    brandName: string;
    translationHash?: string;
    layout?: Array<{
        blockType: string;
        tagline?: string;
        heading?: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        [key: string]: any;
    }>;
}

/**
 * Generate a hash of the English content for change detection
 */
function generateContentHash(brandPage: BrandPage): string {
    const content = JSON.stringify({
        brandName: brandPage.brandName,
        layout: brandPage.layout?.map(block => ({
            blockType: block.blockType,
            tagline: block.tagline,
            heading: block.heading,
            story: block.story,
            foundingYear: block.foundingYear,
            logo: typeof block.logo === 'object' ? block.logo?.id : block.logo,
            coverImage: typeof block.coverImage === 'object' ? block.coverImage?.id : block.coverImage,
        })),
    });
    return createHash('md5').update(content).digest('hex');
}

/**
 * Translate text using Google AI
 */
async function translateText(text: string, targetLocale: string): Promise<string> {
    if (!GOOGLE_API_KEY) {
        console.warn('Missing GOOGLE_API_KEY');
        return text;
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GOOGLE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: `Translate the following text to ${targetLocale}. Only return the translated text, nothing else:\n\n${text}`,
                        }],
                    }],
                }),
            }
        );

        if (!response.ok) {
            console.error('Translation API error:', await response.text());
            return text;
        }

        const result = await response.json();
        return result.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || text;
    } catch (e) {
        console.error('Translation failed:', e);
        return text;
    }
}

/**
 * Translate a brand page to a specific locale
 */
async function translateBrandPage(brandPage: BrandPage, locale: string): Promise<void> {
    if (!brandPage.layout) return;

    const translatedLayout = [];

    for (const block of brandPage.layout) {
        // Remove id to avoid uniqueness constraint errors when saving locale versions
        const { id: _blockId, ...blockWithoutId } = block;
        const translatedBlock = { ...blockWithoutId };

        if (block.tagline) {
            translatedBlock.tagline = await translateText(block.tagline, locale);
        }
        if (block.heading) {
            translatedBlock.heading = await translateText(block.heading, locale);
        }
        if (block.story) {
            translatedBlock.story = await translateText(block.story, locale);
        }

        translatedLayout.push(translatedBlock);
    }

    // Update the brand page with translated content for this locale
    const url = `${getPayloadUrl(`brand-page/${brandPage.id}`)}?locale=${locale}`;
    const res = await fetch(url, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'x-payload-api-key': PAYLOAD_API_KEY,
        },
        body: JSON.stringify({
            brandName: await translateText(brandPage.brandName, locale),
            layout: translatedLayout,
        }),
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error(`Failed to save ${locale} translation for ${brandPage.brandName}:`, errorText);
        throw new Error(`PATCH failed for locale ${locale}: ${res.status}`);
    }
}

/**
 * Daily scheduled task to translate brand pages.
 * Only translates pages where the content hash has changed.
 */
export const translateBrandPagesTask = schedules.task({
    id: "translate-brand-pages-daily",
    cron: "0 0 * * *", // Once per day at midnight UTC
    run: async () => {
        console.log('Starting daily brand page translation...');

        // Fetch all brand pages (explicitly fetch English source at depth 0 for stable hashing)
        const url = `${getPayloadUrl('brand-page')}?locale=en&depth=0&limit=100`;
        const response = await fetch(url, {
            headers: {
                'x-payload-api-key': PAYLOAD_API_KEY,
            },
        });

        if (!response.ok) {
            console.error('Failed to fetch brand pages:', await response.text());
            return { translated: 0, skipped: 0, error: 'Failed to fetch pages' };
        }

        const { docs: brandPages } = await response.json() as { docs: BrandPage[] };
        
        let translated = 0;
        let skipped = 0;

        for (const brandPage of brandPages) {
            const currentHash = generateContentHash(brandPage);

            // Skip if content hasn't changed AND hash exists (new pages with no hash should be translated)
            if (brandPage.translationHash && brandPage.translationHash === currentHash) {
                console.log(`Skipping ${brandPage.brandName} - no changes`);
                skipped++;
                continue;
            }

            console.log(`Translating ${brandPage.brandName} to ${SUPPORTED_LOCALES.length} locales...`);

            // Translate to all supported locales
            for (const locale of SUPPORTED_LOCALES) {
                try {
                    await translateBrandPage(brandPage, locale);
                    console.log(`  Translated to ${locale}`);
                } catch (e) {
                    console.error(`  Failed to translate to ${locale}:`, e);
                }
            }

            // Update the translation hash on the main document
            await fetch(getPayloadUrl(`brand-page/${brandPage.id}`), {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'x-payload-api-key': PAYLOAD_API_KEY,
                },
                body: JSON.stringify({
                    translationHash: currentHash,
                }),
            });

            translated++;
        }

        console.log(`Translation complete: ${translated} translated, ${skipped} skipped`);
        return { translated, skipped };
    },
});
