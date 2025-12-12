import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";

import {
  OrderCreatedSubscriptionDocument,
  OrderCreatedWebhookPayloadFragment,
} from "@/generated/graphql";
import { createClient } from "@/lib/create-graphq-client";
import { saleorApp } from "@/saleor-app";
import { generateShippingLabel } from "@/trigger/orders";

/**
 * Create abstract Webhook. It decorates handler and performs security checks under the hood.
 *
 * orderCreatedWebhook.getWebhookManifest() must be called in api/manifest too!
 */
export const orderCreatedWebhook = new SaleorAsyncWebhook<OrderCreatedWebhookPayloadFragment>({
  name: "Order Created in Saleor",
  webhookPath: "api/webhooks/order-created",
  event: "ORDER_CREATED",
  apl: saleorApp.apl,
  query: OrderCreatedSubscriptionDocument,
});

// export default orderCreatedWebhook.createHandler(async (req, res, ctx) => {
//   const { payload } = ctx;

export default async function handler(req: any, res: any) {
  console.log("⚡ INCOMING WEBHOOK BODY:", JSON.stringify(req.body, null, 2));
  const payload = req.body;

  // Try all possible paths
  const order = payload.order ||
    payload.event?.order ||
    payload.data?.event?.order ||
    payload.data?.order; // Just in case

  if (order && order.id) {
    console.log(`✅ EXTRACTED ORDER ID: ${order.id} (Number: ${order.number})`);
    console.log(`🚚 Triggering shipping label generation...`);
    try {
      const handle = await generateShippingLabel.trigger({ orderId: order.id });
      console.log(`   🚀 Task Triggered! Handle ID: ${handle.id}`);
    } catch (e) {
      console.error("   ❌ Failed to trigger task:", e);
    }
  } else {
    console.warn("❌ COULD NOT EXTRACT ORDER. Payload keys:", Object.keys(payload));
    if (payload.event) console.log("   payload.event keys:", Object.keys(payload.event));
  }

  /**
   * Inform Saleor that webhook was delivered properly.
   */
  res.status(200).end();
  return;
}

/**
 * Disable body parser for this endpoint, so signature can be verified
 */
export const config = {
  api: {
    bodyParser: true,
  },
};
