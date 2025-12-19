import { NextApiRequest, NextApiResponse } from 'next';
import { woocommerceFulfillmentSync } from '@/trigger/woocommerce-fulfillment-sync';
import { normalizeUrl } from '@/lib/utils';
import { db } from '@/db';
import { integrations, users } from '@/db/schema';
import { eq, sql, or } from 'drizzle-orm';
import crypto from 'crypto';

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

        // 1. Resolve Integration & Secret with Protocol-Agnostic Matching
        const normalizedSource = normalizeUrl(source.toString());
        const cleanSource = normalizedSource.replace(/^(https?:\/\/)?(www\.)?/, "").replace(/\/+$/, "");

        console.info(`🔍 [WC Webhook] Searching for integration with clean domain: ${cleanSource}`);

        const results = await db.select({
            id: integrations.id,
            storeUrl: integrations.storeUrl,
            settings: integrations.settings,
            brandSlug: users.brand
        })
            .from(integrations)
            .innerJoin(users, eq(integrations.userId, users.id))
            .where(sql`LOWER(REPLACE(REPLACE(REPLACE(${integrations.storeUrl}, 'https://', ''), 'http://', ''), 'www.', '')) = ${cleanSource}`)
            .limit(5); // Check for dupes

        if (results.length === 0) {
            console.error(`❌ [WC Webhook] No integration found for domain: ${cleanSource} (Raw Header: ${source})`);
            return res.status(404).json({ error: "Integration not found" });
        }

        if (results.length > 1) {
            console.warn(`⚠️ [WC Webhook] Multiple integrations (${results.length}) found for domain: ${cleanSource}. Using the first one.`);
        }

        const integration = results[0];
        let settings = (integration.settings as any) || {};
        let secret = settings.webhookSecret;
        const brandSlug = integration.brandSlug ? integration.brandSlug.toLowerCase().replace(/[^a-z0-9]/g, '-') : null;

        if (!secret) {
            console.warn(`⚠️ [WC Webhook] Integration found (ID: ${integration.id}) but no secret. Generating and saving one now...`);
            secret = crypto.randomBytes(32).toString('hex');

            // Persist the secret immediately
            await db.update(integrations)
                .set({ settings: { ...settings, webhookSecret: secret } })
                .where(eq(integrations.id, integration.id));

            console.info(`✅ [WC Webhook] Generated and persisted new secret for ID ${integration.id}. Future requests will be verified.`);
            // We still process this one as unverified because the partner store doesn't have this secret yet
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
                    vendorStoreUrl: normalizedSource,
                    brandSlug: brandSlug || undefined
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
