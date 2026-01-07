import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import { saleorApp } from "@/saleor-app";
import { translateShippingMethod } from "@/trigger/translate-shipping-method";

export const shippingPriceUpdatedWebhook = new SaleorAsyncWebhook<{ shippingPrice: { id: string } }>({
  name: "Shipping Price Updated",
  webhookPath: "api/webhooks/shipping-price-updated",
  event: "SHIPPING_PRICE_UPDATED",
  apl: saleorApp.apl,
  query: `subscription { event { ... on ShippingPriceUpdated { shippingMethod { id } } } }`,
});

export default shippingPriceUpdatedWebhook.createHandler(async (req, res, ctx) => {
  const { payload } = ctx;
  // @ts-ignore
  const id = payload.shippingMethod?.id || payload.shippingPrice?.id;

  if (id) {
    console.log(`[Webhook] Shipping Price Updated: ${id}`);
    await translateShippingMethod.trigger({ shippingMethodId: id });
  }
  res.status(200).end();
});
