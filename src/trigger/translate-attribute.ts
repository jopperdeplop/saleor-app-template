import { task } from "@trigger.dev/sdk";
import { 
  TARGET_LANGUAGES, 
  translateText 
} from "@/lib/translation-utils";

export const translateAttribute = task({
  id: "translate-attribute",
  run: async (payload: { attributeId: string }) => {
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

    // 1. Fetch Attribute + Values
    const res = await saleorFetch(`
      query GetAttribute($id: ID!) {
        attribute(id: $id) {
          id
          name
          choices(first: 100) {
            edges {
              node {
                id
                name
                richText
              }
            }
          }
        }
      }
    `, { id: payload.attributeId });

    const attribute = res.data?.attribute;
    if (!attribute) return;

    // 2. Translate to 15 languages
    for (const lang of TARGET_LANGUAGES) {
      // Translate Attribute Name
      const translatedAttrName = await translateText(attribute.name, lang.name, geminiKey);
      await saleorFetch(`
        mutation UpdateAttrTrans($id:ID!, $lang:LanguageCodeEnum!, $input:TranslationInput!){
          attributeTranslate(id:$id, languageCode:$lang, input:$input){ errors{field} }
        }
      `, {
        id: attribute.id,
        lang: lang.code,
        input: { name: translatedAttrName }
      });

      // Translate Choices (Attribute Values)
      for (const edge of attribute.choices?.edges || []) {
        const choice = edge.node;
        const translatedName = await translateText(choice.name, lang.name, geminiKey);
        const translatedRichText = choice.richText ? await translateText(choice.richText, lang.name, geminiKey, { isJson: true }) : null;

        await saleorFetch(`
          mutation UpdateValTrans($id:ID!, $lang:LanguageCodeEnum!, $input:TranslationInput!){
            attributeValueTranslate(id:$id, languageCode:$lang, input:$input){ errors{field} }
          }
        `, {
          id: choice.id,
          lang: lang.code,
          input: { 
            name: translatedName,
            richText: translatedRichText
          }
        });
      }
    }

    return { success: true };
  }
});
