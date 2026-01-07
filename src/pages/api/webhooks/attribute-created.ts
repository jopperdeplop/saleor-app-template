import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import { saleorApp } from "@/saleor-app";
import { translateAttribute } from "@/trigger/translate-attribute";

export const attributeCreatedWebhook = new SaleorAsyncWebhook<{ attribute: { id: string } }>({
  name: "Attribute Created",
  webhookPath: "api/webhooks/attribute-created",
  event: "ATTRIBUTE_CREATED",
  apl: saleorApp.apl,
  query: `subscription { event { ... on AttributeCreated { attribute { id } } } }`,
});

export default attributeCreatedWebhook.createHandler(async (req, res, ctx) => {
  const { payload } = ctx;
  if (payload.attribute?.id) {
    console.log(`[Webhook] Attribute Created: ${payload.attribute.id}`);
    await translateAttribute.trigger({ attributeId: payload.attribute.id });
  }
  res.status(200).end();
});
