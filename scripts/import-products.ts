// scripts/import-products.ts
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

// --- CONFIG ---
const SALEOR_URL = process.env.SALEOR_API_URL!;
const SALEOR_HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': process.env.SALEOR_TOKEN!
};
const SHOPIFY_HEADERS = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN!
};

// --- HELPERS ---

function textToEditorJs(text: string) {
    const cleanText = text ? text.replace(/\n/g, "<br>") : "";
    return JSON.stringify({
        time: Date.now(),
        blocks: [{ type: "paragraph", data: { text: cleanText } }],
        version: "2.25.0"
    });
}

async function getSaleorChannels() {
    console.log("📡 Fetching Saleor Channels...");
    const query = `
    {
        channels { id slug currencyCode isActive }
    }`;
    const res = await fetch(SALEOR_URL, {
        method: 'POST',
        headers: SALEOR_HEADERS,
        body: JSON.stringify({ query })
    });
    const json: any = await res.json();
    return json.data?.channels || [];
}

// --- MAIN LOGIC ---

async function fetchShopifyProducts() {
    console.log("2. 📡 Connecting to Shopify...");
    const query = `
    {
      products(first: 20, query: "status:active AND inventory_total:>0") {
        edges {
          node {
            id
            title
            descriptionHtml
            images(first: 1) { edges { node { url } } }
            variants(first: 10) {
              edges {
                node {
                  sku
                  price
                  inventoryQuantity
                }
              }
            }
          }
        }
      }
    }`;

    try {
        const res = await fetch(process.env.SHOPIFY_GRAPHQL_URL!, {
            method: 'POST',
            headers: SHOPIFY_HEADERS,
            body: JSON.stringify({ query })
        });
        const data: any = await res.json();
        const products = data.data?.products?.edges || [];
        console.log(`✅ Found ${products.length} products to import.`);
        return products;
    } catch (error) {
        console.error("❌ Shopify Network Error:", error);
        return [];
    }
}

async function createInSaleor(shopifyNode: any, channels: any[]) {
    const p = shopifyNode.node;
    console.log(`\n📦 Processing: "${p.title}"`);

    // 1. Create Product
    const createProductQuery = `
    mutation CreateProduct($input: ProductCreateInput!) {
        productCreate(input: $input) {
            product { id }
            errors { field message }
        }
    }`;

    const productVars = {
        input: {
            name: p.title,
            productType: process.env.SALEOR_PRODUCT_TYPE_ID,
            category: process.env.SALEOR_CATEGORY_ID,
            description: textToEditorJs(p.descriptionHtml || p.title)
        }
    };

    const prodRes = await fetch(SALEOR_URL, {
        method: 'POST',
        headers: SALEOR_HEADERS,
        body: JSON.stringify({ query: createProductQuery, variables: productVars })
    });
    const prodJson: any = await prodRes.json();

    // Detailed Error Logging for Product
    if (prodJson.data?.productCreate?.errors?.length > 0) {
        console.error("   ❌ Product Creation Failed:", JSON.stringify(prodJson.data.productCreate.errors));
        return;
    }

    const newProductId = prodJson.data?.productCreate?.product?.id;
    if (!newProductId) {
        console.error("   ❌ Unknown Error: No Product ID returned.");
        return;
    }
    console.log(`   ✅ Created Product ID: ${newProductId}`);

    // 2. Enable Availability
    const dateStr = new Date().toISOString().split('T')[0];
    const dateTimeStr = new Date().toISOString();
    const channelListings = channels.map((ch: any) => ({
        channelId: ch.id,
        isPublished: true,
        publicationDate: dateStr,
        isAvailableForPurchase: true,
        availableForPurchaseAt: dateTimeStr,
        visibleInListings: true
    }));

    const updateChannelQuery = `
    mutation UpdateProductChannelListing($product: ID!, $input: ProductChannelListingUpdateInput!) {
        productChannelListingUpdate(id: $product, input: $input) {
            errors { field message }
        }
    }`;

    await fetch(SALEOR_URL, {
        method: 'POST',
        headers: SALEOR_HEADERS,
        body: JSON.stringify({ query: updateChannelQuery, variables: { product: newProductId, input: { updateChannels: channelListings } } })
    });
    console.log(`   📡 Enabled on ${channels.length} Channels.`);

    // 3. Import Image
    const imgUrl = p.images?.edges?.[0]?.node?.url;
    if (imgUrl) {
        const mediaQuery = `
        mutation ProductMediaCreate($product: ID!, $image: String!) {
            productMediaCreate(input: { product: $product, mediaUrl: $image }) {
                media { id }
            }
        }`;
        await fetch(SALEOR_URL, {
            method: 'POST',
            headers: SALEOR_HEADERS,
            body: JSON.stringify({ query: mediaQuery, variables: { product: newProductId, image: imgUrl } })
        });
        console.log(`   📸 Image attached.`);
    }

    // 4. Create Variants
    for (const vEdge of p.variants.edges) {
        const v = vEdge.node;
        if (v.inventoryQuantity > 0) {
            await createVariant(newProductId, v, channels);
        }
    }
}

async function createVariant(prodId: string, v: any, channels: any[]) {
    const sku = v.sku || `IMP-${Math.floor(Math.random() * 999999)}`;
    const shopifyPrice = parseFloat(v.price);

    // FIXED: Added attributes: [] and trackInventory: true matching Python logic
    const createVarQuery = `
    mutation CreateVariant($input: ProductVariantCreateInput!) {
        productVariantCreate(input: $input) {
            productVariant { id }
            errors { field message }
        }
    }`;

    const varVars = {
        input: {
            product: prodId,
            sku: sku,
            attributes: [],       // <--- Added based on Python script
            trackInventory: true, // <--- Ensure stock tracking is on
            stocks: [{
                warehouse: process.env.SALEOR_WAREHOUSE_ID,
                quantity: v.inventoryQuantity
            }]
        }
    };

    const varRes = await fetch(SALEOR_URL, {
        method: 'POST',
        headers: SALEOR_HEADERS,
        body: JSON.stringify({ query: createVarQuery, variables: varVars })
    });
    const varJson: any = await varRes.json();

    // CRITICAL FIX: Print the ACTUAL error message from Saleor
    if (varJson.data?.productVariantCreate?.errors?.length > 0) {
        console.error(`      ❌ Failed to create variant ${sku}`);
        console.error(`         REASON: ${JSON.stringify(varJson.data.productVariantCreate.errors)}`); // <--- Look at this output!
        return;
    }

    const variantId = varJson.data?.productVariantCreate?.productVariant?.id;
    if (!variantId) {
        console.error(`      ❌ Unknown Error: Variant ${sku} has no ID.`);
        return;
    }

    // Set Prices
    const priceListings = channels.map((ch: any) => ({
        channelId: ch.id,
        price: shopifyPrice,
        costPrice: shopifyPrice
    }));

    const updatePriceQuery = `
    mutation UpdateVariantChannelListing($id: ID!, $input: [ProductVariantChannelListingAddInput!]!) {
        productVariantChannelListingUpdate(id: $id, input: $input) {
            errors { field message }
        }
    }`;

    await fetch(SALEOR_URL, {
        method: 'POST',
        headers: SALEOR_HEADERS,
        body: JSON.stringify({ query: updatePriceQuery, variables: { id: variantId, input: priceListings } })
    });

    console.log(`      ✅ Variant ${sku} created @ ${shopifyPrice}`);
}

// --- EXECUTE ---
(async () => {
    try {
        console.log("------------------------------------------------");
        console.log("🛠️  STARTING IMPORT (WITH FIXES)");

        const channels = await getSaleorChannels();
        if (channels.length === 0) {
            console.error("❌ No Channels found in Saleor.");
            return;
        }

        const products = await fetchShopifyProducts();

        for (const p of products) {
            await createInSaleor(p, channels);
        }

        console.log("\n✅ IMPORT COMPLETE");
        console.log("------------------------------------------------");
    } catch (e) {
        console.error("FATAL ERROR:", e);
    }
})();