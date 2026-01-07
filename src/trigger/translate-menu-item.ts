import { task } from "@trigger.dev/sdk";
import { 
  TARGET_LANGUAGES, 
  translateText 
} from "@/lib/translation-utils";

export const translateMenuItem = task({
  id: "translate-menu-item",
  queue: { concurrencyLimit: 5 },
  run: async (payload: { menuItemId: string }) => {
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
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Saleor API Error (${res.status}): ${text}`);
      }
      return await res.json();
    };

    // 1. Fetch MenuItem
    const res = await saleorFetch(`
      query GetMenuItem($id: ID!) {
        menuItem(id: $id) {
          id
          name
          privateMetadata { key value }
        }
      }
    `, { id: payload.menuItemId });

    const item = res.data?.menuItem;
    if (!item) return;

    // 2. Translate
    for (const lang of TARGET_LANGUAGES) {
      const translatedName = await translateText(item.name, lang.name, geminiKey);
      
      await saleorFetch(`
        mutation UpdateMenuItemTranslation($id: ID!, $lang: LanguageCodeEnum!, $input: NameTranslationInput!) {
          menuItemTranslate(id: $id, languageCode: $lang, input: $input) {
            errors { field message }
          }
        }
      `, {
        id: item.id,
        lang: lang.code,
        input: { name: translatedName }
      });
    }

    return { success: true };
  }
});
