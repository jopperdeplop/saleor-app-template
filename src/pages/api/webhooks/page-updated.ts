import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import {
  PageEventsDocument,
  PageEventsSubscription,
} from "@/generated/graphql";
import { saleorApp } from "@/saleor-app";

export type PagePayload = PageEventsSubscription["event"];

export const pageUpdatedWebhook = new SaleorAsyncWebhook<PagePayload>({
  name: "Page Updated Sync",
  webhookPath: "api/webhooks/page-updated",
  event: "PAGE_UPDATED",
  apl: saleorApp.apl,
  query: PageEventsDocument,
});

export default pageUpdatedWebhook.createHandler(async (req, res, ctx) => {
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

  // --- 🌍 TRANSLATION AUTOMATION ---
  try {
    const { translatePage } = await import("@/trigger/translate-page");
    await translatePage.trigger({ pageId: page.id });
    console.log(`   📤 Translation task triggered for page: ${page.id}`);
  } catch (e) {
    console.error("   ⚠️ Failed to trigger translation:", e);
  }

  return res.status(200).json({ success: true });
});

export const config = { api: { bodyParser: false } };
