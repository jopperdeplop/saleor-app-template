import { task } from "@trigger.dev/sdk";
import { 
  TARGET_LANGUAGES, 
  translateText, 
  getMetadataValue,
  PRIVATE_METADATA_FRAGMENT 
} from "@/lib/translation-utils";
import { generateContentHash } from "@/lib/hash-utils";

export const translateProduct = task({
  id: "translate-product",
  run: async (payload: { productId: string }) => {
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
          'Content-Type': 'application/json',
          'Saleor-Api-Client': 'translation-automation'
        },
        body: JSON.stringify({ query, variables })
      });
      return await res.json();
    };

    // 1. Fetch Product Data + Private Metadata
    const productRes = await saleorFetch(`
      query GetProductForTranslation($id: ID!) {
        product(id: $id) {
          id
          name
          description
          seoTitle
          seoDescription
          privateMetadata {
            key
            value
          }
          variants {
            id
            name
          }
        }
      }
    `, { id: payload.productId });

    const product = productRes.data?.product;
    if (!product) {
      throw new Error(`Product not found: ${payload.productId}`);
    }

    // 2. Hash Guardrail
    const currentFields = {
      name: product.name,
      description: product.description,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
    };
    const newHash = generateContentHash(currentFields);
    const oldHash = getMetadataValue(product.privateMetadata, "translation_hash_v1");

    if (newHash === oldHash) {
      console.log(`✅ [Hash Match] Product "${product.name}" is already up to date. Skipping AI.`);
      return { skipped: true, reason: "Hash match" };
    }

    console.log(`🌍 [Hash Mismatch] Translating Product: ${product.name} to 15 languages...`);

    // 3. Process Languages (with concurrency limit)
    // We process sequentially or in small batches here for simplicity/stability
    for (const lang of TARGET_LANGUAGES) {
      console.log(`   ✍️ Processing ${lang.name}...`);
      
      const [name, description, seoTitle, seoDescription] = await Promise.all([
        translateText(product.name, lang.name, geminiKey),
        translateText(product.description, lang.name, geminiKey, { isJson: true }),
        translateText(product.seoTitle || product.name, lang.name, geminiKey),
        translateText(product.seoDescription || "", lang.name, geminiKey),
      ]);

      await saleorFetch(`
        mutation UpdateProductTranslation($id: ID!, $lang: LanguageCodeEnum!, $input: TranslationInput!) {
          productTranslate(id: $id, languageCode: $lang, input: $input) {
            errors { field message }
          }
        }
      `, {
        id: product.id,
        lang: lang.code,
        input: { name, description, seoTitle, seoDescription }
      });

      // Handle Product Variants (Names)
      if (product.variants?.length > 0) {
        for (const variant of product.variants) {
          if (!variant.name || variant.name === product.name) continue;
          
          const variantName = await translateText(variant.name, lang.name, geminiKey, { context: `Variant of ${product.name}` });
          await saleorFetch(`
            mutation UpdateVariantTranslation($id: ID!, $lang: LanguageCodeEnum!, $input: TranslationInput!) {
              productVariantTranslate(id: $id, languageCode: $lang, input: $input) {
                errors { field message }
              }
            }
          `, {
            id: variant.id,
            lang: lang.code,
            input: { name: variantName }
          });
        }
      }
    }

    // 4. Update Hash in Metadata
    await saleorFetch(`
      mutation UpdateProductHash($id: ID!, $input: [MetadataInput!]!) {
        updatePrivateMetadata(id: $id, input: $input) {
          errors { field message }
        }
      }
    `, {
      id: product.id,
      input: [{ key: "translation_hash_v1", value: newHash }]
    });

    console.log(`✅ [Success] Product "${product.name}" fully translated and hash updated.`);
    return { success: true };
  }
});
