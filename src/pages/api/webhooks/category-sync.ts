import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import {
  CategoryEventsDocument,
  CategoryEventsSubscription,
} from "@/generated/graphql";
import { saleorApp } from "@/saleor-app";

// Note: CategoryEventsSubscription contains union of types
export type CategoryPayload = CategoryEventsSubscription["event"];

export const categorySyncWebhook = new SaleorAsyncWebhook<CategoryPayload>({
  name: "Category Sync",
  webhookPath: "api/webhooks/category-sync",
  event: "ANY_EVENTS" as any, // We'll handle multiple sub-events
  apl: saleorApp.apl,
  query: CategoryEventsDocument,
});

export default categorySyncWebhook.createHandler(async (req, res, ctx) => {
  const { payload } = ctx;
  const event = payload;

  const payloadApiUrl = process.env.NEXT_PUBLIC_PAYLOAD_API_URL;
  const payloadApiKey = process.env.PAYLOAD_API_KEY;
  const collection = "categories";

  if (!payloadApiUrl) return res.status(500).json({ error: "Missing API URL" });

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(payloadApiKey ? { "Authorization": `users API-Key ${payloadApiKey}` } : {}),
  };

  try {
    // Handling Created or Updated
    if (event?.__typename === "CategoryCreated" || event?.__typename === "CategoryUpdated") {
      const category = event.category;
      if (!category) return res.status(200).end();

      console.log(`🔄 Syncing Category: ${category.name}`);

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
    }

    // Handling Deleted
    if (event?.__typename === "CategoryDeleted") {
      const categoryId = event.category?.id;
      if (!categoryId) return res.status(200).end();

      console.log(`🗑️ Deleting Category: ${categoryId}`);

      const searchRes = await fetch(`${payloadApiUrl}/${collection}?where[saleorId][equals]=${categoryId}`, { headers });
      const searchJson = await searchRes.json();

      if (searchJson.docs?.length > 0) {
        await fetch(`${payloadApiUrl}/${collection}/${searchJson.docs[0].id}`, {
          method: "DELETE",
          headers,
        });
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Category Sync Error:", error);
    return res.status(500).json({ error: "Internal Error" });
  }
});

export const config = { api: { bodyParser: false } };
