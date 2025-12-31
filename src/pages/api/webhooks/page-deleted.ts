import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import {
  PageEventsDocument,
  PageEventsSubscription,
} from "@/generated/graphql";
import { saleorApp } from "@/saleor-app";

export type PagePayload = PageEventsSubscription["event"];

export const pageDeletedWebhook = new SaleorAsyncWebhook<PagePayload>({
  name: "Page Deleted Sync",
  webhookPath: "api/webhooks/page-deleted",
  event: "PAGE_DELETED",
  apl: saleorApp.apl,
  query: PageEventsDocument,
});

export default pageDeletedWebhook.createHandler(async (req, res, ctx) => {
  const payload = ctx.payload as any;
  const pageId = payload.page?.id;
  if (!pageId) return res.status(200).end();

  console.log(`🗑️ Deleting Page: ${pageId}`);

  const payloadApiUrl = process.env.NEXT_PUBLIC_PAYLOAD_API_URL;
  const payloadApiKey = process.env.PAYLOAD_API_KEY;
  const col = "pages";

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(payloadApiKey ? { "Authorization": `users API-Key ${payloadApiKey}` } : {}),
  };

  try {
    const searchRes = await fetch(`${payloadApiUrl}/${col}?where[saleorId][equals]=${pageId}`, { headers });
    const searchJson = await searchRes.json();

    if (searchJson.docs?.length > 0) {
      await fetch(`${payloadApiUrl}/${col}/${searchJson.docs[0].id}`, {
        method: "DELETE",
        headers,
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Page Delete Error:", error);
    return res.status(500).end();
  }
});

export const config = { api: { bodyParser: false } };
