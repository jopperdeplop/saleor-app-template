import {
  task
} from "../../../../../chunk-ENJ6DR3G.mjs";
import "../../../../../chunk-DEKBIM76.mjs";
import {
  __name,
  init_esm
} from "../../../../../chunk-CEGEFIIW.mjs";

// src/trigger/test-translation-task.ts
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
var testTranslationTask = task({
  id: "test-translation-task",
  run: /* @__PURE__ */ __name(async (payload) => {
    const { productId } = payload;
    if (!productId) {
      console.error("❌ No product ID provided.");
      return;
    }
    console.log(`🚀 Starting TEST translation for product: ${productId}`);
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
    const translationAliases = TARGET_LANGUAGES.map(
      (lang) => `t_${lang.code}: translation(languageCode: ${lang.code}) { name description }`
    ).join("\n");
    console.log("🔍 Fetching product data...");
    let productRes = await saleorFetch(`
            query GetProduct($id: ID!) {
                product(id: $id) {
                    id
                    name
                    description
                    ${translationAliases}
                }
            }
        `, { id: productId });
    let product = productRes.data?.product;
    if (!product) {
      console.warn("⚠️ product(id) returned null. Trying node(id)...");
      const nodeRes = await saleorFetch(`
                query GetNode($id: ID!) {
                    node(id: $id) {
                        ... on Product {
                            id
                            name
                            description
                            ${translationAliases}
                        }
                    }
                }
            `, { id: productId });
      product = nodeRes.data?.node;
    }
    if (!product) {
      console.error("❌ Product NOT FOUND.");
      console.log("Response:", JSON.stringify(productRes, null, 2));
      return;
    }
    console.log(`✅ Found Product: ${product.name} (${product.id})`);
    console.log(`📝 Source Description: "${product.description?.substring(0, 50)}..."`);
    for (const lang of TARGET_LANGUAGES) {
      console.log(`
--- checking Language: ${lang.name} (${lang.code}) ---`);
      const existingTranslation = product[`t_${lang.code}`];
      const sourceDesc = product.description || "";
      const targetDesc = existingTranslation?.description || "";
      const targetName = existingTranslation?.name || "";
      console.log(`   Existing Translation: Name="${targetName}", Desc="${targetDesc.substring(0, 30)}..."`);
      const sourceSig = getContentSignature(sourceDesc);
      const targetSig = getContentSignature(targetDesc);
      const isDescContentDifferent = sourceSig !== targetSig;
      if (existingTranslation && existingTranslation.name && targetDesc && isDescContentDifferent) {
        console.log(`   ⏩ SKIPPING: Valid translation already exists (Content differs from source).`);
        continue;
      }
      if (!targetDesc) console.log("   ➤ Reason to Translate: Description is missing.");
      else if (!isDescContentDifferent) console.log("   ➤ Reason to Translate: Description content matches source (untranslated).");
      else console.log("   ➤ Reason to Translate: Name is missing?");
      console.log(`   ✍️ Translating to ${lang.name}...`);
      const translatedName = await translateText(product.name, lang.name, geminiKey, false, true);
      const translatedDescription = await translateText(product.description || "", lang.name, geminiKey, true, true);
      console.log(`   ✅ Gemini Result Name: "${translatedName}"`);
      console.log(`   ✅ Gemini Result Desc: "${translatedDescription.substring(0, 30)}..."`);
      console.log("   💾 Saving to Saleor...");
      const updateRes = await saleorFetch(`
                mutation UpdateTranslation($id: ID!, $language: LanguageCodeEnum!, $input: TranslationInput!) {
                    productTranslate(id: $id, languageCode: $language, input: $input) {
                        errors { field message }
                    }
                }
            `, {
        id: product.id,
        language: lang.code,
        input: { name: translatedName, description: translatedDescription }
      });
      if (updateRes.data?.productTranslate?.errors?.length > 0) {
        console.error(`   ❌ Failed to update ${lang.name}:`, JSON.stringify(updateRes.data.productTranslate.errors, null, 2));
      } else {
        console.log(`   🎉 Automatically Saved!`);
      }
    }
    console.log("\n🏁 Test Task Finished.");
  }, "run")
});
async function translateText(text, targetLanguage, apiKey, isJson = false, debug = false) {
  if (!text || text === "{}" || text === '{"time":0,"blocks":[],"version":"2.25.0"}') return text;
  const prompt = isJson ? `You are a professional e-commerce translator. Translate the following EditorJS JSON content into ${targetLanguage}. Keep the JSON structure identical, only translate the text values inside the blocks. Do not translate HTML tags or technical keys. Return ONLY the translated JSON.

Content: ${text}` : `Translate the following product name into ${targetLanguage}. If the name contains terms that are commonly used in ${targetLanguage} (like "Snowboard" in Dutch) or proper brand names, keep them in their original form. Return ONLY the final translated string.

Content: ${text}`;
  if (debug) console.log(`      [Gemini Request] Prompt: ${prompt.substring(0, 100)}...`);
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    if (!response.ok) {
      const errText = await response.text();
      console.error(`      ❌ Gemini API Error (${response.status}):`, errText);
      return text;
    }
    const data = await response.json();
    const translatedContent = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!translatedContent) {
      console.warn(`      ⚠️ Gemini returned empty translation for ${targetLanguage}.`);
      return text;
    }
    return translatedContent.replace(/^```json\n?/, "").replace(/\n?```$/, "");
  } catch (e) {
    console.error(`      ❌ Translation error for ${targetLanguage}:`, e);
    return text;
  }
}
__name(translateText, "translateText");
function getContentSignature(text) {
  if (!text) return "";
  try {
    const obj = JSON.parse(text);
    if (obj.blocks && Array.isArray(obj.blocks)) {
      return obj.blocks.map((b) => b.data?.text || "").join("").trim();
    }
    return text;
  } catch (e) {
    return text;
  }
}
__name(getContentSignature, "getContentSignature");
export {
  testTranslationTask
};
//# sourceMappingURL=test-translation-task.mjs.map
