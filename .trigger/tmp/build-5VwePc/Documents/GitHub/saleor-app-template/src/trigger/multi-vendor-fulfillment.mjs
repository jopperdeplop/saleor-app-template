import {
  ORDER_QUERY,
  UPDATE_ORDER_METADATA,
  apl,
  makeSaleorClient
} from "../../../../../chunk-HYDI5HR6.mjs";
import "../../../../../chunk-UHMN67P6.mjs";
import {
  logDebug
} from "../../../../../chunk-JUBDIEYX.mjs";
import {
  and,
  db,
  eq,
  integrations,
  users
} from "../../../../../chunk-DZ7OZDGX.mjs";
import {
  task
} from "../../../../../chunk-ONHLK5E6.mjs";
import "../../../../../chunk-YV5CNPDY.mjs";
import {
  __name,
  init_esm
} from "../../../../../chunk-TQ3WNEB5.mjs";

// src/trigger/multi-vendor-fulfillment.ts
init_esm();
var automateMultiVendorFulfillment = task({
  id: "shopify-generate-shipping-label",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 5e3
  },
  run: /* @__PURE__ */ __name(async (payload) => {
    const orderIdentifier = payload.orderId;
    logDebug(`🔄 [Multi-Vendor] Routing Order to Shopify: ${orderIdentifier}`);
    const apiUrl = process.env.SALEOR_API_URL;
    if (!apiUrl) throw new Error("SALEOR_API_URL missing");
    const authData = await apl.get(apiUrl);
    if (!authData || !authData.token) throw new Error("Saleor Auth Token missing");
    const client = makeSaleorClient(apiUrl, authData.token);
    const { data: orderData } = await client.query(ORDER_QUERY, { id: orderIdentifier }).toPromise();
    const order = orderData?.order;
    if (!order) throw new Error("Order not found");
    const vendorMap = /* @__PURE__ */ new Map();
    for (const line of order.lines) {
      if (!line.variant) continue;
      const vendor = getVendorFromLine(line);
      if (!vendorMap.has(vendor)) vendorMap.set(vendor, []);
      vendorMap.get(vendor).push(line);
    }
    for (const [vendor, lines] of vendorMap) {
      logDebug(`   🏭 Partner: ${vendor}`);
      const integration = await getVendorIntegration(vendor);
      if (!integration) {
        logDebug(`      ⚠️ No active integration for "${vendor}". Skipping mirror order.`);
        continue;
      }
      await ensureShopifyFulfillmentWebhook(integration);
      let shopifyOrderId = await getLinkedShopifyOrderId(order, vendor);
      if (!shopifyOrderId) {
        logDebug(`      🛒 Creating Mirror Order in ${vendor}'s Shopify...`);
        shopifyOrderId = await createMirrorOrderOnShopify(integration, order, lines);
        if (shopifyOrderId) {
          await client.mutation(UPDATE_ORDER_METADATA, {
            id: order.id,
            input: [{ key: `shopify_order_id_${slugify(vendor)}`, value: shopifyOrderId }]
          }).toPromise();
        }
      } else {
        logDebug(`      🔗 Found existing mirror order: ${shopifyOrderId}`);
      }
    }
    return { success: true };
  }, "run")
});
async function ensureShopifyFulfillmentWebhook(integration) {
  const appUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://partner.salp.shop");
  const webhookUrl = `${appUrl}/api/webhooks/shopify-fulfillment`;
  const topic = "fulfillments/create";
  try {
    const listRes = await fetch(`https://${integration.storeUrl}/admin/api/2024-04/webhooks.json`, {
      headers: { "X-Shopify-Access-Token": integration.accessToken, "Accept": "application/json" }
    });
    const listJson = await listRes.json();
    const existing = listJson.webhooks?.find((w) => w.topic === topic);
    if (existing) {
      if (existing.address === webhookUrl) {
        return;
      }
      logDebug(`      🔄 Updating Shopify webhook for ${integration.storeUrl}...`);
      await fetch(`https://${integration.storeUrl}/admin/api/2024-04/webhooks/${existing.id}.json`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": integration.accessToken
        },
        body: JSON.stringify({ webhook: { id: existing.id, address: webhookUrl } })
      });
    } else {
      logDebug(`      🛠️ Registering new fulfillment webhook for ${integration.storeUrl}...`);
      await fetch(`https://${integration.storeUrl}/admin/api/2024-04/webhooks.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": integration.accessToken
        },
        body: JSON.stringify({
          webhook: {
            topic,
            address: webhookUrl,
            format: "json",
            fields: ["order_id", "tracking_number", "tracking_urls"]
          }
        })
      });
    }
  } catch (e) {
    logDebug(`      ⚠️ Failed to ensure Shopify webhook for ${integration.storeUrl}. Manual setup may be needed.`);
  }
}
__name(ensureShopifyFulfillmentWebhook, "ensureShopifyFulfillmentWebhook");
async function getVendorIntegration(brand) {
  const res = await db.select({ accessToken: integrations.accessToken, storeUrl: integrations.storeUrl }).from(integrations).innerJoin(users, eq(integrations.userId, users.id)).where(and(eq(users.brand, brand), eq(integrations.status, "active"))).limit(1);
  return res[0];
}
__name(getVendorIntegration, "getVendorIntegration");
async function getLinkedShopifyOrderId(order, vendor) {
  const meta = order.metadata?.find((m) => m.key === `shopify_order_id_${slugify(vendor)}`);
  return meta?.value;
}
__name(getLinkedShopifyOrderId, "getLinkedShopifyOrderId");
async function createMirrorOrderOnShopify(integration, order, lines) {
  const payload = {
    order: {
      line_items: lines.map((l) => ({
        variant_id: l.variant.externalReference?.split("/").pop() || l.variant.sku,
        quantity: l.quantity,
        title: l.productName
      })),
      customer: {
        first_name: order.shippingAddress?.firstName || "Customer",
        last_name: order.shippingAddress?.lastName || "",
        email: order.userEmail
      },
      shipping_address: order.shippingAddress ? {
        first_name: order.shippingAddress.firstName,
        last_name: order.shippingAddress.lastName,
        address1: order.shippingAddress.streetAddress1,
        address2: order.shippingAddress.streetAddress2,
        city: order.shippingAddress.city,
        zip: order.shippingAddress.postalCode,
        country_code: order.shippingAddress.country.code,
        phone: order.shippingAddress.phone || "0000000000"
      } : void 0,
      financial_status: "paid",
      tags: "Marketplace-Order"
    }
  };
  try {
    const res = await fetch(`https://${integration.storeUrl}/admin/api/2024-04/orders.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-Shopify-Access-Token": integration.accessToken
      },
      body: JSON.stringify(payload)
    });
    const text = await res.text();
    if (res.ok) {
      const json = JSON.parse(text);
      logDebug(`      ✅ Mirror order created: ${json.order.id}`);
      return json.order.id.toString();
    } else {
      logDebug(`      ❌ Shopify Order Creation Failed:`, text);
      return null;
    }
  } catch (err) {
    logDebug(`      ❌ Network error creating Shopify order: ${err.message}`);
    return null;
  }
}
__name(createMirrorOrderOnShopify, "createMirrorOrderOnShopify");
function getVendorFromLine(line) {
  const brandAttr = line.variant?.product?.attributes?.find((a) => a.attribute.slug === "brand");
  return brandAttr?.values[0]?.name || "Unknown";
}
__name(getVendorFromLine, "getVendorFromLine");
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "_");
}
__name(slugify, "slugify");
export {
  automateMultiVendorFulfillment
};
//# sourceMappingURL=multi-vendor-fulfillment.mjs.map
