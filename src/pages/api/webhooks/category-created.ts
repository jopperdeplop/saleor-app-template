import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import {
  CategoryEventsDocument,
  CategoryEventsSubscription,
} from "@/generated/graphql";
import { saleorApp } from "@/saleor-app";

export type CategoryPayload = CategoryEventsSubscription["event"];

export const categoryCreatedWebhook = new SaleorAsyncWebhook<CategoryPayload>({
  name: "Category Created Sync",
  webhookPath: "api/webhooks/category-created",
  event: "CATEGORY_CREATED",
  apl: saleorApp.apl,
  query: CategoryEventsDocument,
});

export default categoryCreatedWebhook.createHandler(async (req, res, ctx) => {
  const payload = ctx.payload as any;
  const category = payload.category;

  if (!category) return res.status(200).end();

  console.log(`🔄 Syncing Created Category: ${category.name}`);

  const payloadApiUrl = process.env.NEXT_PUBLIC_PAYLOAD_API_URL;
  const payloadApiKey = process.env.PAYLOAD_API_KEY;
  const collection = "categories";

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(payloadApiKey ? { "Authorization": `users API-Key ${payloadApiKey}` } : {}),
  };

  const data = {
    saleorId: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description ? JSON.parse(category.description) : null,
    parentId: category.parent?.id || null,
  };

  await fetch(`${payloadApiUrl}/${collection}`, {
    method: "POST",
    headers,
    body: JSON.stringify(data),
  });

  // --- 🌍 TRANSLATION AUTOMATION ---
  try {
    const { translateCategory } = await import("@/trigger/translate-category");
    await translateCategory.trigger({ categoryId: category.id });
  } catch (e) {
    console.error("   ⚠️ Failed to trigger translation:", e);
  }

  return res.status(200).json({ success: true });
});

export const config = { api: { bodyParser: false } };
