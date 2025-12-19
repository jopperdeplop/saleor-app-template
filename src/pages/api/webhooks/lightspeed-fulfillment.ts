
import { NextApiRequest, NextApiResponse } from 'next';
import { lightspeedFulfillmentSync } from '@/trigger/lightspeed-fulfillment-sync';
import { db } from '@/db';
import { integrations } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { decrypt } from '@/lib/encryption';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const { secret: providedSecret } = req.query;
        const payload = req.body;
        const topic = payload.type;
        const domainPrefix = payload.retailer_id;

        console.info(`📡 [Lightspeed Webhook] Incoming: ${topic} | Retailer: ${domainPrefix}`);

        // --- SECURITY: Domain-based Secret Verification ---
        if (!domainPrefix || !providedSecret) {
            console.error("⛔ [Lightspeed Webhook] Missing retailer_id or secret parameter.");
            return res.status(401).send('Unauthorized');
        }

        const results = await db.select()
            .from(integrations)
            .where(eq(integrations.storeUrl, domainPrefix.toString().toLowerCase()))
            .limit(1);

        const integration = results[0];
        if (!integration) {
            console.error(`❌ [Lightspeed Webhook] No integration found for retailer: ${domainPrefix}`);
            return res.status(401).send('Unauthorized');
        }

        const settings = integration.settings as any;
        const encryptedSecret = settings?.webhookSecret;

        if (!encryptedSecret) {
            console.warn(`⚠️ [Lightspeed Webhook] No secret stored for ${domainPrefix}. Proceeding unverified if testing.`);
        } else {
            const actualSecret = decrypt(encryptedSecret);
            if (providedSecret !== actualSecret) {
                console.error(`⛔ [Lightspeed Webhook] Secret mismatch for ${domainPrefix}`);
                return res.status(401).send('Unauthorized');
            }
            console.info(`✅ [Lightspeed Webhook] Secret verified for ${domainPrefix}`);
        }

        // Logic Processing
        if (topic === 'sale.update') {
            const sale = payload.data;
            const saleId = sale.id?.toString();

            // In Lightspeed, fulfillment status might be in register_sale_attributes or state
            // For now, we trigger the sync task to fetch full details and update Saleor
            if (saleId) {
                const handle = await lightspeedFulfillmentSync.trigger({
                    lightspeedOrderId: saleId,
                    vendorStoreUrl: domainPrefix || ""
                });

                return res.status(200).json({ success: true, handleId: handle.id });
            }
        }

        res.status(200).send('OK');
    } catch (error: any) {
        console.error("❌ [Lightspeed Webhook Handler] Error:", error);
        res.status(500).send('Internal Error');
    }
}
