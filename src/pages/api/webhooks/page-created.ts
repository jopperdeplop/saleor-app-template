import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import {
  PageEventsDocument,
  PageEventsSubscription,
} from "@/generated/graphql";
import { saleorApp } from "@/saleor-app";

export type PagePayload = PageEventsSubscription["event"];

export const pageCreatedWebhook = new SaleorAsyncWebhook<PagePayload>({
  name: "Page Created Sync",
  webhookPath: "api/webhooks/page-created",
  event: "PAGE_CREATED",
  apl: saleorApp.apl,
  query: PageEventsDocument,
});

export default pageCreatedWebhook.createHandler(async (req, res, ctx) => {
  const payload = ctx.payload as any;
  const page = payload.page;
  if (!page) return res.status(200).end();

  const payloadApiUrl = process.env.NEXT_PUBLIC_PAYLOAD_API_URL;
  const payloadApiKey = process.env.PAYLOAD_API_KEY;
  const col = "pages";

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(payloadApiKey ? { "Authorization": `users API-Key ${payloadApiKey}` } : {}),
  };

  const data = {
    saleorId: page.id,
    title: page.title,
    slug: page.slug,
    content: page.content ? JSON.parse(page.content) : null,
  };

  await fetch(`${payloadApiUrl}/${col}`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });

  return res.status(200).json({ success: true });
});

export const config = { api: { bodyParser: false } };
