import { task } from "@trigger.dev/sdk";
import { 
  TARGET_LANGUAGES, 
  translateText,
  getMetadataValue
} from "@/lib/translation-utils";
import { generateContentHash } from "@/lib/hash-utils";

export const translateShippingMethod = task({
  id: "translate-shipping-method",
  queue: { concurrencyLimit: 5 },
  run: async (payload: { shippingMethodId: string }) => {
    const apiUrl = process.env.SALEOR_API_URL;
    const geminiKey = process.env.GOOGLE_API_KEY;
    let saleorToken = (process.env.SALEOR_APP_TOKEN || process.env.SALEOR_TOKEN || "").trim();

    if (!apiUrl || !saleorToken || !geminiKey) return;
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

    // Fetch via translation query since root shippingMethod query might be missing or restricted
    const transRes = await saleorFetch(`
        query GetShippingMethodTranslatable($id: ID!) {
            translation(id: $id, kind: SHIPPING_METHOD) {
                ... on ShippingMethodTranslatableContent {
                    name
                    description
                    shippingMethod {
                        id
                        privateMetadata { key value }
                    }
                }
            }
        }
    `, { id: payload.shippingMethodId });

    const content = transRes.data?.translation;
    
    if (!content) {
        console.error(`Shipping method not found: ${payload.shippingMethodId}`);
        return;
    }

    const sm = {
        id: content.shippingMethod?.id || payload.shippingMethodId,
        name: content.name,
        description: content.description,
        privateMetadata: content.shippingMethod?.privateMetadata || []
    };

    // Hash check
    const currentFields = { name: sm.name, description: sm.description };
    const newHash = generateContentHash(currentFields);
    const oldHash = getMetadataValue(sm.privateMetadata, "translation_hash_v1");

    if (newHash === oldHash) {
      console.log(`✅ [Hash Match] Shipping Method "${sm.name}" skipped.`);
      return { skipped: true };
    }

    // Translate
    for (const lang of TARGET_LANGUAGES) {
      const translatedName = await translateText(sm.name, lang.name, geminiKey);
      const translatedDesc = await translateText(sm.description, lang.name, geminiKey, { isJson: true });

      await saleorFetch(`
        mutation UpdateShippingTranslation($id: ID!, $lang: LanguageCodeEnum!, $input: ShippingPriceTranslationInput!) {
          shippingPriceTranslate(id: $id, languageCode: $lang, input: $input) {
            errors { field message }
          }
        }
      `, {
        id: sm.id,
        lang: lang.code,
        input: { name: translatedName, description: translatedDesc }
      });
    }

    // Update Hash
    await saleorFetch(`
      mutation UpdateShippingMethodHash($id: ID!, $input: [MetadataInput!]!) {
        updatePrivateMetadata(id: $id, input: $input) {
          errors { field message }
        }
      }
    `, {
      id: sm.id,
      input: [{ key: "translation_hash_v1", value: newHash }]
    });

    return { success: true };
  }
});
