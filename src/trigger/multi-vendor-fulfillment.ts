import { task } from "@trigger.dev/sdk";
import { makeSaleorClient, ORDER_QUERY, UPDATE_ORDER_METADATA } from "../lib/saleor-client";
import { logDebug, OrderLine } from "../lib/utils";
import { apl } from "../saleor-app";
import { db } from "../db";
import { integrations, users } from "../db/schema";
import { eq, and } from "drizzle-orm";

export const automateMultiVendorFulfillment = task({
    id: "shopify-generate-shipping-label",
    retry: {
        maxAttempts: 3,
        minTimeoutInMs: 5000
    },
    run: async (payload: { orderId: string }) => {
        const orderIdentifier = payload.orderId;
        logDebug(`🔄 [Multi-Vendor] Routing Order to Shopify: ${orderIdentifier}`);

        // 1. Setup Saleor Context
        const apiUrl = process.env.SALEOR_API_URL;
        if (!apiUrl) throw new Error("SALEOR_API_URL missing");
        const authData = await apl.get(apiUrl);
        if (!authData || !authData.token) throw new Error("Saleor Auth Token missing");
        const client = makeSaleorClient(apiUrl, authData.token);

        // 2. Fetch Order Details
        const { data: orderData } = await client.query(ORDER_QUERY, { id: orderIdentifier }).toPromise();
        const order = orderData?.order;
        if (!order) throw new Error("Order not found");

        // 3. Group by Brand (Vendor)
        const vendorMap = new Map<string, OrderLine[]>();
        for (const line of order.lines) {
            if (!line.variant) continue;
            const vendor = getVendorFromLine(line);
            if (!vendorMap.has(vendor)) vendorMap.set(vendor, []);
            vendorMap.get(vendor)!.push(line);
        }

        // 4. Process each Vendor Loop
        for (const [vendor, lines] of vendorMap) {
            logDebug(`   🏭 Partner: ${vendor}`);

            // A. Find Vendor Integration
            const integration = await getVendorIntegration(vendor);
            if (!integration) {
                logDebug(`      ⚠️ No active integration for "${vendor}". Skipping mirror order.`);
                continue;
            }

            // AUTO-REGISTER WEBHOOK (Zero-Touch Onboarding)
            // This ensures we get notified when the vendor ships the order without them having to do anything.
            await ensureShopifyFulfillmentWebhook(integration);

            // B. Mirror Order Logic
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
    }
});

// --- HELPERS ---

async function ensureShopifyFulfillmentWebhook(integration: any) {
    const appUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://partner.salp.shop");
    const webhookUrl = `${appUrl}/api/webhooks/shopify-fulfillment`;
    const topic = "fulfillments/create";

    try {
        // 1. Check existing webhooks
        const listRes = await fetch(`https://${integration.storeUrl}/admin/api/2024-04/webhooks.json`, {
            headers: { 'X-Shopify-Access-Token': integration.accessToken, 'Accept': 'application/json' }
        });
        const listJson: any = await listRes.json();
        const existing = listJson.webhooks?.find((w: any) => w.topic === topic);

        if (existing) {
            if (existing.address === webhookUrl) {
                return; // Already registered correctly
            }
            logDebug(`      🔄 Updating Shopify webhook for ${integration.storeUrl}...`);
            // Update existing if URL changed
            await fetch(`https://${integration.storeUrl}/admin/api/2024-04/webhooks/${existing.id}.json`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': integration.accessToken
                },
                body: JSON.stringify({ webhook: { id: existing.id, address: webhookUrl } })
            });
        } else {
            logDebug(`      🛠️ Registering new fulfillment webhook for ${integration.storeUrl}...`);
            // Create new
            await fetch(`https://${integration.storeUrl}/admin/api/2024-04/webhooks.json`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': integration.accessToken
                },
                body: JSON.stringify({
                    webhook: {
                        topic: topic,
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

async function getVendorIntegration(brand: string) {
    const res = await db.select({ accessToken: integrations.accessToken, storeUrl: integrations.storeUrl })
        .from(integrations)
        .innerJoin(users, eq(integrations.userId, users.id))
        .where(and(eq(users.brand, brand), eq(integrations.status, "active")))
        .limit(1);
    return res[0];
}

async function getLinkedShopifyOrderId(order: any, vendor: string) {
    const meta = order.metadata?.find((m: any) => m.key === `shopify_order_id_${slugify(vendor)}`);
    return meta?.value;
}

async function createMirrorOrderOnShopify(integration: any, order: any, lines: any[]) {
    const payload = {
        order: {
            line_items: lines.map(l => ({
                variant_id: l.variant.externalReference?.split('/').pop() || l.variant.sku,
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
            } : undefined,
            financial_status: "paid",
            tags: "Marketplace-Order"
        }
    };

    try {
        const res = await fetch(`https://${integration.storeUrl}/admin/api/2024-04/orders.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'X-Shopify-Access-Token': integration.accessToken
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
    } catch (err: any) {
        logDebug(`      ❌ Network error creating Shopify order: ${err.message}`);
        return null;
    }
}

function getVendorFromLine(line: any): string {
    const brandAttr = line.variant?.product?.attributes?.find((a: any) => a.attribute.slug === "brand");
    return brandAttr?.values[0]?.name || "Unknown";
}

function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]/g, '_');
}
