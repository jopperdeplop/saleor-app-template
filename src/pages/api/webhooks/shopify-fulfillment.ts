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
        const rawBody = await getRawBody(req);
        const hmac = req.headers['x-shopify-hmac-sha256'];
        const domain = req.headers['x-shopify-shop-domain'];
        const topic = req.headers['x-shopify-topic'];

        console.log(`\n🔔 [Webhook Handler] Received: ${topic} from ${domain}`);

        // Security verification (Crucial)
        const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
        if (secret && hmac) {
            const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
            if (hash !== hmac) {
                console.error("   ❌ [Webhook Handler] Security: Invalid Shopify HMAC signature");
                return res.status(401).send('Unauthorized');
            }
            console.log("   ✅ [Webhook Handler] HMAC Signature Verified.");
        } else if (!secret) {
            console.warn("   ⚠️ [Webhook Handler] Warning: SHOPIFY_WEBHOOK_SECRET is not set. Proceeding without signature verification.");
        }

        const payload = JSON.parse(rawBody.toString());
        console.log(`   📝 [Webhook Handler] Payload parsed. Shopify Order ID: ${payload.order_id}`);

        // Topic: fulfillments/create
        if (topic === 'fulfillments/create') {
            const shopifyOrderId = payload.order_id?.toString();
            const trackingNumber = payload.tracking_number;
            const trackingUrl = payload.tracking_url;

            if (shopifyOrderId) {
                console.log(`   📦 [Webhook Handler] Fulfillment detected. Triggering Sync Task...`);

                try {
                    const handle = await shopifyFulfillmentSync.trigger({
                        shopifyOrderId,
                        trackingNumber,
                        trackingUrl,
                        vendorStoreUrl: domain as string
                    });
                    console.log(`   🚀 [Webhook Handler] Task Triggered! Handle: ${handle.id}`);
                } catch (triggerError: any) {
                    console.error("   ❌ [Webhook Handler] Failed to trigger Trigger.dev task:", triggerError.message);
                }
            } else {
                console.warn("   ⚠️ [Webhook Handler] Missing order_id in payload.");
            }
        } else {
            console.log(`   ℹ️ [Webhook Handler] Ignoring topic: ${topic}`);
        }

        res.status(200).send('Webhook Received');
    } catch (error: any) {
        console.error("   ❌ [Webhook Handler] Handler Error:", error.message);
        res.status(500).send('Internal Error');
    }
}
