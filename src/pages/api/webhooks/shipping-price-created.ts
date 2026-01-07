import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import { saleorApp } from "@/saleor-app";
import { translateShippingMethod } from "@/trigger/translate-shipping-method";

export const shippingPriceCreatedWebhook = new SaleorAsyncWebhook<{ shippingPrice: { id: string } }>({
  name: "Shipping Price Created",
  webhookPath: "api/webhooks/shipping-price-created",
  event: "SHIPPING_PRICE_CREATED",
  apl: saleorApp.apl,
  query: `subscription { event { ... on ShippingPriceCreated { shippingMethod { id } } } }`,
});

export default shippingPriceCreatedWebhook.createHandler(async (req, res, ctx) => {
  const { payload } = ctx;
  // Note: Payload field is often 'shippingMethod' or 'shippingPrice' depending on version/event.
  // The subscription asks for 'shippingMethod { id }', so payload structure matches that.
  // Let's type it loosely to be safe or inspect payload structure in logs if needed.
  // Based on GQL: ... on ShippingPriceCreated { shippingMethod { id } } -> payload.shippingMethod.id
  
  // @ts-ignore
  const id = payload.shippingMethod?.id || payload.shippingPrice?.id;

  if (id) {
    console.log(`[Webhook] Shipping Price Created: ${id}`);
    await translateShippingMethod.trigger({ shippingMethodId: id });
  }
  res.status(200).end();
});
