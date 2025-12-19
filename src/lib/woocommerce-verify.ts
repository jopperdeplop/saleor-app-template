import crypto from 'crypto';

/**
 * Verifies the WooCommerce webhook signature.
 * @param rawBody The raw request body as a buffer or string.
 * @param signature The signature from X-WC-Webhook-Signature header.
 * @param secret The webhook secret or consumer_secret used for signing.
 */
export function verifyWooCommerceSignature(rawBody: string | Buffer, signature: string, secret: string): boolean {
    if (!signature || !secret) return false;

    const hash = crypto
        .createHmac('sha256', secret)
        .update(rawBody)
        .digest('base64');

    return hash === signature;
}
