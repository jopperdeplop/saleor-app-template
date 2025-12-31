import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import {
  CollectionEventsDocument,
  CollectionEventsSubscription,
} from "@/generated/graphql";
import { saleorApp } from "@/saleor-app";

export type CollectionPayload = CollectionEventsSubscription["event"];

export const collectionCreatedWebhook = new SaleorAsyncWebhook<CollectionPayload>({
  name: "Collection Created Sync",
  webhookPath: "api/webhooks/collection-created",
  event: "COLLECTION_CREATED",
  apl: saleorApp.apl,
  query: CollectionEventsDocument,
});

export default collectionCreatedWebhook.createHandler(async (req, res, ctx) => {
  const payload = ctx.payload as any;
  const coll = payload.collection;
  if (!coll) return res.status(200).end();

  const payloadApiUrl = process.env.NEXT_PUBLIC_PAYLOAD_API_URL;
  const payloadApiKey = process.env.PAYLOAD_API_KEY;
  const collectionSlug = "product-collections";

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(payloadApiKey ? { "Authorization": `users API-Key ${payloadApiKey}` } : {}),
  };

  const data = {
    saleorId: coll.id,
    name: coll.name,
    slug: coll.slug,
    description: coll.description ? JSON.parse(coll.description) : null,
  };

  await fetch(`${payloadApiUrl}/${collectionSlug}`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });

  return res.status(200).json({ success: true });
});

export const config = { api: { bodyParser: false } };
