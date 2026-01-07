import { task } from "@trigger.dev/sdk";
import { 
  TARGET_LANGUAGES, 
  translateText, 
  getMetadataValue 
} from "@/lib/translation-utils";
import { generateContentHash } from "@/lib/hash-utils";

export const translatePage = task({
  id: "translate-page",
  run: async (payload: { pageId: string }) => {
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

    // 1. Fetch
    const res = await saleorFetch(`
      query GetPageForTranslation($id: ID!) {
        page(id: $id) {
          id
          title
          content
          seoTitle
          seoDescription
          privateMetadata { key value }
        }
      }
    `, { id: payload.pageId });

    const page = res.data?.page;
    if (!page) throw new Error(`Page not found: ${payload.pageId}`);

    // 2. Hash
    const currentFields = {
      title: page.title,
      content: page.content,
      seoTitle: page.seoTitle,
      seoDescription: page.seoDescription,
    };
    const newHash = generateContentHash(currentFields);
    const oldHash = getMetadataValue(page.privateMetadata, "translation_hash_v1");

    if (newHash === oldHash) {
      console.log(`✅ [Hash Match] Page "${page.title}" skipped.`);
      return { skipped: true };
    }

    // 3. Translate
    for (const lang of TARGET_LANGUAGES) {
      const [title, content, seoTitle, seoDescription] = await Promise.all([
        translateText(page.title, lang.name, geminiKey),
        translateText(page.content, lang.name, geminiKey, { isJson: true }),
        translateText(page.seoTitle || page.title, lang.name, geminiKey),
        translateText(page.seoDescription || "", lang.name, geminiKey),
      ]);

      await saleorFetch(`
        mutation UpdatePageTranslation($id: ID!, $lang: LanguageCodeEnum!, $input: TranslationInput!) {
          pageTranslate(id: $id, languageCode: $lang, input: $input) {
            errors { field message }
          }
        }
      `, {
        id: page.id,
        lang: lang.code,
        input: { title, content, seoTitle, seoDescription }
      });
    }

    // 4. Update Hash
    await saleorFetch(`
      mutation UpdatePageHash($id: ID!, $input: [MetadataInput!]!) {
        updatePrivateMetadata(id: $id, input: $input) {
          errors { field message }
        }
      }
    `, {
      id: page.id,
      input: [{ key: "translation_hash_v1", value: newHash }]
    });

    return { success: true };
  }
});
