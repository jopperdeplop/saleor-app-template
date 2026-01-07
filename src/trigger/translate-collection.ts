import { task } from "@trigger.dev/sdk";
import { 
  TARGET_LANGUAGES, 
  translateText, 
  getMetadataValue 
} from "@/lib/translation-utils";
import { generateContentHash } from "@/lib/hash-utils";

export const translateCollection = task({
  id: "translate-collection",
  run: async (payload: { collectionId: string }) => {
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
      query GetCollectionForTranslation($id: ID!) {
        collection(id: $id) {
          id
          name
          description
          seoTitle
          seoDescription
          privateMetadata { key value }
        }
      }
    `, { id: payload.collectionId });

    const collection = res.data?.collection;
    if (!collection) throw new Error(`Collection not found: ${payload.collectionId}`);

    // 2. Hash
    const currentFields = {
      name: collection.name,
      description: collection.description,
      seoTitle: collection.seoTitle,
      seoDescription: collection.seoDescription,
    };
    const newHash = generateContentHash(currentFields);
    const oldHash = getMetadataValue(collection.privateMetadata, "translation_hash_v1");

    if (newHash === oldHash) {
      console.log(`✅ [Hash Match] Collection "${collection.name}" skipped.`);
      return { skipped: true };
    }

    // 3. Translate
    for (const lang of TARGET_LANGUAGES) {
      const [name, description, seoTitle, seoDescription] = await Promise.all([
        translateText(collection.name, lang.name, geminiKey),
        translateText(collection.description, lang.name, geminiKey, { isJson: true }),
        translateText(collection.seoTitle || collection.name, lang.name, geminiKey),
        translateText(collection.seoDescription || "", lang.name, geminiKey),
      ]);

      await saleorFetch(`
        mutation UpdateCollectionTranslation($id: ID!, $lang: LanguageCodeEnum!, $input: TranslationInput!) {
          collectionTranslate(id: $id, languageCode: $lang, input: $input) {
            errors { field message }
          }
        }
      `, {
        id: collection.id,
        lang: lang.code,
        input: { name, description, seoTitle, seoDescription }
      });
    }

    // 4. Update Hash
    await saleorFetch(`
      mutation UpdateCollectionHash($id: ID!, $input: [MetadataInput!]!) {
        updatePrivateMetadata(id: $id, input: $input) {
          errors { field message }
        }
      }
    `, {
      id: collection.id,
      input: [{ key: "translation_hash_v1", value: newHash }]
    });

    return { success: true };
  }
});
