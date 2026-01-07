import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import { saleorApp } from "@/saleor-app";
import { translateAttribute } from "@/trigger/translate-attribute";

export const attributeUpdatedWebhook = new SaleorAsyncWebhook<{ attribute: { id: string } }>({
  name: "Attribute Updated",
  webhookPath: "api/webhooks/attribute-updated",
  event: "ATTRIBUTE_UPDATED",
  apl: saleorApp.apl,
  query: `subscription { event { ... on AttributeUpdated { attribute { id } } } }`,
});

export default attributeUpdatedWebhook.createHandler(async (req, res, ctx) => {
  const { payload } = ctx;
  if (payload.attribute?.id) {
    console.log(`[Webhook] Attribute Updated: ${payload.attribute.id}`);
    await translateAttribute.trigger({ attributeId: payload.attribute.id });
  }
  res.status(200).end();
});
