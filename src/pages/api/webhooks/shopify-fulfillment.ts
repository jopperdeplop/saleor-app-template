import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { shopifyFulfillmentSync } from '@/trigger/shopify-fulfillment-sync';
import { db } from '@/db';
import { integrations } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const config = {
    api: { bodyParser: false },
};

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
    const chunks = [];
    for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    return Buffer.concat(chunks);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        console.info("🛠️ [Webhook Handler] v3.1 (Select Fix + Logging) - Handler invoked");
        console.info(`   🌍 [Webhook Handler] Environment check: POSTGRES_URL: ${process.env.POSTGRES_URL ? 'PRESENT' : 'MISSING'}, SHOPIFY_WEBHOOK_SECRET: ${process.env.SHOPIFY_WEBHOOK_SECRET ? 'PRESENT' : 'MISSING'}`);

        const rawBody = await getRawBody(req);
        console.info(`   🔍 [Webhook Handler] Raw body length: ${rawBody.length}`);

        const hmac = req.headers['x-shopify-hmac-sha256'];
        const topic = req.headers['x-shopify-topic'];
        const shopDomain = req.headers['x-shopify-shop-domain'];

        console.info(`   📡 [Webhook Handler] Received webhook! Topic: ${topic} | Shop: ${shopDomain} | HMAC: ${hmac ? 'Present' : 'Missing'}`);

        // Secret Check (Global or Dynamic)
        let secret = process.env.SHOPIFY_WEBHOOK_SECRET;

        // If no global secret, try to find one per-vendor in the DB
        if (!secret && shopDomain) {
            try {
                if (!process.env.POSTGRES_URL) {
                    throw new Error("POSTGRES_URL is not defined in environment variables.");
                }

                const results = await db.select()
                    .from(integrations)
                    .where(eq(integrations.storeUrl, shopDomain.toString()))
                    .limit(1);

                const integration = results[0];
                const settings = integration?.settings as any;
                secret = settings?.webhookSecret;

                if (secret) {
                    console.info(`   🔑 [Webhook Handler] Using dynamic secret for store: ${shopDomain}`);
                }
            } catch (dbError: any) {
                console.warn(`   ⚠️ [Webhook Handler] Database Lookup Failed: ${dbError.message}. Proceeding without verification.`);
                // Note: We don't throw here, so the webhook can still trigger the task (unverified)
            }
        }

        if (secret && hmac) {
            const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
            if (hash !== hmac) {
                console.error(`   ⛔ [Webhook Handler] HMAC Verification Failed! Store: ${shopDomain}`);
                return res.status(401).send('HMAC verification failed');
            }
            console.info(`   ✅ [Webhook Handler] HMAC Verified.`);
        } else if (!secret) {
            console.warn(`   ⚠️ [Webhook Handler] No valid secret (Global or DB) found for store ${shopDomain}. Processing unverified.`);
        }

        const payload = JSON.parse(rawBody.toString());
        console.info(`   📝 [Webhook Handler] Payload parsed. Keys: ${Object.keys(payload).join(', ')}`);

        // Topic: fulfillments/create
        if (topic === 'fulfillments/create') {
            const shopifyOrderId = payload.order_id?.toString();
            // Handle both string and array formats for tracking
            const trackingNumber = payload.tracking_number || (Array.isArray(payload.tracking_numbers) ? payload.tracking_numbers[0] : null);
            const trackingUrl = payload.tracking_url || (Array.isArray(payload.tracking_urls) ? payload.tracking_urls[0] : null);

            console.info(`   📦 [Webhook Handler] Data Extracted -> OrderID: ${shopifyOrderId}, Tracking: ${trackingNumber}`);

            if (shopifyOrderId) {
                console.info(`   🚀 [Webhook Handler] Triggering Sync Task for Order #${shopifyOrderId}...`);

                const handle = await shopifyFulfillmentSync.trigger({
                    shopifyOrderId: shopifyOrderId,
                    trackingNumber: trackingNumber || undefined,
                    trackingUrl: trackingUrl || undefined,
                    vendorStoreUrl: shopDomain?.toString() || ""
                });

                console.info(`   ✅ [Webhook Handler] Task Triggered! Handle ID: ${handle.id}`);
                return res.status(200).json({ success: true, handleId: handle.id });
            } else {
                console.warn(`   ⚠️ [Webhook Handler] Missing 'order_id' or 'admin_graphql_api_id' in payload.`);
                return res.status(200).json({ ignored: true, reason: "missing_order_id" });
            }
        } else {
            console.info(`   ℹ️ [Webhook Handler] Ignoring topic: ${topic}`);
        }

        res.status(200).send('Webhook Received');
    } catch (error: any) {
        console.error("   ❌ [Webhook Handler] Handler Error (Full):", error);
        if (error.stack) console.error("   ❌ [Webhook Handler] Error Stack:", error.stack);
        res.status(500).send('Internal Error');
    }
}
