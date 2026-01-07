import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import { saleorApp } from "@/saleor-app";
import { translateProduct } from "@/trigger/translate-product";

export const productCreatedWebhook = new SaleorAsyncWebhook<{ product: { id: string } }>({
  name: "Product Created",
  webhookPath: "api/webhooks/product-created",
  event: "PRODUCT_CREATED",
  apl: saleorApp.apl,
  query: `subscription { event { ... on ProductCreated { product { id } } } }`,
});

export default productCreatedWebhook.createHandler(async (req, res, ctx) => {
  const { event, payload } = ctx;
  
  if (payload.product?.id) {
    console.log(`[Webhook] Product Created: ${payload.product.id}`);
    await translateProduct.trigger({ productId: payload.product.id });
  }

  res.status(200).end();
});
