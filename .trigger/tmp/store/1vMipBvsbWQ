import {
  task
} from "../../../../../chunk-ENJ6DR3G.mjs";
import "../../../../../chunk-DEKBIM76.mjs";
import {
  __name,
  init_esm
} from "../../../../../chunk-CEGEFIIW.mjs";

// src/trigger/translate-product.ts
init_esm();
var TARGET_LANGUAGES = [
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
  { code: "MT", name: "Maltese" }
];
var translateProduct = task({
  id: "translate-product",
  run: /* @__PURE__ */ __name(async (payload) => {
    const apiUrl = process.env.SALEOR_API_URL;
    const geminiKey = process.env.GOOGLE_API_KEY;
    let saleorToken = (process.env.SALEOR_APP_TOKEN || process.env.SALEOR_TOKEN || "").trim();
    if (!apiUrl || !saleorToken || !geminiKey) {
      throw new Error("Missing SALEOR_API_URL, SALEOR_TOKEN, or GOOGLE_API_KEY");
    }
    saleorToken = `Bearer ${saleorToken.replace(/^bearer\s+/i, "")}`;
    const saleorFetch = /* @__PURE__ */ __name(async (query, variables = {}) => {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Authorization": saleorToken,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ query, variables })
      });
      return await res.json();
    }, "saleorFetch");
    const productRes = await saleorFetch(`
            query GetProduct($id: ID!) {
                product(id: $id) {
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
        `, { id: payload.productId });
    const product = productRes.data?.product;
    if (!product) {
      console.error("❌ Product lookup failed. Query:", JSON.stringify({ query: "GetProduct", variables: { id: payload.productId } }));
      console.error("❌ Response:", JSON.stringify(productRes));
      throw new Error(`Product not found for ID: ${payload.productId}`);
    }
    console.log(`🌍 Translating Product: ${product.name} (${product.id})`);
    const existingTranslations = new Set(product.translations.map((t) => t.language.code.toUpperCase()));
    for (const lang of TARGET_LANGUAGES) {
      if (existingTranslations.has(lang.code)) {
        console.log(`⏩ Skipping ${lang.name} (already translated)`);
        continue;
      }
      console.log(`✍️ Translating to ${lang.name}...`);
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
        console.error(`❌ Failed to update ${lang.name} translation:`, updateRes.data.productTranslate.errors);
      } else {
        console.log(`✅ ${lang.name} translation updated.`);
      }
    }
    console.log(`✅ All translations processed for ${product.name}`);
  }, "run")
});
async function translateText(text, targetLanguage, apiKey, isJson = false) {
  if (!text || text === "{}" || text === '{"time":0,"blocks":[],"version":"2.25.0"}') return text;
  const prompt = isJson ? `You are a professional e-commerce translator. Translate the following EditorJS JSON content into ${targetLanguage}. Keep the JSON structure identical, only translate the text values inside the blocks. Do not translate HTML tags or technical keys. Return ONLY the translated JSON.

Content: ${text}` : `Translate the following product name into ${targetLanguage}. Return ONLY the translated string.

Content: ${text}`;
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    return translatedContent.replace(/^```json\n?/, "").replace(/\n?```$/, "");
  } catch (e) {
    console.error(`❌ Translation error for ${targetLanguage}:`, e);
    return text;
  }
}
__name(translateText, "translateText");
export {
  translateProduct
};
//# sourceMappingURL=translate-product.mjs.map
