import { task } from "@trigger.dev/sdk";
import { 
  TARGET_LANGUAGES, 
  translateText,
  getMetadataValue 
} from "@/lib/translation-utils";
import { generateContentHash } from "@/lib/hash-utils";

// Map Payload locale codes (lowercase) to our translation language codes (uppercase)
const PAYLOAD_TO_SALEOR_LOCALE: Record<string, string> = {
  nl: "NL", de: "DE", fr: "FR", it: "IT", es: "ES", pt: "PT",
  fi: "FI", et: "ET", lv: "LV", lt: "LT", sk: "SK", sl: "SL",
  el: "EL", hr: "HR", mt: "MT",
};

interface PayloadBlock {
  blockType: string;
  [key: string]: unknown;
}

interface PayloadHomepage {
  id: string;
  translationHash?: string;
  layout: PayloadBlock[];
  seo?: {
    metaTitle?: string;
    metaDescription?: string;
  };
}

async function translateBlock(block: PayloadBlock, langName: string, geminiKey: string): Promise<PayloadBlock> {
  const translated = { ...block };

  // Hero block
  if (block.blockType === "hero") {
    if (block.heading) translated.heading = await translateText(block.heading as string, langName, geminiKey);
    if (block.subtitle) translated.subtitle = await translateText(block.subtitle as string, langName, geminiKey);
    if (block.badge) translated.badge = await translateText(block.badge as string, langName, geminiKey);
    if (block.ctaPrimary && typeof block.ctaPrimary === "object") {
      const cta = block.ctaPrimary as { label?: string; url?: string };
      translated.ctaPrimary = { ...cta, label: cta.label ? await translateText(cta.label, langName, geminiKey) : undefined };
    }
    if (block.ctaSecondary && typeof block.ctaSecondary === "object") {
      const cta = block.ctaSecondary as { label?: string; url?: string };
      translated.ctaSecondary = { ...cta, label: cta.label ? await translateText(cta.label, langName, geminiKey) : undefined };
    }
  }

  // Narrative block
  if (block.blockType === "narrative") {
    if (block.oldWayLabel) translated.oldWayLabel = await translateText(block.oldWayLabel as string, langName, geminiKey);
    if (block.oldWayHeading) translated.oldWayHeading = await translateText(block.oldWayHeading as string, langName, geminiKey);
    if (block.oldWayText) translated.oldWayText = await translateText(block.oldWayText as string, langName, geminiKey);
    if (block.oldWayText2) translated.oldWayText2 = await translateText(block.oldWayText2 as string, langName, geminiKey);
    if (block.quote) translated.quote = await translateText(block.quote as string, langName, geminiKey);
    if (block.newStandardLabel) translated.newStandardLabel = await translateText(block.newStandardLabel as string, langName, geminiKey);
    if (block.newStandardHeading) translated.newStandardHeading = await translateText(block.newStandardHeading as string, langName, geminiKey);
    if (Array.isArray(block.features)) {
      translated.features = await Promise.all(
        (block.features as Array<{ icon?: string; title?: string; text?: string }>).map(async (f) => ({
          icon: f.icon,
          title: f.title ? await translateText(f.title, langName, geminiKey) : undefined,
          text: f.text ? await translateText(f.text, langName, geminiKey) : undefined,
        }))
      );
    }
  }

  // Brand ticker block
  if (block.blockType === "brand-ticker") {
    if (block.sectionLabel) translated.sectionLabel = await translateText(block.sectionLabel as string, langName, geminiKey);
  }

  // Product grid block
  if (block.blockType === "product-grid") {
    if (block.sectionLabel) translated.sectionLabel = await translateText(block.sectionLabel as string, langName, geminiKey);
    if (block.heading) translated.heading = await translateText(block.heading as string, langName, geminiKey);
    if (block.viewAllLabel) translated.viewAllLabel = await translateText(block.viewAllLabel as string, langName, geminiKey);
  }

  // Collection cards block
  if (block.blockType === "collection-cards") {
    if (block.sectionLabel) translated.sectionLabel = await translateText(block.sectionLabel as string, langName, geminiKey);
    if (block.heading) translated.heading = await translateText(block.heading as string, langName, geminiKey);
    if (block.scrollHint) translated.scrollHint = await translateText(block.scrollHint as string, langName, geminiKey);
    if (Array.isArray(block.cards)) {
      translated.cards = await Promise.all(
        (block.cards as Array<{ title?: string; subtitle?: string; ctaLabel?: string; imageUrl?: string; linkUrl?: string }>).map(async (card) => ({
          ...card,
          title: card.title ? await translateText(card.title, langName, geminiKey) : undefined,
          subtitle: card.subtitle ? await translateText(card.subtitle, langName, geminiKey) : undefined,
          ctaLabel: card.ctaLabel ? await translateText(card.ctaLabel, langName, geminiKey) : undefined,
        }))
      );
    }
  }

  return translated;
}

export const translatePayloadHomepage = task({
  id: "translate-payload-homepage",
  queue: { concurrencyLimit: 5 },
  run: async () => {
    const apiUrl = process.env.PAYLOAD_API_URL;
    const apiToken = process.env.PAYLOAD_API_TOKEN;
    const geminiKey = process.env.GOOGLE_API_KEY;

    if (!apiUrl || !apiToken || !geminiKey) {
      throw new Error("Missing PAYLOAD_API_URL, PAYLOAD_API_TOKEN, or GOOGLE_API_KEY");
    }

    // 1. Fetch English homepage
    const res = await fetch(`${apiUrl}/api/homepage?locale=en&depth=0`);
    if (!res.ok) {
      throw new Error(`Failed to fetch homepage: ${res.status}`);
    }
    
    const data = await res.json();
    const homepage: PayloadHomepage = data.docs?.[0] || data;
    
    if (!homepage || !homepage.id) {
      console.log("No homepage found to translate");
      return { skipped: true, reason: "No homepage document" };
    }

    // 2. Hash check
    const contentToHash = JSON.stringify({
      layout: homepage.layout,
      seo: homepage.seo,
    });
    const newHash = generateContentHash({ content: contentToHash });

    if (newHash === homepage.translationHash) {
      console.log("✅ [Hash Match] Homepage skipped.");
      return { skipped: true };
    }

    console.log(`Translating homepage ${homepage.id} to ${TARGET_LANGUAGES.length} languages...`);

    // 3. Translate to each locale
    for (const lang of TARGET_LANGUAGES) {
      const payloadLocale = lang.code.toLowerCase();
      console.log(`Translating to ${lang.name} (${payloadLocale})...`);

      // Translate all blocks
      const translatedLayout = await Promise.all(
        homepage.layout.map((block) => translateBlock(block, lang.name, geminiKey))
      );

      // Translate SEO
      const translatedSeo = homepage.seo ? {
        metaTitle: homepage.seo.metaTitle ? await translateText(homepage.seo.metaTitle, lang.name, geminiKey, { maxLength: 70 }) : undefined,
        metaDescription: homepage.seo.metaDescription ? await translateText(homepage.seo.metaDescription, lang.name, geminiKey, { maxLength: 160 }) : undefined,
      } : undefined;

      // PATCH to Payload
      const patchRes = await fetch(`${apiUrl}/api/homepage/${homepage.id}?locale=${payloadLocale}`, {
        method: "PATCH",
        headers: {
          "Authorization": `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          layout: translatedLayout,
          seo: translatedSeo,
        }),
      });

      if (!patchRes.ok) {
        console.error(`Failed to patch ${lang.name}:`, await patchRes.text());
      } else {
        console.log(`✅ ${lang.name} done`);
      }
    }

    // 4. Update hash
    await fetch(`${apiUrl}/api/homepage/${homepage.id}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${apiToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ translationHash: newHash }),
    });

    console.log("✅ Homepage translation complete");
    return { success: true };
  },
});
