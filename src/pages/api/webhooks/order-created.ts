import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";

import {
  OrderCreatedSubscriptionDocument,
  OrderCreatedWebhookPayloadFragment,
} from "@/generated/graphql";
import { createClient } from "@/lib/create-graphq-client";
import { saleorApp } from "@/saleor-app";
import { automateMultiVendorFulfillment } from "@/trigger/multi-vendor-fulfillment";

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

// This handler automatically verifies the Saleor-Signature header
export default orderCreatedWebhook.createHandler(async (req, res, ctx) => {
  const { payload } = ctx;

  console.log("⚡ [Saleor Webhook] Verified Order Created:", payload.order?.id);

  const order = payload.order;

  if (order && order.id) {
    try {
      // Use Order ID as idempotency key to prevent duplicate runs
      const handle = await automateMultiVendorFulfillment.trigger(
        { orderId: order.id },
        { idempotencyKey: order.id }
      );
      console.log(`   🚀 [Saleor Webhook] Task Triggered! Handle ID: ${handle.id}`);
      return res.status(200).json({ success: true });
    } catch (e) {
      console.error("   ❌ [Saleor Webhook] Trigger failed:", e);
      return res.status(500).json({ error: "Trigger failed" });
    }
  }

  res.status(400).json({ error: "Missing order data" });
});

export const config = {
  api: {
    bodyParser: false, // Must be false for signature verification
  },
};
