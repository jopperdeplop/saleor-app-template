import { task } from "@trigger.dev/sdk";
import { makeSaleorClient, ORDER_QUERY, UPDATE_ORDER_METADATA } from "../lib/saleor-client";
import crypto from 'crypto';
import { logDebug, OrderLine, normalizeUrl } from "../lib/utils";
import { apl } from "../saleor-app";
import { db } from "../db";
import { integrations, users } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "../lib/encryption";

export const automateMultiVendorFulfillment = task({
    id: "multi-vendor-fulfillment",
    retry: {
        maxAttempts: 3,
        minTimeoutInMs: 5000
    },
    run: async (payload: { orderId: string }) => {
        const orderIdentifier = payload.orderId;
        logDebug(`🏁 [Multi-Vendor] Routing Order: ${orderIdentifier}`);

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

            logDebug(`   🔎 Checking integration for brand: "${vendor}"`);
            const integration = await getVendorIntegration(vendor);

            if (!integration) {
                logDebug(`   ⚠️ No active integration for brand: "${vendor}". Order skipping mirror routing.`);
                continue;
            }
            logDebug(`   ✅ Found ${integration.provider} integration for: "${vendor}"`);

            // B. Mirror Order Logic
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
                    mirrorOrderId = await createMirrorOrderOnLightspeed(integration, order, lines);
                }

                // If this is a new integration or needs secret refresh, we should also trigger an initial sync check
                // but for now we rely on the webhook.


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
    }
});

// --- HELPERS ---

async function ensureShopifyFulfillmentWebhook(integration: any) {
    // 100% Ensure this points to the App project's fulfillment endpoint, NOT the portal.
    const appUrl = process.env.SHOPIFY_WEBHOOK_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://saleor-app-template-seven.vercel.app");
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
    const res = await db.select({
        accessToken: integrations.accessToken,
        storeUrl: integrations.storeUrl,
        provider: integrations.provider,
        settings: integrations.settings,
        brand: users.brand
    })
        .from(integrations)
        .innerJoin(users, eq(integrations.userId, users.id))
        .where(and(eq(users.brand, brand), eq(integrations.status, "active")))
        .limit(1);
    return res[0] as any;
}

async function getLinkedOrderId(order: any, key: string) {
    const meta = order.metadata?.find((m: any) => m.key === key);
    return meta?.value;
}

async function createMirrorOrderOnShopify(integration: any, order: any, lines: any[]) {
    const payload = {
        order: {
            line_items: lines.map(l => ({
                variant_id: l.variant.externalReference ? l.variant.externalReference.split('/').pop() : l.variant.sku,
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

async function ensureWooCommerceWebhook(integration: any) {
    const settings = (integration.settings || {}) as any;
    const consumerKey = integration.accessToken;
    const consumerSecret = settings?.consumerSecret ? decrypt(settings.consumerSecret) : "";

    if (!consumerKey || !consumerSecret) return;

    // 1. Secret Management & URL Normalization
    const normalizedStoreUrl = normalizeUrl(integration.storeUrl);

    // Proactively normalize the URL in the DB if it's not already
    if (integration.storeUrl !== normalizedStoreUrl) {
        logDebug(`      📏 Normalizing Store URL in DB: ${integration.storeUrl} -> ${normalizedStoreUrl}`);
        await db.update(integrations)
            .set({ storeUrl: normalizedStoreUrl })
            .where(eq(integrations.id, integration.id));
    }

    let webhookSecret = settings.webhookSecret;
    let needsSync = settings.webhookSecretSynced !== true;
    let justGenerated = false;

    if (!webhookSecret) {
        logDebug(`      🔐 Generating new WooCommerce Webhook Secret for ${normalizedStoreUrl}...`);
        webhookSecret = crypto.randomBytes(32).toString('hex');
        justGenerated = true;
        needsSync = true;

        // Save back to DB
        await db.update(integrations)
            .set({ settings: { ...settings, webhookSecret, webhookSecretSynced: false } })
            .where(eq(integrations.id, integration.id));
    }

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const appUrl = process.env.SHOPIFY_WEBHOOK_URL || process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://saleor-app-template-seven.vercel.app");
    const webhookUrl = `${appUrl}/api/webhooks/woocommerce-fulfillment`;

    try {
        const listRes = await fetch(`${normalizedStoreUrl}/wp-json/wc/v3/webhooks`, {
            headers: { 'Authorization': `Basic ${auth}` }
        });
        const listJson: any = await listRes.json();
        const topic = "order.updated";
        const existing = Array.isArray(listJson) ? listJson.find((w: any) => w.topic === topic && normalizeUrl(w.delivery_url) === normalizeUrl(webhookUrl)) : null;

        if (!existing || needsSync) {
            if (existing) {
                logDebug(`      🛡️ Syncing WooCommerce webhook secret for ${normalizedStoreUrl}...`);
                await fetch(`${normalizedStoreUrl}/wp-json/wc/v3/webhooks/${existing.id}`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Basic ${auth}`
                    },
                    body: JSON.stringify({
                        secret: webhookSecret
                    })
                });
            } else {
                logDebug(`      🛠️ Registering WooCommerce webhook for ${normalizedStoreUrl}...`);
                await fetch(`${normalizedStoreUrl}/wp-json/wc/v3/webhooks`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Basic ${auth}`
                    },
                    body: JSON.stringify({
                        name: "Marketplace Fulfillment Sync",
                        topic: topic,
                        delivery_url: webhookUrl,
                        status: "active",
                        secret: webhookSecret
                    })
                });
            }

            // Mark as synced in DB
            await db.update(integrations)
                .set({ settings: { ...settings, webhookSecret, webhookSecretSynced: true } })
                .where(eq(integrations.id, integration.id));
            logDebug(`      ✅ Webhook secret confirmed and synced for ${normalizedStoreUrl}.`);
        }
    } catch (e) {
        logDebug(`      ⚠️ Failed to ensure WooCommerce webhook for ${normalizedStoreUrl}: ${e instanceof Error ? e.message : String(e)}`);
    }
}

async function createMirrorOrderOnWooCommerce(integration: any, order: any, lines: any[]) {
    const settings = integration.settings as any;
    const consumerKey = integration.accessToken;
    const consumerSecret = settings?.consumerSecret ? decrypt(settings.consumerSecret) : "";

    if (!consumerKey || !consumerSecret) return null;

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

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
        } : undefined,
        line_items: lines.map(l => {
            const extRef = l.variant?.externalReference || "0";
            const numericId = parseInt(extRef);

            const item: any = {
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
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${auth}`
            },
            body: JSON.stringify(payload)
        });

        const json: any = await res.json();
        if (res.ok && json.id) {
            logDebug(`      ✅ WC Mirror order created: ${json.id}`);
            return json.id.toString();
        } else {
            logDebug(`      ❌ WC Order Creation Failed:`, JSON.stringify(json));
            return null;
        }
    } catch (err: any) {
        logDebug(`      ❌ Network error creating WC order: ${err.message}`);
        return null;
    }
}

async function createMirrorOrderOnLightspeed(integration: any, order: any, lines: any[]) {
    const domainPrefix = integration.storeUrl;

    // Lightspeed X-Series 2.0 Register Sale Payload
    // 1. Fetch available registers if 'default' is not a safe bet
    let registerId = "default";
    try {
        const regRes = await fetch(`https://${domainPrefix}.retail.lightspeed.app/api/2.0/registers`, {
            headers: { 'Authorization': `Bearer ${integration.accessToken}` }
        });
        if (regRes.ok) {
            const regData = await regRes.json();
            if (regData.data?.[0]?.id) {
                registerId = regData.data[0].id;
            }
        }
    } catch (e) {
        logDebug(`      ⚠️ Failed to fetch registers, falling back to 'default'.`);
    }

    // 2. Fetch available users to get a valid UUID for user_id
    let userId = "";
    try {
        const userRes = await fetch(`https://${domainPrefix}.retail.lightspeed.app/api/2.0/users`, {
            headers: { 'Authorization': `Bearer ${integration.accessToken}` }
        });
        if (userRes.ok) {
            const userData = await userRes.json();
            // Try to find primary user, fallback to first user
            const primaryUser = userData.data?.find((u: any) => u.is_primary_user);
            userId = primaryUser?.id || userData.data?.[0]?.id;
        }
    } catch (e) {
        logDebug(`      ⚠️ Failed to fetch users.`);
    }

    if (!userId) {
        logDebug(`      ❌ Could not find a valid user_id for Lightspeed sale creation.`);
        return null;
    }

    // 3. Find or Create Customer
    let customerId = null;
    try {
        const email = order.userEmail;
        if (email) {
            logDebug(`      🔍 Searching for Lightspeed customer: ${email}`);
            const searchRes = await fetch(`https://${domainPrefix}.retail.lightspeed.app/api/2.0/search?type=customers&email=${encodeURIComponent(email)}`, {
                headers: { 'Authorization': `Bearer ${integration.accessToken}` }
            });
            if (searchRes.ok) {
                const searchData = await searchRes.json();
                if (searchData.data?.[0]?.id) {
                    customerId = searchData.data[0].id;
                    logDebug(`      ✅ Found existing customer: ${customerId}`);
                } else {
                    logDebug(`      👤 Creating new customer in Lightspeed...`);
                    const createRes = await fetch(`https://${domainPrefix}.retail.lightspeed.app/api/2.0/customers`, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${integration.accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            first_name: order.shippingAddress?.firstName || "Customer",
                            last_name: order.shippingAddress?.lastName || "Saleor",
                            email: email,
                            physical_address1: order.shippingAddress?.streetAddress1 || "",
                            physical_address2: order.shippingAddress?.streetAddress2 || "",
                            physical_city: order.shippingAddress?.city || "",
                            physical_postcode: order.shippingAddress?.postalCode || "",
                            physical_country_id: order.shippingAddress?.country.code || ""
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

    // 4. Get Payment Type for "Paid" status
    let paymentTypeId = null;
    try {
        const payRes = await fetch(`https://${domainPrefix}.retail.lightspeed.app/api/2.0/payment_types`, {
            headers: { 'Authorization': `Bearer ${integration.accessToken}` }
        });
        if (payRes.ok) {
            const payData = await payRes.json();
            // Prefer "Cash" or "Credit Card" or just the first one
            const target = payData.data?.find((p: any) => p.name.toLowerCase().includes('cash') || p.name.toLowerCase().includes('card')) || payData.data?.[0];
            paymentTypeId = target?.id;
        }
    } catch (e) {
        logDebug(`      ⚠️ Failed to fetch payment types.`);
    }

    const totalAmount = lines.reduce((acc, l) => acc + ((l.unitPrice?.gross?.amount ?? 0) * l.quantity), 0);

    const payload: any = {
        register_id: registerId,
        state: "closed",
        fulfillment_status: "OPEN", // Flags it for the fulfillment workflow
        user_id: userId,
        customer_id: customerId,
        register_sale_products: lines.map(line => ({
            product_id: line.variant?.externalReference || line.variant?.sku,
            quantity: line.quantity,
            price: line.unitPrice?.gross?.amount ?? 0,
            tax: 0,
            tax_id: "default"
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
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${integration.accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const json: any = await res.json();
        const saleId = json.register_sale?.id || json.data?.id;

        if (res.ok && saleId) {
            logDebug(`      ✅ Lightspeed Mirror Sale created: ${saleId} on Register: ${registerId} (Customer: ${customerId || 'N/A'}, Status: Paid)`);
            return saleId.toString();
        } else {
            logDebug(`      ❌ Lightspeed Sale Creation Failed:`, JSON.stringify(json));
            return null;
        }
    } catch (err: any) {
        logDebug(`      ❌ Network error creating Lightspeed sale: ${err.message}`);
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
