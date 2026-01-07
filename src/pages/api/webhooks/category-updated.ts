import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import {
  CategoryEventsDocument,
  CategoryEventsSubscription,
} from "@/generated/graphql";
import { saleorApp } from "@/saleor-app";

export type CategoryPayload = CategoryEventsSubscription["event"];

export const categoryUpdatedWebhook = new SaleorAsyncWebhook<CategoryPayload>({
  name: "Category Updated Sync",
  webhookPath: "api/webhooks/category-updated",
  event: "CATEGORY_UPDATED",
  apl: saleorApp.apl,
  query: CategoryEventsDocument,
});

export default categoryUpdatedWebhook.createHandler(async (req, res, ctx) => {
  const payload = ctx.payload as any;
  const category = payload.category;

  if (!category) return res.status(200).end();

  console.log(`🔄 Syncing Updated Category: ${category.name}`);

  // --- 🤖 AI SEO ENRICHMENT ---
  try {
     // If description or SEO title is missing, generate them
     if (!category.description || !category.seoTitle || !category.seoDescription) {
       console.log(`   🤖 Logic: Category "${category.name}" missing SEO/Content. Generating...`);
       
       const { generateCategorySEO } = await import("@/lib/google-ai");
       const { saleorClient } = await import("@/lib/saleor-client");
       const { gql } = await import("urql");
       
       // 1. Fetch Sample Products for Context
       const GET_PRODS = gql`query Prods($cat:ID!){ products(filter:{categories:[$cat]}, first:10){ edges{node{name attributes{attribute{name} values{name}}}} } }`;
       const prodRes = await saleorClient.query(GET_PRODS, { cat: category.id }).toPromise();
       const sampleProducts = prodRes.data?.products?.edges?.map((e:any) => ({
         name: e.node.name,
         brand: e.node.attributes.find((a:any) => a.attribute.name === "Brand")?.values[0]?.name || "",
         features: e.node.attributes.map((a:any) => a.values[0]?.name).filter(Boolean)
       })) || [];

       // 2. Generate Content
       const seoData = await generateCategorySEO(category.name, sampleProducts);

       // 3. Update Category (if changed)
       // Check to avoid infinite loops: only update if data is actually different/missing
       const needsUpdate = !category.seoTitle || !category.seoDescription || !category.description;
       
       if (needsUpdate) {
         const UPDATE_CAT = gql`mutation UpdCat($id:ID!, $in:CategoryInput!){ categoryUpdate(id:$id, input:$in){ errors{field} } }`;
         
         const input: any = {};
         if (!category.seoTitle) input.seo = { ...(input.seo || {}), title: seoData.seoTitle };
         if (!category.seoDescription) input.seo = { ...(input.seo || {}), description: seoData.seoDescription };
         // Only update description if it was empty, don't overwrite manual edits
         if (!category.description) input.description = JSON.stringify({ time: Date.now(), blocks: [{ type: "paragraph", data: { text: seoData.description } }] });

         if (Object.keys(input).length > 0) {
            // Merge existing SEO if partial update
            if (input.seo) {
               if (!input.seo.title && category.seoTitle) input.seo.title = category.seoTitle;
               if (!input.seo.description && category.seoDescription) input.seo.description = category.seoDescription;
            }

            console.log("   ✨ Applying AI SEO Updates...");
            await saleorClient.mutation(UPDATE_CAT, { id: category.id, in: input }).toPromise();
         }
       }
     }
  } catch (e) {
    console.error("   ⚠️ AI SEO Error:", e);
  }
  // ----------------------------


  const payloadApiUrl = process.env.NEXT_PUBLIC_PAYLOAD_API_URL;
  const payloadApiKey = process.env.PAYLOAD_API_KEY;
  const collection = "categories";

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(payloadApiKey ? { "Authorization": `users API-Key ${payloadApiKey}` } : {}),
  };

  const data = {
    saleorId: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description ? JSON.parse(category.description) : null,
    parentId: category.parent?.id || null,
  };

  const searchRes = await fetch(`${payloadApiUrl}/${collection}?where[saleorId][equals]=${category.id}`, { headers });
  const searchJson = await searchRes.json();

  if (searchJson.docs?.length > 0) {
    await fetch(`${payloadApiUrl}/${collection}/${searchJson.docs[0].id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify(data),
    });
  } else {
    await fetch(`${payloadApiUrl}/${collection}`, {
      method: "POST",
      headers,
      body: JSON.stringify(data),
    });
  }

  // --- 🌍 TRANSLATION AUTOMATION ---
  try {
    const { translateCategory } = await import("@/trigger/translate-category");
    await translateCategory.trigger({ categoryId: category.id });
    console.log(`   📤 Translation task triggered for category: ${category.id}`);
  } catch (e) {
    console.error("   ⚠️ Failed to trigger translation:", e);
  }

  return res.status(200).json({ success: true });
});

export const config = { api: { bodyParser: false } };
