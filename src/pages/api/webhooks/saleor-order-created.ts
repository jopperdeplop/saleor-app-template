import { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';

export const config = { api: { bodyParser: true } }; // Parsing enabled for Saleor JSON

// --- HELPERS ---

// 1. Find Shopify Variant ID by SKU
// We need this because Shopify requires the Variant ID to deduct inventory correctly.
async function getShopifyVariantIdBySku(sku: string) {
    const query = `
    {
      productVariants(first: 1, query: "sku:${sku}") {
        edges {
          node {
            id
          }
        }
      }
    }`;

    const res = await fetch(process.env.SHOPIFY_GRAPHQL_URL!, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN!
        },
        body: JSON.stringify({ query })
    });

    const json: any = await res.json();
    // Returns "gid://shopify/ProductVariant/12345..."
    return json.data?.productVariants?.edges?.[0]?.node?.id || null;
}

// 2. Create Order in Shopify
async function createShopifyOrder(saleorOrder: any) {
    const shopifyLines = [];

    // Map Saleor Lines -> Shopify Lines
    for (const line of saleorOrder.lines) {
        const sku = line.productVariant?.sku;
        if (sku) {
            const variantGid = await getShopifyVariantIdBySku(sku);
            if (variantGid) {
                // Extract ID from GID (e.g., 12345 from gid://.../12345)
                const variantId = variantGid.split('/').pop();
                shopifyLines.push({
                    variant_id: variantId,
                    quantity: line.quantity
                });
            } else {
                console.warn(`⚠️ SKU ${sku} not found in Shopify. Adding as custom line item.`);
                shopifyLines.push({
                    title: line.productName,
                    price: line.unitPrice.gross.amount,
                    quantity: line.quantity
                });
            }
        }
    }

    // Map Address (Assuming Saleor 'shippingAddress' matches Shopify structure closely)
    const shipping = saleorOrder.shippingAddress;
    const shopifyAddress = shipping ? {
        first_name: shipping.firstName,
        last_name: shipping.lastName,
        address1: shipping.streetAddress1,
        address2: shipping.streetAddress2,
        city: shipping.city,
        zip: shipping.postalCode,
        country_code: shipping.country.code, // Saleor sends "US", Shopify wants "US"
        phone: shipping.phone
    } : null;

    const payload = {
        order: {
            line_items: shopifyLines,
            customer: {
                first_name: shipping?.firstName || "Guest",
                last_name: shipping?.lastName || "User",
                email: saleorOrder.userEmail
            },
            shipping_address: shopifyAddress,
            billing_address: shopifyAddress, // Using shipping for billing to simplify
            financial_status: "paid", // IMPORTANT: Marks it as paid so Shopify doesn't ask for payment
            processed_at: saleorOrder.created,
            tags: "Saleor Sync",
            note: `Imported from Saleor Order #${saleorOrder.number}`
        }
    };

    // Send to Shopify REST API (easier for Order creation than GraphQL)
    // We construct the REST URL from the GraphQL one in env
    const baseUrl = process.env.SHOPIFY_GRAPHQL_URL!.replace('/admin/api/2024-01/graphql.json', '');
    const restUrl = `${baseUrl}/admin/api/2024-01/orders.json`;

    const response = await fetch(restUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN!
        },
        body: JSON.stringify(payload)
    });

    const json: any = await response.json();
    if (json.errors) {
        throw new Error(JSON.stringify(json.errors));
    }
    return json.order;
}

// --- MAIN HANDLER ---

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    // Saleor sends events as POST
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        // 1. Validate Event Type
        // Saleor sends the event type in the header
        const eventType = req.headers['saleor-event'];

        if (eventType !== 'order_fully_paid' && eventType !== 'order_created') {
            // We usually wait for "Fully Paid" to ensure we don't ship unpaid items
            console.log(`ℹ️ Ignoring event: ${eventType}`);
            return res.status(200).send('Ignored');
        }

        const orderData = req.body;
        // Note: In production, verify 'saleor-signature' header here!

        console.log(`⚡ Processing Saleor Order #${orderData.number || 'Unknown'}`);

        // 2. Push to Shopify
        const shopifyOrder = await createShopifyOrder(orderData);

        console.log(`✅ Created Shopify Order #${shopifyOrder.id} (Name: ${shopifyOrder.name})`);

        res.status(200).send('Synced');

    } catch (error) {
        console.error("❌ Sync Failed:", error);
        res.status(500).send('Error');
    }
}