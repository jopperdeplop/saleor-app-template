import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import {
  CategoryEventsDocument,
  CategoryEventsSubscription,
} from "@/generated/graphql";
import { saleorApp } from "@/saleor-app";

export type CategoryPayload = CategoryEventsSubscription["event"];

export const categoryDeletedWebhook = new SaleorAsyncWebhook<CategoryPayload>({
  name: "Category Deleted Sync",
  webhookPath: "api/webhooks/category-deleted",
  event: "CATEGORY_DELETED",
  apl: saleorApp.apl,
  query: CategoryEventsDocument,
});

export default categoryDeletedWebhook.createHandler(async (req, res, ctx) => {
  const payload = ctx.payload as any;
  const categoryId = payload.category?.id;

  if (!categoryId) return res.status(200).end();

  console.log(`🗑️ Deleting Category: ${categoryId}`);

  const payloadApiUrl = process.env.NEXT_PUBLIC_PAYLOAD_API_URL;
  const payloadApiKey = process.env.PAYLOAD_API_KEY;
  const collection = "categories";

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(payloadApiKey ? { "Authorization": `users API-Key ${payloadApiKey}` } : {}),
  };

  const searchRes = await fetch(`${payloadApiUrl}/${collection}?where[saleorId][equals]=${categoryId}`, { headers });
  const searchJson = await searchRes.json();

  if (searchJson.docs?.length > 0) {
    await fetch(`${payloadApiUrl}/${collection}/${searchJson.docs[0].id}`, {
      method: "DELETE",
      headers,
    });
  }

  return res.status(200).json({ success: true });
});

export const config = { api: { bodyParser: false } };
