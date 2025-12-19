import crypto from 'crypto';
import fetch from 'node-fetch';

/**
 * Script to test the WooCommerce webhook endpoint.
 * usage: tsx scripts/test-woocommerce-webhook.ts
 */

const WEBHOOK_URL = 'http://localhost:3000/api/webhooks/woocommerce/order';
const WEBHOOK_SECRET = 'your_secret_here'; // Replace with decrypted secret from DB
const STORE_URL = 'https://example.instawp.xyz';

const payload = {
    id: 12345,
    status: 'processing',
    currency: 'USD',
    total: '50.00',
    line_items: [
        { id: 1, name: 'Test Product', quantity: 1, price: '50.00' }
    ]
};

const rawBody = JSON.stringify(payload);
const signature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(rawBody)
    .digest('base64');

async function test() {
    console.log(`🚀 Sending mock WC webhook to ${WEBHOOK_URL}...`);
    try {
        const res = await fetch(WEBHOOK_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-WC-Webhook-Signature': signature,
                'X-WC-Webhook-Topic': 'order.created',
                'X-WC-Webhook-Source': STORE_URL
            },
            body: rawBody
        });

        const text = await res.text();
        console.log(`📡 Response (${res.status}):`, text);
    } catch (e) {
        console.error("❌ Failed to reach endpoint:", e);
    }
}

test();
