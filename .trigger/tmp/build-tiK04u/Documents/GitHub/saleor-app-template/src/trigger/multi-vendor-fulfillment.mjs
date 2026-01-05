import {
  decrypt
} from "../../../../../chunk-HVB7L227.mjs";
import {
  apl,
  logDebug,
  normalizeUrl
} from "../../../../../chunk-Y5F4RJXU.mjs";
import {
  and,
  db,
  eq,
  integrations,
  users
} from "../../../../../chunk-KC6DVKSX.mjs";
import {
  ORDER_QUERY,
  UPDATE_ORDER_METADATA,
  makeSaleorClient
} from "../../../../../chunk-DLK7GY2S.mjs";
import "../../../../../chunk-L34HRTRG.mjs";
import {
  task
} from "../../../../../chunk-ENJ6DR3G.mjs";
import "../../../../../chunk-DEKBIM76.mjs";
import {
  __name,
  init_esm
} from "../../../../../chunk-CEGEFIIW.mjs";

// src/trigger/multi-vendor-fulfillment.ts
init_esm();
import crypto from "crypto";
var automateMultiVendorFulfillment = task({
  id: "multi-vendor-fulfillment",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 5e3
  },
  run: /* @__PURE__ */ __name(async (payload) => {
    const orderIdentifier = payload.orderId;
    logDebug(`🏁 [Multi-Vendor] Routing Order: ${orderIdentifier}`);
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
      logDebug(`   🔎 Checking integration for brand: "${vendor}"`);
      const integration = await getVendorIntegration(vendor);
      if (!integration) {
        logDebug(`   ⚠️ No active integration for brand: "${vendor}". Order skipping mirror routing.`);
        continue;
      }
      logDebug(`   ✅ Found ${integration.provider} integration for: "${vendor}"`);
      const provider = integration.provider;
      const metaKey = `${provider}_order_id_${slugify(vendor)}`;
      let mirrorOrderId = await getLinkedOrderId(order, metaKey);
      if (!mirrorOrderId) {
        logDebug(`      🛒 Creating Mirror Order in ${vendor}'s ${provider}...`);
        if (provider === "shopify") {
          await ensureShopifyFulfillmentWebhook(integration);
          mirrorOrderId = await createMirrorOrderOnShopify(integration, order, lines);
        } else if (provider === "woocommerce") {
          await ensureWooCommerceWebhook(integration);
          mirrorOrderId = await createMirrorOrderOnWooCommerce(integration, order, lines);
        } else if (provider === "lightspeed") {
          await ensureLightspeedWebhook(integration);
          mirrorOrderId = await createMirrorOrderOnLightspeed(integration, order, lines);
        }
        if (mirrorOrderId) {
          await client.mutation(UPDATE_ORDER_METADATA, {
            id: order.id,
            input: [{ key: metaKey, value: mirrorOrderId }]
          }).toPromise();
        }
      } else {
        logDebug(`      🔗 Found existing mirror order: ${mirrorOrderId}`);
      }
    }
    return { success: true };
  }, "run")
});
async function ensureShopifyFulfillmentWebhook(integration) {
  const appUrl = process.env.SHOPIFY_WEBHOOK_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://saleor-app-template-seven.vercel.app");
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
  const res = await db.select({
    accessToken: integrations.accessToken,
    storeUrl: integrations.storeUrl,
    provider: integrations.provider,
    settings: integrations.settings,
    brand: users.brand
  }).from(integrations).innerJoin(users, eq(integrations.userId, users.id)).where(and(eq(users.brand, brand), eq(integrations.status, "active"))).limit(1);
  return res[0];
}
__name(getVendorIntegration, "getVendorIntegration");
async function getLinkedOrderId(order, key) {
  const meta = order.metadata?.find((m) => m.key === key);
  return meta?.value;
}
__name(getLinkedOrderId, "getLinkedOrderId");
async function createMirrorOrderOnShopify(integration, order, lines) {
  const payload = {
    order: {
      line_items: lines.map((l) => ({
        variant_id: l.variant.externalReference ? l.variant.externalReference.split("/").pop() : l.variant.sku,
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
async function ensureWooCommerceWebhook(integration) {
  const settings = integration.settings || {};
  const consumerKey = integration.accessToken;
  const consumerSecret = settings?.consumerSecret ? decrypt(settings.consumerSecret) : "";
  if (!consumerKey || !consumerSecret) return;
  const normalizedStoreUrl = normalizeUrl(integration.storeUrl);
  if (integration.storeUrl !== normalizedStoreUrl) {
    logDebug(`      📏 Normalizing Store URL in DB: ${integration.storeUrl} -> ${normalizedStoreUrl}`);
    await db.update(integrations).set({ storeUrl: normalizedStoreUrl }).where(eq(integrations.id, integration.id));
  }
  let webhookSecret = settings.webhookSecret;
  let needsSync = settings.webhookSecretSynced !== true;
  let justGenerated = false;
  if (!webhookSecret) {
    logDebug(`      🔐 Generating new WooCommerce Webhook Secret for ${normalizedStoreUrl}...`);
    webhookSecret = crypto.randomBytes(32).toString("hex");
    justGenerated = true;
    needsSync = true;
    await db.update(integrations).set({ settings: { ...settings, webhookSecret, webhookSecretSynced: false } }).where(eq(integrations.id, integration.id));
  }
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const appUrl = process.env.SHOPIFY_WEBHOOK_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://saleor-app-template-seven.vercel.app");
  const webhookUrl = `${appUrl}/api/webhooks/woocommerce-fulfillment`;
  try {
    const listRes = await fetch(`${normalizedStoreUrl}/wp-json/wc/v3/webhooks`, {
      headers: { "Authorization": `Basic ${auth}` }
    });
    const listJson = await listRes.json();
    const topic = "order.updated";
    const existing = Array.isArray(listJson) ? listJson.find((w) => w.topic === topic && normalizeUrl(w.delivery_url) === normalizeUrl(webhookUrl)) : null;
    if (!existing || needsSync) {
      if (existing) {
        logDebug(`      🛡️ Syncing WooCommerce webhook secret for ${normalizedStoreUrl}...`);
        await fetch(`${normalizedStoreUrl}/wp-json/wc/v3/webhooks/${existing.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${auth}`
          },
          body: JSON.stringify({
            secret: webhookSecret
          })
        });
      } else {
        logDebug(`      🛠️ Registering WooCommerce webhook for ${normalizedStoreUrl}...`);
        await fetch(`${normalizedStoreUrl}/wp-json/wc/v3/webhooks`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Basic ${auth}`
          },
          body: JSON.stringify({
            name: "Marketplace Fulfillment Sync",
            topic,
            delivery_url: webhookUrl,
            status: "active",
            secret: webhookSecret
          })
        });
      }
      await db.update(integrations).set({ settings: { ...settings, webhookSecret, webhookSecretSynced: true } }).where(eq(integrations.id, integration.id));
      logDebug(`      ✅ Webhook secret confirmed and synced for ${normalizedStoreUrl}.`);
    }
  } catch (e) {
    logDebug(`      ⚠️ Failed to ensure WooCommerce webhook for ${normalizedStoreUrl}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
__name(ensureWooCommerceWebhook, "ensureWooCommerceWebhook");
async function ensureLightspeedWebhook(integration) {
  const settings = integration.settings || {};
  const webhookSecret = settings.webhookSecret ? decrypt(settings.webhookSecret) : "";
  if (!webhookSecret) return;
  const appUrl = process.env.SHOPIFY_WEBHOOK_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://saleor-app-template-seven.vercel.app");
  const webhookUrl = `${appUrl}/api/webhooks/lightspeed-fulfillment?secret=${webhookSecret}`;
  try {
    const listRes = await fetch(`https://${integration.storeUrl}.retail.lightspeed.app/api/webhooks`, {
      headers: { "Authorization": `Bearer ${integration.accessToken}` }
    });
    if (!listRes.ok) {
      const listErr = await listRes.text();
      logDebug(`      ❌ Failed to list Lightspeed webhooks: ${listRes.status} ${listErr}`);
      return;
    }
    const listJson = await listRes.json();
    const topic = "sale.update";
    const existing = Array.isArray(listJson) ? listJson.find((w) => w.type === topic) : null;
    if (existing) {
      if (existing.url === webhookUrl) {
        return;
      }
      logDebug(`      🔄 Updating Lightspeed webhook for ${integration.storeUrl}...`);
      const upRes = await fetch(`https://${integration.storeUrl}.retail.lightspeed.app/api/webhooks/${existing.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${integration.accessToken}`
        },
        body: JSON.stringify({ active: true, url: webhookUrl })
      });
      if (!upRes.ok) {
        const upErr = await upRes.text();
        logDebug(`      ❌ Failed to update Lightspeed webhook: ${upRes.status} ${upErr}`);
      }
    } else {
      logDebug(`      🛠️ Registering new Lightspeed webhook for ${integration.storeUrl}...`);
      const regRes = await fetch(`https://${integration.storeUrl}.retail.lightspeed.app/api/webhooks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${integration.accessToken}`
        },
        body: JSON.stringify({
          active: true,
          type: topic,
          url: webhookUrl
        })
      });
      if (!regRes.ok) {
        const regErr = await regRes.text();
        logDebug(`      ❌ Failed to register Lightspeed webhook: ${regRes.status} ${regErr}`);
      } else {
        logDebug(`      ✅ Lightspeed webhook [${topic}] registered successfully.`);
      }
    }
  } catch (e) {
    logDebug(`      ⚠️ Failed to ensure Lightspeed webhook for ${integration.storeUrl}: ${e instanceof Error ? e.message : String(e)}`);
  }
}
__name(ensureLightspeedWebhook, "ensureLightspeedWebhook");
async function createMirrorOrderOnWooCommerce(integration, order, lines) {
  const settings = integration.settings;
  const consumerKey = integration.accessToken;
  const consumerSecret = settings?.consumerSecret ? decrypt(settings.consumerSecret) : "";
  if (!consumerKey || !consumerSecret) return null;
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const payload = {
    payment_method: "other",
    payment_method_title: "Marketplace Proxy",
    set_paid: true,
    billing: {
      first_name: order.billingAddress?.firstName || order.shippingAddress?.firstName || "Customer",
      last_name: order.billingAddress?.lastName || order.shippingAddress?.lastName || "",
      address_1: order.billingAddress?.streetAddress1 || order.shippingAddress?.streetAddress1 || "",
      city: order.billingAddress?.city || order.shippingAddress?.city || "",
      postcode: order.billingAddress?.postalCode || order.shippingAddress?.postalCode || "",
      country: order.billingAddress?.country.code || order.shippingAddress?.country.code || "US",
      email: order.userEmail
    },
    shipping: order.shippingAddress ? {
      first_name: order.shippingAddress.firstName,
      last_name: order.shippingAddress.lastName,
      address_1: order.shippingAddress.streetAddress1,
      city: order.shippingAddress.city,
      postcode: order.shippingAddress.postalCode,
      country: order.shippingAddress.country.code
    } : void 0,
    line_items: lines.map((l) => {
      const extRef = l.variant?.externalReference || "0";
      const numericId = parseInt(extRef);
      const item = {
        product_id: parseInt(l.variant?.product?.externalReference || "0"),
        quantity: l.quantity
      };
      if (l.variant?.name !== "Default" && !isNaN(numericId) && numericId > 0) {
        item.variation_id = numericId;
      }
      return item;
    }),
    customer_note: `Marketplace Order: ${order.number}`
  };
  try {
    const res = await fetch(`${integration.storeUrl}/wp-json/wc/v3/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Basic ${auth}`
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (res.ok && json.id) {
      logDebug(`      ✅ WC Mirror order created: ${json.id}`);
      return json.id.toString();
    } else {
      logDebug(`      ❌ WC Order Creation Failed:`, JSON.stringify(json));
      return null;
    }
  } catch (err) {
    logDebug(`      ❌ Network error creating WC order: ${err.message}`);
    return null;
  }
}
__name(createMirrorOrderOnWooCommerce, "createMirrorOrderOnWooCommerce");
async function createMirrorOrderOnLightspeed(integration, order, lines) {
  const domainPrefix = integration.storeUrl;
  let registerId = "default";
  try {
    const regRes = await fetch(`https://${domainPrefix}.retail.lightspeed.app/api/2.0/registers`, {
      headers: { "Authorization": `Bearer ${integration.accessToken}` }
    });
    if (regRes.ok) {
      const regData = await regRes.json();
      const preferred = regData.data?.find(
        (r) => r.name.toLowerCase().includes("main") || r.name.toLowerCase().includes("web") || r.name.toLowerCase().includes("ecommerce")
      );
      registerId = preferred?.id || regData.data?.[0]?.id || "default";
    }
  } catch (e) {
    logDebug(`      ⚠️ Failed to fetch registers, falling back to 'default'.`);
  }
  let userId = "";
  try {
    const userRes = await fetch(`https://${domainPrefix}.retail.lightspeed.app/api/2.0/users`, {
      headers: { "Authorization": `Bearer ${integration.accessToken}` }
    });
    if (userRes.ok) {
      const userData = await userRes.json();
      const primaryUser = userData.data?.find((u) => u.is_primary_user);
      userId = primaryUser?.id || userData.data?.[0]?.id;
    }
  } catch (e) {
    logDebug(`      ⚠️ Failed to fetch users.`);
  }
  if (!userId) {
    logDebug(`      ❌ Could not find a valid user_id for Lightspeed sale creation.`);
    return null;
  }
  let customerId = null;
  try {
    const email = order.userEmail;
    if (email) {
      logDebug(`      🔍 Searching for Lightspeed customer: ${email}`);
      const searchRes = await fetch(`https://${domainPrefix}.retail.lightspeed.app/api/2.0/search?type=customers&email=${encodeURIComponent(email)}`, {
        headers: { "Authorization": `Bearer ${integration.accessToken}` }
      });
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        if (searchData.data?.[0]?.id) {
          customerId = searchData.data[0].id;
          logDebug(`      ✅ Found existing customer: ${customerId}`);
        } else {
          logDebug(`      👤 Creating new customer in Lightspeed...`);
          const createRes = await fetch(`https://${domainPrefix}.retail.lightspeed.app/api/2.0/customers`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${integration.accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              first_name: order.shippingAddress?.firstName || "Customer",
              last_name: order.shippingAddress?.lastName || "Saleor",
              email,
              physical_address1: order.shippingAddress?.streetAddress1 || "",
              physical_address2: order.shippingAddress?.streetAddress2 || "",
              physical_city: order.shippingAddress?.city || "",
              physical_postcode: order.shippingAddress?.postalCode || "",
              physical_country_id: order.shippingAddress?.country.code || "",
              postal_address1: order.shippingAddress?.streetAddress1 || "",
              postal_address2: order.shippingAddress?.streetAddress2 || "",
              postal_city: order.shippingAddress?.city || "",
              postal_postcode: order.shippingAddress?.postalCode || "",
              postal_country_id: order.shippingAddress?.country.code || ""
            })
          });
          if (createRes.ok) {
            const createData = await createRes.json();
            customerId = createData.data?.id;
            logDebug(`      ✅ Created customer: ${customerId} with physical address`);
          }
        }
      }
    }
  } catch (e) {
    logDebug(`      ⚠️ Failed to sync customer.`);
  }
  let paymentTypeId = null;
  try {
    const payRes = await fetch(`https://${domainPrefix}.retail.lightspeed.app/api/2.0/payment_types`, {
      headers: { "Authorization": `Bearer ${integration.accessToken}` }
    });
    if (payRes.ok) {
      const payData = await payRes.json();
      const target = payData.data?.find(
        (p) => p.name.toLowerCase().includes("saleor") || p.name.toLowerCase().includes("marketplace") || p.name.toLowerCase().includes("online") || p.name.toLowerCase().includes("card")
      ) || payData.data?.[0];
      paymentTypeId = target?.id;
    }
  } catch (e) {
    logDebug(`      ⚠️ Failed to fetch payment types.`);
  }
  const totalAmount = lines.reduce((acc, l) => acc + (l.unitPrice?.gross?.amount ?? 0) * l.quantity, 0);
  const payload = {
    register_id: registerId,
    state: "parked",
    // Ensures the sale stays open for fulfillment
    fulfillment_status: "OPEN",
    // Top-level flag for 0.9 web sales
    is_web_order: true,
    // Top-level flag for 0.9 web sales
    user_id: userId,
    customer_id: customerId,
    register_sale_products: lines.map((line) => ({
      product_id: line.variant?.externalReference || line.variant?.sku,
      quantity: line.quantity,
      price: line.unitPrice?.gross?.amount ?? 0,
      tax: 0
    })),
    note: `Saleor Order: ${order.number}`
  };
  if (paymentTypeId) {
    payload.register_sale_payments = [{
      retailer_payment_type_id: paymentTypeId,
      amount: totalAmount
    }];
  }
  try {
    logDebug(`      📡 Sending payload to Lightspeed 0.9 API: /api/register_sales`);
    const res = await fetch(`https://${domainPrefix}.retail.lightspeed.app/api/register_sales`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${integration.accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    const saleId = json.register_sale?.id || json.data?.id;
    if (res.ok && saleId) {
      logDebug(`      ✅ Lightspeed Mirror Sale created: ${saleId} on Register: ${registerId} (Customer: ${customerId || "N/A"}, Status: Paid)`);
      return saleId.toString();
    } else {
      logDebug(`      ❌ Lightspeed Sale Creation Failed:`, JSON.stringify(json));
      return null;
    }
  } catch (err) {
    logDebug(`      ❌ Network error creating Lightspeed sale: ${err.message}`);
    return null;
  }
}
__name(createMirrorOrderOnLightspeed, "createMirrorOrderOnLightspeed");
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
