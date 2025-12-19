import { NextApiRequest, NextApiResponse } from 'next';
import { db } from '@/db';
import { integrations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '@/lib/encryption';
import { verifyWooCommerceSignature } from '@/lib/woocommerce-verify';

import { woocommerceInventorySync } from '@/trigger/woocommerce-inventory';

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
        const signature = req.headers['x-wc-webhook-signature'] as string;
        const topic = req.headers['x-wc-webhook-topic'] as string;
        const shopUrl = req.headers['x-wc-webhook-source'] as string;

        console.info(`📡 [WC Webhook] Incoming: ${topic} | Source: ${shopUrl}`);

        if (!shopUrl) {
            console.error("❌ Missing x-wc-webhook-source header");
            return res.status(400).send('Missing source header');
        }

        // 1. Resolve Integration & Secret
        const cleanUrl = shopUrl.replace(/\/$/, "");
        const results = await db.select()
            .from(integrations)
            .where(eq(integrations.storeUrl, cleanUrl))
            .limit(1);

        const integration = results[0];
        if (!integration) {
            console.error(`❌ No integration found for store: ${cleanUrl}`);
            return res.status(404).send('Integration not found');
        }

        const settings = integration.settings as any;
        let consumerSecret = '';

        if (settings?.consumerSecret) {
            try {
                consumerSecret = decrypt(settings.consumerSecret);
            } catch (e) {
                console.warn(`⚠️ Decryption failed for ${cleanUrl}.`);
                consumerSecret = settings.consumerSecret;
            }
        }

        // 2. Verification
        const isValid = verifyWooCommerceSignature(rawBody, signature, consumerSecret);
        if (!isValid) {
            console.error(`⛔ [WC Webhook] HMAC mismatch for ${cleanUrl}`);
            return res.status(401).send('HMAC verification failed');
        }

        const payload = JSON.parse(rawBody.toString());

        // 3. Logic Processing (Trigger Sync Tasks)
        if (topic.includes('product.updated') || topic.includes('product.created')) {
            const wcProductId = payload.id;
            const stockStatus = payload.stock_status;
            const stockQuantity = payload.stock_quantity;
            const manageStock = payload.manage_stock;

            if (wcProductId) {
                const handle = await woocommerceInventorySync.trigger({
                    integrationId: integration.id,
                    wcProductId,
                    stockStatus,
                    stockQuantity,
                    manageStock
                });
                console.log(`🚀 Inventory Sync Triggered! Handle ID: ${handle.id}`);
            }
        }

        res.status(200).send('OK');
    } catch (error: any) {
        console.error("❌ [WC Webhook] Fatal Error:", error);
        res.status(500).send('Internal Error');
    }
}
