import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import {
  CollectionEventsDocument,
  CollectionEventsSubscription,
} from "@/generated/graphql";
import { saleorApp } from "@/saleor-app";

export type CollectionPayload = CollectionEventsSubscription["event"];

export const collectionSyncWebhook = new SaleorAsyncWebhook<CollectionPayload>({
  name: "Collection Sync",
  webhookPath: "api/webhooks/collection-sync",
  event: "ANY_EVENTS" as any, 
  apl: saleorApp.apl,
  query: CollectionEventsDocument,
});

export default collectionSyncWebhook.createHandler(async (req, res, ctx) => {
  const payload = ctx.payload as any;
  const event = payload;

  const payloadApiUrl = process.env.NEXT_PUBLIC_PAYLOAD_API_URL;
  const payloadApiKey = process.env.PAYLOAD_API_KEY;
  const collectionSlug = "product-collections";

  if (!payloadApiUrl) return res.status(500).end();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(payloadApiKey ? { "Authorization": `users API-Key ${payloadApiKey}` } : {}),
  };

  try {
    if (event?.__typename === "CollectionCreated" || event?.__typename === "CollectionUpdated") {
      const coll = event.collection;
      if (!coll) return res.status(200).end();

      console.log(`🔄 Syncing Collection: ${coll.name}`);

      const data = {
        saleorId: coll.id,
        name: coll.name,
        slug: coll.slug,
        description: coll.description ? JSON.parse(coll.description) : null,
      };

      const searchRes = await fetch(`${payloadApiUrl}/${collectionSlug}?where[saleorId][equals]=${coll.id}`, { headers });
      const searchJson = await searchRes.json();

      if (searchJson.docs?.length > 0) {
        await fetch(`${payloadApiUrl}/${collectionSlug}/${searchJson.docs[0].id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(data),
        });
      } else {
        await fetch(`${payloadApiUrl}/${collectionSlug}`, {
          method: "POST",
          headers,
          body: JSON.stringify(data),
        });
      }
    }

    if (event?.__typename === "CollectionDeleted") {
      const collId = event.collection?.id;
      if (!collId) return res.status(200).end();

      console.log(`🗑️ Deleting Collection: ${collId}`);

      const searchRes = await fetch(`${payloadApiUrl}/${collectionSlug}?where[saleorId][equals]=${collId}`, { headers });
      const searchJson = await searchRes.json();

      if (searchJson.docs?.length > 0) {
        await fetch(`${payloadApiUrl}/${collectionSlug}/${searchJson.docs[0].id}`, {
          method: "DELETE",
          headers,
        });
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Collection Sync Error:", error);
    return res.status(500).end();
  }
});

export const config = { api: { bodyParser: false } };
