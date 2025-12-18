import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { shopifyFulfillmentSync } from '@/trigger/shopify-fulfillment-sync';

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
        try {
            const rawBody = await getRawBody(req);
            console.error(`   🔍 [Webhook Handler] Raw body length: ${rawBody.length}`);

            const hmac = req.headers['x-shopify-hmac-sha256'];
            const topic = req.headers['x-shopify-topic'];
            const shopDomain = req.headers['x-shopify-shop-domain'];

            console.error(`   📡 [Webhook Handler] Received webhook! Topic: ${topic} | Shop: ${shopDomain} | HMAC: ${hmac ? 'Present' : 'Missing'}`);

            // Secret Check
            const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
            if (secret && hmac) {
                const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
                if (hash !== hmac) {
                    console.error(`   ⛔ [Webhook Handler] HMAC Verification Failed! Expected: ${hash}, Got: ${hmac}`);
                    return res.status(401).send('HMAC verification failed');
                }
                console.error(`   ✅ [Webhook Handler] HMAC Verified.`);
            } else if (!secret) {
                console.error("   ⚠️ [Webhook Handler] Warning: SHOPIFY_WEBHOOK_SECRET is not set. Proceeding without signature verification.");
            }

            const payload = JSON.parse(rawBody.toString());
            console.error(`   📝 [Webhook Handler] Payload parsed. Keys: ${Object.keys(payload).join(', ')}`);

            // Topic: fulfillments/create
            if (topic === 'fulfillments/create') {
                const shopifyOrderId = payload.order_id?.toString();
                // Handle both string and array formats for tracking
                const trackingNumber = payload.tracking_number || (Array.isArray(payload.tracking_numbers) ? payload.tracking_numbers[0] : null);
                const trackingUrl = payload.tracking_url || (Array.isArray(payload.tracking_urls) ? payload.tracking_urls[0] : null);

                console.error(`   📦 [Webhook Handler] Data Extracted -> OrderID: ${shopifyOrderId}, Tracking: ${trackingNumber}`);

                if (shopifyOrderId) {
                    console.error(`   🚀 [Webhook Handler] Triggering Sync Task for Order #${shopifyOrderId}...`);

                    const handle = await shopifyFulfillmentSync.trigger({
                        shopifyOrderId: shopifyOrderId,
                        trackingNumber: trackingNumber || undefined,
                        trackingUrl: trackingUrl || undefined,
                        vendorStoreUrl: shopDomain?.toString() || ""
                    });

                    console.error(`   ✅ [Webhook Handler] Task Triggered! Handle ID: ${handle.id}`);
                    return res.status(200).json({ success: true, handleId: handle.id });
                } else {
                    console.error(`   ⚠️ [Webhook Handler] Missing 'order_id' or 'admin_graphql_api_id' in payload.`);
                    return res.status(200).json({ ignored: true, reason: "missing_order_id" });
                }
            } else {
                console.error(`   ℹ️ [Webhook Handler] Ignoring topic: ${topic}`);
            }

            res.status(200).send('Webhook Received');
        } catch (error: any) {
            console.error("   ❌ [Webhook Handler] Handler Error:", error.message);
            res.status(500).send('Internal Error');
        }
    }
