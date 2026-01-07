import { task } from "@trigger.dev/sdk";
import { 
  TARGET_LANGUAGES, 
  translateText 
} from "@/lib/translation-utils";

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

    // 1. Fetch Shipping Method
    const res = await saleorFetch(`
      query GetShippingMethod($id: ID!) {
        shippingZone(id: "should-be-ignored-passed-in-payload-instead") {
             # We can't fetch shipping method directly by ID in standard schema?
             # ShippingMethod is usually accessed via ShippingZone or Node.
             # Let's try Node interface if possible, or assume ID is valid for node(id: $id) { ... on ShippingMethodType }
             # Using generic node query
             id
        }
      } 
    `, {});
    
    // Better query:
    const nodeRes = await saleorFetch(`
        query GetShippingMethod($id: ID!) {
            shippingMethod(id: $id) {
                id
                name
                description
                privateMetadata { key value }
            }
        }
    `, { id: payload.shippingMethodId });

    const sm = nodeRes.data?.shippingMethod;
    if (!sm) {
        console.error(`Shipping method not found: ${payload.shippingMethodId}`);
        return;
    }

    // 2. Translate
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

    // 3. Update Hash (optional, but good for consistency)
    // For now simple implementation without hash check to just get it working
    return { success: true };
  }
});
