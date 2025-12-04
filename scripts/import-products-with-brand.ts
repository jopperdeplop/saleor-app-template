import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

// --- CONFIGURATION ---
const SALEOR_URL = process.env.SALEOR_API_URL!;
const SALEOR_HEADERS = { 
    'Content-Type': 'application/json', 
    'Authorization': process.env.SALEOR_TOKEN! 
};
const SHOPIFY_HEADERS = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN!
};

// IDs from .env
// MAKE SURE SALEOR_BRAND_ATTRIBUTE_ID IS THE NEW "FIXED" ID
const BRAND_MODEL_TYPE_ID = process.env.SALEOR_BRAND_MODEL_TYPE_ID!; 
const BRAND_ATTRIBUTE_ID = process.env.SALEOR_BRAND_ATTRIBUTE_ID!;
const PRODUCT_TYPE_ID = process.env.SALEOR_PRODUCT_TYPE_ID!;
const CATEGORY_ID = process.env.SALEOR_CATEGORY_ID!;
const WAREHOUSE_ID = process.env.SALEOR_WAREHOUSE_ID!;

// Validate Critical Config
if (!BRAND_ATTRIBUTE_ID || !BRAND_MODEL_TYPE_ID) {
    console.error("❌ ERROR: Missing Brand config in .env (SALEOR_BRAND_ATTRIBUTE_ID or SALEOR_BRAND_MODEL_TYPE_ID)");
    process.exit(1);
}

// --- HELPERS ---

function textToEditorJs(text: string) {
    const cleanText = text ? text.replace(/\n/g, "<br>") : "";
    return JSON.stringify({
        time: Date.now(),
        blocks: [{ type: "paragraph", data: { text: cleanText } }],
        version: "2.25.0"
    });
}

async function saleorFetch(query: string, variables: any = {}) {
    const res = await fetch(SALEOR_URL, {
        method: 'POST',
        headers: SALEOR_HEADERS,
        body: JSON.stringify({ query, variables })
    });
    const json = await res.json();
    return json;
}

async function getSaleorChannels() {
    console.log("📡 Fetching Saleor Channels...");
    const query = `{ channels { id slug currencyCode isActive } }`;
    const json = await saleorFetch(query);
    return json.data?.channels || [];
}

async function checkProductExists(title: string): Promise<string | null> {
    const query = `
    query CheckProduct($search: String!) {
        products(filter: { search: $search }, first: 1) {
            edges { node { id name } }
        }
    }`;
    const json = await saleorFetch(query, { search: title });
    // Strict name matching to avoid partial matches
    const edge = json.data?.products?.edges?.find((e: any) => e.node.name.toLowerCase() === title.toLowerCase());
    return edge ? edge.node.id : null;
}

// --- BRAND LOGIC ---

async function getOrCreateBrand(brandName: string): Promise<string | null> {
    if (!brandName) return null;

    // 1. Search for existing brand page
    const findQuery = `
    query FindBrandModel($brandName: String!) {
        pages(filter: { search: $brandName }, first: 1) {
            edges { node { id title isPublished } }
        }
    }`;
    const findJson = await saleorFetch(findQuery, { brandName });
    const existing = findJson.data?.pages?.edges?.[0]?.node;

    if (existing) {
        // Ensure it's published so it can be viewed/linked properly
        if (!existing.isPublished) {
            console.log(`   🔄 Publishing existing brand: ${existing.title}`);
            const pubQuery = `mutation Pub($id: ID!) { pageUpdate(id: $id, input: { isPublished: true }) { errors { field } } }`;
            await saleorFetch(pubQuery, { id: existing.id });
        }
        return existing.id;
    }

    // 2. Create if not found
    console.log(`   ✨ Creating new Brand Page: "${brandName}"...`);
    const createQuery = `
    mutation CreateBrandModel($name: String!, $type: ID!) {
        pageCreate(input: { title: $name, pageType: $type, isPublished: true, content: "{}" }) {
            page { id }
            errors { field message }
        }
    }`;
    const createJson = await saleorFetch(createQuery, { name: brandName, type: BRAND_MODEL_TYPE_ID });
    
    if (createJson.data?.pageCreate?.errors?.length > 0) {
        console.error("   ❌ Error creating brand:", JSON.stringify(createJson.data.pageCreate.errors));
        return null;
    }
    return createJson.data?.pageCreate?.page?.id;
}

// --- SHOPIFY FETCHING ---

async function fetchShopifyProducts() {
    console.log("2. 📡 Connecting to Shopify...");
    const query = `
    {
      products(first: 20, query: "status:active AND inventory_total:>0") {
        edges {
          node {
            id title vendor descriptionHtml
            images(first: 1) { edges { node { url } } }
            variants(first: 10) {
              edges { node { sku price inventoryQuantity } }
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

// --- MAIN PRODUCT CREATION LOGIC ---

async function createInSaleor(shopifyNode: any, channels: any[]) {
    const p = shopifyNode.node;
    console.log(`\n📦 Processing: "${p.title}"`);
    console.log(`   🔎 Vendor: "${p.vendor}"`);

    // 1. Prepare Brand
    const brandId = await getOrCreateBrand(p.vendor);
    const attributesInput = [];
    
    if (brandId) {
        attributesInput.push({
            id: BRAND_ATTRIBUTE_ID,
            // CRITICAL FIX: Use 'references' (plural) and an array for Reference Attributes
            references: [brandId] 
        });
    } else {
        console.warn("   ⚠️  No Brand ID found/created. Skipping brand assignment.");
    }

    // 2. Check Exists
    const existingId = await checkProductExists(p.title);
    
    if (existingId) {
        console.log(`   ⚠️  Product exists (ID: ${existingId}). Updating Brand info...`);
        if (attributesInput.length > 0) {
            const updateQuery = `
            mutation UpdateProd($id: ID!, $input: ProductInput!) {
                productUpdate(id: $id, input: $input) {
                    product { attributes { attribute { id } values { name } } }
                    errors { field message }
                }
            }`;
            const res = await saleorFetch(updateQuery, { id: existingId, input: { attributes: attributesInput } });
            
            if (res.data?.productUpdate?.errors?.length > 0) {
                console.error("   ❌ Update failed:", JSON.stringify(res.data.productUpdate.errors));
            } else {
                console.log("   ✅ Brand link updated successfully.");
            }
        }
        return; // Skip creation steps for existing products
    }

    // 3. Create Product
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
            productType: PRODUCT_TYPE_ID,
            category: CATEGORY_ID,
            description: textToEditorJs(p.descriptionHtml || p.title),
            attributes: attributesInput // Attach brand here
        }
    };

    const prodJson = await saleorFetch(createProductQuery, productVars);
    if (prodJson.data?.productCreate?.errors?.length > 0) {
        console.error("   ❌ Creation Failed:", JSON.stringify(prodJson.data.productCreate.errors));
        return;
    }

    const newProductId = prodJson.data?.productCreate?.product?.id;
    console.log(`   ✅ Created Product ID: ${newProductId}`);

    // 4. Enable Channels
    const dateStr = new Date().toISOString().split('T')[0];
    const channelListings = channels.map((ch: any) => ({
        channelId: ch.id,
        isPublished: true,
        publicationDate: dateStr,
        isAvailableForPurchase: true,
        visibleInListings: true
    }));
    const updateChannelQuery = `
    mutation UpdateChannel($id: ID!, $input: ProductChannelListingUpdateInput!) {
        productChannelListingUpdate(id: $id, input: $input) { errors { field } }
    }`;
    await saleorFetch(updateChannelQuery, { id: newProductId, input: { updateChannels: channelListings } });

    // 5. Image
    const imgUrl = p.images?.edges?.[0]?.node?.url;
    if (imgUrl) {
        const mediaQuery = `mutation AddMedia($id: ID!, $url: String!) { productMediaCreate(input: { product: $id, mediaUrl: $url }) { media { id } } }`;
        await saleorFetch(mediaQuery, { id: newProductId, url: imgUrl });
        console.log("   📸 Image attached.");
    }

    // 6. Variants
    for (const vEdge of p.variants.edges) {
        const v = vEdge.node;
        if(v.inventoryQuantity > 0) await createVariant(newProductId, v, channels);
    }
}

async function createVariant(prodId: string, v: any, channels: any[]) {
    const sku = v.sku || `IMP-${Math.floor(Math.random() * 999999)}`;
    const shopifyPrice = parseFloat(v.price); 

    const createVarQuery = `
    mutation CreateVar($input: ProductVariantCreateInput!) {
        productVariantCreate(input: $input) {
            productVariant { id }
            errors { field message }
        }
    }`;
    const varVars = {
        input: {
            product: prodId,
            sku: sku,
            trackInventory: true,
            stocks: [{ warehouse: WAREHOUSE_ID, quantity: v.inventoryQuantity }]
        }
    };
    const varJson = await saleorFetch(createVarQuery, varVars);
    const variantId = varJson.data?.productVariantCreate?.productVariant?.id;

    if (variantId) {
        const priceListings = channels.map((ch: any) => ({
            channelId: ch.id,
            price: shopifyPrice,
            costPrice: shopifyPrice
        }));
        const updatePriceQuery = `
        mutation UpdatePrice($id: ID!, $input: [ProductVariantChannelListingAddInput!]!) {
            productVariantChannelListingUpdate(id: $id, input: $input) { errors { field } }
        }`;
        await saleorFetch(updatePriceQuery, { id: variantId, input: priceListings });
        console.log(`      ✅ Variant ${sku} created.`);
    } else {
        console.error(`      ❌ Failed to create variant ${sku}:`, JSON.stringify(varJson.data?.productVariantCreate?.errors));
    }
}

// --- EXECUTE ---
(async () => {
    try {
        console.log("------------------------------------------------");
        console.log("🛠️  STARTING SHOPIFY -> SALEOR IMPORT");
        console.log("------------------------------------------------");
        
        const channels = await getSaleorChannels();
        if (channels.length === 0) return console.error("❌ No Channels found. Import aborted.");

        const products = await fetchShopifyProducts();
        for (const p of products) {
            await createInSaleor(p, channels);
        }
        console.log("\n✅ IMPORT COMPLETE");
    } catch (e) {
        console.error("FATAL ERROR:", e);
    }
})();