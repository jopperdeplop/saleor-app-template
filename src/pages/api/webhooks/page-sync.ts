import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import {
  PageEventsDocument,
  PageEventsSubscription,
} from "@/generated/graphql";
import { saleorApp } from "@/saleor-app";

export type PagePayload = PageEventsSubscription["event"];

export const pageSyncWebhook = new SaleorAsyncWebhook<PagePayload>({
  name: "Page Sync",
  webhookPath: "api/webhooks/page-sync",
  event: "ANY_EVENTS" as any,
  apl: saleorApp.apl,
  query: PageEventsDocument,
});

export default pageSyncWebhook.createHandler(async (req, res, ctx) => {
  const payload = ctx.payload as any;
  const event = payload;

  const payloadApiUrl = process.env.NEXT_PUBLIC_PAYLOAD_API_URL;
  const payloadApiKey = process.env.PAYLOAD_API_KEY;
  const col = "pages";

  if (!payloadApiUrl) return res.status(500).end();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(payloadApiKey ? { "Authorization": `users API-Key ${payloadApiKey}` } : {}),
  };

  try {
    if (event?.__typename === "PageCreated" || event?.__typename === "PageUpdated") {
      const page = event.page;
      if (!page) return res.status(200).end();

      console.log(`🔄 Syncing Page: ${page.title}`);

      const data = {
        saleorId: page.id,
        title: page.title,
        slug: page.slug,
        content: page.content ? JSON.parse(page.content) : null,
      };

      const searchRes = await fetch(`${payloadApiUrl}/${col}?where[saleorId][equals]=${page.id}`, { headers });
      const searchJson = await searchRes.json();

      if (searchJson.docs?.length > 0) {
        await fetch(`${payloadApiUrl}/${col}/${searchJson.docs[0].id}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(data),
        });
      } else {
        await fetch(`${payloadApiUrl}/${col}`, {
          method: "POST",
          headers,
          body: JSON.stringify(data),
        });
      }
    }

    if (event?.__typename === "PageDeleted") {
      const pageId = event.page?.id;
      if (!pageId) return res.status(200).end();

      console.log(`🗑️ Deleting Page: ${pageId}`);

      const searchRes = await fetch(`${payloadApiUrl}/${col}?where[saleorId][equals]=${pageId}`, { headers });
      const searchJson = await searchRes.json();

      if (searchJson.docs?.length > 0) {
        await fetch(`${payloadApiUrl}/${col}/${searchJson.docs[0].id}`, {
          method: "DELETE",
          headers,
        });
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Page Sync Error:", error);
    return res.status(500).end();
  }
});

export const config = { api: { bodyParser: false } };
