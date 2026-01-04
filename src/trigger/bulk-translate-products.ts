import { task } from "@trigger.dev/sdk";

// --- CONFIGURATION ---
const TARGET_LANGUAGES = [
    { code: "NL", name: "Dutch" },
    { code: "DE", name: "German" },
    { code: "FR", name: "French" },
    { code: "IT", name: "Italian" },
    { code: "ES", name: "Spanish" },
    { code: "PT", name: "Portuguese" },
    { code: "FI", name: "Finnish" },
    { code: "ET", name: "Estonian" },
    { code: "LV", name: "Latvian" },
    { code: "LT", name: "Lithuanian" },
    { code: "SK", name: "Slovak" },
    { code: "SL", name: "Slovenian" },
    { code: "EL", name: "Greek" },
    { code: "HR", name: "Croatian" },
    { code: "MT", name: "Maltese" },
];

export const bulkTranslateProducts = task({
    id: "bulk-translate-products",
    run: async (payload: { productIds: string[] }) => {
        const { productIds } = payload;
        if (!productIds || productIds.length === 0) {
            console.log("⚠️ No product IDs provided for bulk translation.");
            return;
        }

        console.log(`🚀 Starting bulk translation for ${productIds.length} products...`);

        const apiUrl = process.env.SALEOR_API_URL;
        const geminiKey = process.env.GOOGLE_API_KEY;
        let saleorToken = (process.env.SALEOR_APP_TOKEN || process.env.SALEOR_TOKEN || "").trim();

        if (!apiUrl || !saleorToken || !geminiKey) {
            throw new Error("Missing SALEOR_API_URL, SALEOR_TOKEN, or GOOGLE_API_KEY");
        }

        saleorToken = `Bearer ${saleorToken.replace(/^bearer\s+/i, "")}`;

        const saleorFetch = async (query: string, variables: any = {}) => {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': saleorToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query, variables })
            });
            return await res.json();
        };

        // Process products in chunks of 50 to respect API limits
        const CHUNK_SIZE = 50;
        let processed = 0;
        let failed = 0;

        for (let i = 0; i < productIds.length; i += CHUNK_SIZE) {
            const chunkIds = productIds.slice(i, i + CHUNK_SIZE);
            console.log(`📦 Processing chunk ${i / CHUNK_SIZE + 1} (${chunkIds.length} products)...`);
            
            try {
                // Batch fetch products by IDs (More reliable than single ID lookup for some contexts)
                const productsRes = await saleorFetch(`
                    query GetProductsBatch($ids: [ID!]!) {
                        products(filter: { ids: $ids }, first: 50) {
                            edges {
                                node {
                                    id
                                    name
                                    description
                                    translations {
                                        language {
                                            code
                                        }
                                    }
                                }
                            }
                        }
                    }
                `, { ids: chunkIds });

                const products = productsRes.data?.products?.edges || [];

                if (products.length === 0) {
                    console.warn(`⚠️ No products found in chunk. Ids: ${chunkIds.join(", ")}`);
                    failed += chunkIds.length;
                    continue;
                }

                for (const pEdge of products) {
                    const product = pEdge.node;
                    console.log(`🌍 [${processed + 1}/${productIds.length}] Translating: ${product.name} (${product.id})`);

                    const existingTranslations = new Set(product.translations.map((t: any) => t.language.code.toUpperCase()));

                    for (const lang of TARGET_LANGUAGES) {
                        if (existingTranslations.has(lang.code)) {
                            continue;
                        }

                        console.log(`   ✍️ Translating to ${lang.name}...`);
                        const translatedName = await translateText(product.name, lang.name, geminiKey);
                        const translatedDescription = await translateText(product.description || "", lang.name, geminiKey, true);

                        const updateRes = await saleorFetch(`
                            mutation UpdateTranslation($id: ID!, $language: LanguageCodeEnum!, $input: TranslationInput!) {
                                productTranslate(id: $id, languageCode: $language, input: $input) {
                                    errors { field message }
                                }
                            }
                        `, {
                            id: product.id,
                            language: lang.code,
                            input: {
                                name: translatedName,
                                description: translatedDescription
                            }
                        });

                        if (updateRes.data?.productTranslate?.errors?.length > 0) {
                            console.error(`   ❌ Failed to update ${lang.name} translation:`, updateRes.data.productTranslate.errors);
                        }
                    }
                    processed++;
                }

            } catch (e) {
                console.error(`❌ Error processing chunk:`, e);
                failed += chunkIds.length;
            }
        }

        console.log(`✅ Bulk translation finished. Processed: ${processed}, Failed: ${failed}`);
    }
});

async function translateText(text: string, targetLanguage: string, apiKey: string, isJson: boolean = false): Promise<string> {
    if (!text || text === "{}" || text === '{"time":0,"blocks":[],"version":"2.25.0"}') return text;

    const prompt = isJson 
        ? `You are a professional e-commerce translator. Translate the following EditorJS JSON content into ${targetLanguage}. Keep the JSON structure identical, only translate the text values inside the blocks. Do not translate HTML tags or technical keys. Return ONLY the translated JSON.\n\nContent: ${text}`
        : `Translate the following product name into ${targetLanguage}. Return ONLY the translated string.\n\nContent: ${text}`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        const translatedContent = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!translatedContent) {
            console.warn(`⚠️ Gemini returned empty translation for ${targetLanguage}`);
            return text;
        }

        // Clean up markdown code blocks if Gemini wrapped them
        return translatedContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } catch (e) {
        console.error(`❌ Translation error for ${targetLanguage}:`, e);
        return text;
    }
}
