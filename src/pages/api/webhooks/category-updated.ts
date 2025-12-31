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

  return res.status(200).json({ success: true });
});

export const config = { api: { bodyParser: false } };
