import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import fetch from 'node-fetch'; 

export const config = {
  api: { bodyParser: false },
};

// --- HELPERS ---

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

// Fetch Details (SKU + Variant ID) from Shopify
async function getShopifyVariantDetails(inventoryItemId: number) {
  const query = `
    query($id: ID!) {
      inventoryItem(id: $id) {
        variant {
          id
          sku
          product {
            title
          }
        }
      }
    }
  `;
  
  const gid = `gid://shopify/InventoryItem/${inventoryItemId}`;
  
  const res = await fetch(process.env.SHOPIFY_GRAPHQL_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN!
    },
    body: JSON.stringify({ query, variables: { id: gid } })
  });

  const json = await res.json();
  const variant = json.data?.inventoryItem?.variant;
  
  return {
    id: variant?.id, // Returns "gid://shopify/ProductVariant/12345678"
    sku: variant?.sku,
    name: variant?.product?.title
  };
}

// Update Stock in Saleor
async function updateSaleorStock(sku: string, quantity: number) {
  const warehouseId = process.env.SALEOR_WAREHOUSE_ID;
  
  console.log(`   🔄 Syncing Saleor: SKU "${sku}" -> Qty ${quantity}`);

  const query = `
    mutation UpdateStock($sku: String!, $qty: Int!, $warehouse: ID!) {
      productVariantStocksUpdate(
        sku: $sku, 
        stocks: [{ warehouse: $warehouse, quantity: $qty }] 
      ) {
        errors { field message }
        productVariant {
          id
          name
          stocks { quantity }
        }
      }
    }
  `;

  const res = await fetch(process.env.SALEOR_API_URL!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': process.env.SALEOR_TOKEN!
    },
    body: JSON.stringify({ 
      query, 
      variables: { sku, qty: quantity, warehouse: warehouseId } 
    })
  });

  const json = await res.json();
  
  if (json.data?.productVariantStocksUpdate?.errors?.length > 0) {
    // Often fails if SKU doesn't exist yet (race condition). We log warning, not error.
    console.warn("   ⚠️ Saleor Update Failed (Product might not exist yet):", JSON.stringify(json.data.productVariantStocksUpdate.errors));
    return false;
  }
  
  console.log("   ✅ Saleor Stock Updated Successfully.");
  return true;
}

// --- MAIN HANDLER ---

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    console.log("\n⚡ WEBHOOK RECEIVED: Inventory Update");

    const rawBody = await getRawBody(req);
    const hmacHeader = req.headers['x-shopify-hmac-sha256'];
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

    if (secret) {
        const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
        if (hash !== hmacHeader) {
            console.error("   ⛔ Security Alert: Invalid Signature.");
            return res.status(401).send('Forbidden');
        }
    }

    const payload = JSON.parse(rawBody.toString());
    const shopifyStock = payload.available;
    const inventoryItemId = payload.inventory_item_id;

    console.log(`   📊 Shopify Stock: ${shopifyStock}`);

    // 1. Identify Target SKU
    const details = await getShopifyVariantDetails(inventoryItemId);
    let targetSku = details.sku;

    // Logic Match: If no SKU in Shopify, construct the "IMP-{ID}" SKU 
    // This matches the logic in 'shopify-product-lifecycle.ts'
    if (!targetSku && details.id) {
        const legacyId = details.id.split('/').pop(); // Extract "12345" from "gid://.../12345"
        targetSku = `IMP-${legacyId}`;
        console.log(`   ℹ️  No SKU in Shopify. Using generated SKU: "${targetSku}"`);
    }

    if (!targetSku) {
        console.log("   ❌ Skipped: Could not determine a SKU.");
        return res.status(200).send('Skipped');
    }
    
    // 2. Apply Business Logic (Safety Buffer)
    let finalStock = shopifyStock;
    if (shopifyStock < 3) {
        console.log("   🛡️  SAFETY BUFFER: Stock < 3. Force 0.");
        finalStock = 0;
    }

    // 3. Execute Sync
    await updateSaleorStock(targetSku, finalStock);

    res.status(200).send('Synced');

  } catch (error) {
    console.error("   ❌ Webhook Error:", error);
    res.status(500).send('Server Error');
  }
}