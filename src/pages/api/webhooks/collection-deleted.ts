import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import {
  CollectionEventsDocument,
  CollectionEventsSubscription,
} from "@/generated/graphql";
import { saleorApp } from "@/saleor-app";

export type CollectionPayload = CollectionEventsSubscription["event"];

export const collectionDeletedWebhook = new SaleorAsyncWebhook<CollectionPayload>({
  name: "Collection Deleted Sync",
  webhookPath: "api/webhooks/collection-deleted",
  event: "COLLECTION_DELETED",
  apl: saleorApp.apl,
  query: CollectionEventsDocument,
});

export default collectionDeletedWebhook.createHandler(async (req, res, ctx) => {
  const payload = ctx.payload as any;
  const collId = payload.collection?.id;
  if (!collId) return res.status(200).end();

  const payloadApiUrl = process.env.NEXT_PUBLIC_PAYLOAD_API_URL;
  const payloadApiKey = process.env.PAYLOAD_API_KEY;
  const collectionSlug = "product-collections";

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(payloadApiKey ? { "Authorization": `users API-Key ${payloadApiKey}` } : {}),
  };

  const searchRes = await fetch(`${payloadApiUrl}/${collectionSlug}?where[saleorId][equals]=${collId}`, { headers });
  const searchJson = await searchRes.json();

  if (searchJson.docs?.length > 0) {
    await fetch(`${payloadApiUrl}/${collectionSlug}/${searchJson.docs[0].id}`, {
      method: "DELETE",
      headers,
    });
  }

  return res.status(200).json({ success: true });
});

export const config = { api: { bodyParser: false } };
