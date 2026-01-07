import { task } from "@trigger.dev/sdk";
import { 
  TARGET_LANGUAGES, 
  translateText, 
  getMetadataValue 
} from "@/lib/translation-utils";
import { generateContentHash } from "@/lib/hash-utils";

export const translateCategory = task({
  id: "translate-category",
  queue: { concurrencyLimit: 5 },
  run: async (payload: { categoryId: string }) => {
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

    // 1. Fetch Category Data
    const res = await saleorFetch(`
      query GetCategoryForTranslation($id: ID!) {
        category(id: $id) {
          id
          name
          description
          seoTitle
          seoDescription
          privateMetadata { key value }
        }
      }
    `, { id: payload.categoryId });

    const category = res.data?.category;
    if (!category) throw new Error(`Category not found: ${payload.categoryId}`);

    // 2. Hash Guardrail
    const currentFields = {
      name: category.name,
      description: category.description,
      seoTitle: category.seoTitle,
      seoDescription: category.seoDescription,
    };
    const newHash = generateContentHash(currentFields);
    const oldHash = getMetadataValue(category.privateMetadata, "translation_hash_v1");

    if (newHash === oldHash) {
      console.log(`✅ [Hash Match] Category: "${category.name}" skipped.`);
      return { skipped: true, name: category.name, reason: "Hash Match" };
    }

    console.log(`✨ [TRANSLATING] Category: "${category.name}" (Hash Mismatch or First Run)`);

    // 3. Translate
    for (const lang of TARGET_LANGUAGES) {
      const [name, description, seoTitle, seoDescription] = await Promise.all([
        translateText(category.name, lang.name, geminiKey),
        translateText(category.description, lang.name, geminiKey, { isJson: true }),
        translateText(category.seoTitle || category.name, lang.name, geminiKey, { maxLength: 70 }),
        translateText(category.seoDescription || "", lang.name, geminiKey, { maxLength: 300 }),
      ]);

      const updateRes = await saleorFetch(`
        mutation UpdateCategoryTranslation($id: ID!, $lang: LanguageCodeEnum!, $input: TranslationInput!) {
          categoryTranslate(id: $id, languageCode: $lang, input: $input) {
            errors { field message }
          }
        }
      `, {
        id: category.id,
        lang: lang.code,
        input: { name, description, seoTitle, seoDescription }
      });

      if (updateRes.data?.categoryTranslate?.errors?.length > 0) {
        console.error(`   ❌ Failed to translate ${lang.name}:`, updateRes.data.categoryTranslate.errors);
      } else if (updateRes.errors) {
        console.error(`   ❌ API Error for ${lang.name}:`, updateRes.errors);
      } else {
         console.log(`   ✅ Translated to ${lang.name}`);
      }
    }

    // 4. Update Hash
    await saleorFetch(`
      mutation UpdateCategoryHash($id: ID!, $input: [MetadataInput!]!) {
        updatePrivateMetadata(id: $id, input: $input) {
          errors { field message }
        }
      }
    `, {
      id: category.id,
      input: [{ key: "translation_hash_v1", value: newHash }]
    });

    return { success: true };
  }
});
