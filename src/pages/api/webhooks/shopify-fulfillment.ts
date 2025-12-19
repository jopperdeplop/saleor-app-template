import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import { shopifyFulfillmentSync } from '@/trigger/shopify-fulfillment-sync';
import { db } from '@/db';
import { integrations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '@/lib/encryption';

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
        const topic = req.headers['x-shopify-topic'];
        const shopDomain = req.headers['x-shopify-shop-domain'];

        console.info(`📡 [Webhook Handler] Incoming: ${topic} | Shop: ${shopDomain}`);

        // 1. Secret Resolution (Global -> Dynamic DB)
        let secret = process.env.SHOPIFY_WEBHOOK_SECRET;

        if (!secret && shopDomain) {
            try {
                if (!process.env.POSTGRES_URL) {
                    console.warn("⚠️ [Webhook Handler] POSTGRES_URL missing. Cannot perform dynamic lookup.");
                } else {
                    const results = await db.select()
                        .from(integrations)
                        .where(eq(integrations.storeUrl, shopDomain.toString()))
                        .limit(1);

                    const integration = results[0];
                    const settings = integration?.settings as any;
                    let candidateSecret = settings?.webhookSecret;

                    if (candidateSecret) {
                        // Attempt to decrypt if it looks like encrypted format (iv:tag:data)
                        if (candidateSecret.includes(':')) {
                            try {
                                secret = decrypt(candidateSecret);
                                console.info(`✅ [Webhook Handler] Verified using decrypted secret for ${shopDomain}`);
                            } catch (e) {
                                console.warn(`⚠️ [Webhook Handler] Decryption failed for ${shopDomain}. Using as plain-text.`);
                                secret = candidateSecret;
                            }
                        } else {
                            secret = candidateSecret;
                            console.info(`ℹ️ [Webhook Handler] Using plain-text secret for ${shopDomain}`);
                        }
                    }
                }
            } catch (dbError: any) {
                console.warn(`⚠️ [Webhook Handler] DB Error: ${dbError.message}. Proceeding unverified.`);
            }
        }

        // 2. HMAC Verification
        if (secret && hmac) {
            const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
            if (hash !== hmac) {
                console.error(`⛔ [Webhook Handler] HMAC mismatch for ${shopDomain}`);
                return res.status(401).send('HMAC verification failed');
            }
        } else if (!secret) {
            console.warn(`⚠️ [Webhook Handler] No secret found for ${shopDomain}. PROCESSING UNVERIFIED (Security Risk).`);
        }

        const payload = JSON.parse(rawBody.toString());

        // 3. Logic Processing
        if (topic === 'fulfillments/create') {
            const shopifyOrderId = payload.order_id?.toString();
            const trackingNumber = payload.tracking_number || (Array.isArray(payload.tracking_numbers) ? payload.tracking_numbers[0] : null);
            const trackingUrl = payload.tracking_url || (Array.isArray(payload.tracking_urls) ? payload.tracking_urls[0] : null);

            if (shopifyOrderId) {
                const handle = await shopifyFulfillmentSync.trigger({
                    shopifyOrderId,
                    trackingNumber: trackingNumber || undefined,
                    trackingUrl: trackingUrl || undefined,
                    vendorStoreUrl: shopDomain?.toString() || ""
                });

                return res.status(200).json({ success: true, handleId: handle.id });
            }
        }

        res.status(200).send('OK');
    } catch (error: any) {
        console.error("❌ [Webhook Handler] Fatal Error:", error);
        res.status(500).send('Internal Error');
    }
}
