import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { woocommerceFulfillmentSync } from '@/trigger/woocommerce-fulfillment-sync';
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
        const rawBody = await getRawBody(req);
        const topic = req.headers['x-wc-webhook-topic'];
        const signature = req.headers['x-wc-webhook-signature'];
        const source = req.headers['x-wc-webhook-source']; // Hostname of the store

        console.info(`📡 [WC Webhook] Incoming: ${topic} | Source: ${source}`);

        if (!source || !signature) {
            console.error("⛔ [WC Webhook] Missing signature or source headers.");
            return res.status(401).send('Unauthorized');
        }

        // 1. Resolve Secret from DB
        const results = await db.select()
            .from(integrations)
            .where(eq(integrations.storeUrl, source.toString().replace(/\/$/, "")))
            .limit(1);

        const integration = results[0];
        const secret = (integration?.settings as any)?.webhookSecret;

        if (!secret) {
            console.warn(`⚠️ [WC Webhook] No secret found for ${source}. Processing unverified.`);
        } else {
            // 2. HMAC Verification
            const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
            if (hash !== signature) {
                console.error(`⛔ [WC Webhook] Signature mismatch for ${source}`);
                return res.status(401).send('Signature verification failed');
            }
            console.info(`✅ [WC Webhook] Signature verified for ${source}`);
        }

        const payload = JSON.parse(rawBody.toString());

        // 3. Status Processing
        if (topic === 'order.updated') {
            const status = payload.status;
            const wcOrderId = payload.id?.toString();

            if (status === 'completed' && wcOrderId) {
                const trackingNumber = payload.shipping_lines?.[0]?.instance_id || null;

                const handle = await woocommerceFulfillmentSync.trigger({
                    woocommerceOrderId: wcOrderId,
                    trackingNumber: trackingNumber || undefined,
                    vendorStoreUrl: source.toString()
                });

                return res.status(200).json({ success: true, handleId: handle.id });
            }
        }

        res.status(200).send('OK');
    } catch (error: any) {
        console.error("❌ [WC Webhook] Fatal Error:", error);
        res.status(500).send('Internal Error');
    }
}
