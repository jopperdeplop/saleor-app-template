import { NextApiRequest, NextApiResponse } from 'next';
import { woocommerceFulfillmentSync } from '@/trigger/woocommerce-fulfillment-sync';

export const config = {
    api: { bodyParser: true }, // WC usually sends small JSON, simplify if not needing raw body for sig
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const topic = req.headers['x-wc-webhook-topic'];
        const source = req.headers['x-wc-webhook-source']; // Often the store domain
        const payload = req.body;

        console.info(`📡 [WC Webhook] Incoming: ${topic} | Source: ${source}`);

        // Topic: order.updated
        if (topic === 'order.updated') {
            const status = payload.status;
            const wcOrderId = payload.id?.toString();

            // We consider "completed" as the trigger for fulfillment back to Saleor
            if (status === 'completed' && wcOrderId) {
                // Tracking info might be in metadata or specific fields depending on plugins (e.g., Shipment Tracking)
                // For now, we sync the status. Tracking can be added later if standard fields are found.
                const trackingNumber = payload.shipping_lines?.[0]?.instance_id || null;

                const handle = await woocommerceFulfillmentSync.trigger({
                    woocommerceOrderId: wcOrderId,
                    trackingNumber: trackingNumber || undefined,
                    vendorStoreUrl: source?.toString() || payload.customer_url || ""
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
