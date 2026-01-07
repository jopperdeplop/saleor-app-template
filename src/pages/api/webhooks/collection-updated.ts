import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import {
  CollectionEventsDocument,
  CollectionEventsSubscription,
} from "@/generated/graphql";
import { saleorApp } from "@/saleor-app";

export type CollectionPayload = CollectionEventsSubscription["event"];

export const collectionUpdatedWebhook = new SaleorAsyncWebhook<CollectionPayload>({
  name: "Collection Updated Sync",
  webhookPath: "api/webhooks/collection-updated",
  event: "COLLECTION_UPDATED",
  apl: saleorApp.apl,
  query: CollectionEventsDocument,
});

export default collectionUpdatedWebhook.createHandler(async (req, res, ctx) => {
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

  // --- 🌍 TRANSLATION AUTOMATION ---
  try {
    const { translateCollection } = await import("@/trigger/translate-collection");
    await translateCollection.trigger({ collectionId: coll.id });
    console.log(`   📤 Translation task triggered for collection: ${coll.id}`);
  } catch (e) {
    console.error("   ⚠️ Failed to trigger translation:", e);
  }

  return res.status(200).json({ success: true });
});

export const config = { api: { bodyParser: false } };
