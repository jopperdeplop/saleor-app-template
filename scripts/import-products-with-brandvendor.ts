import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

// --- CONFIGURATION ---
const SALEOR_URL = process.env.SALEOR_API_URL!;
const rawToken = process.env.SALEOR_TOKEN!;
const authHeader = rawToken.startsWith('Bearer ') ? rawToken : `Bearer ${rawToken}`;

const SALEOR_HEADERS = { 
    'Content-Type': 'application/json', 
    'Authorization': authHeader 
};
const SHOPIFY_HEADERS = {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN!
};

// IDs from .env
const BRAND_MODEL_TYPE_ID = process.env.SALEOR_BRAND_MODEL_TYPE_ID!; 
const BRAND_ATTRIBUTE_ID = process.env.SALEOR_BRAND_ATTRIBUTE_ID!;
const PRODUCT_TYPE_ID = process.env.SALEOR_PRODUCT_TYPE_ID!;
const CATEGORY_ID = process.env.SALEOR_CATEGORY_ID!;
const DEFAULT_WAREHOUSE_ID = process.env.SALEOR_WAREHOUSE_ID!; 

// Global State
let WAREHOUSE_MUTATION_NAME = "warehouseCreate"; 
let IS_WAREHOUSE_CAPABLE = false;
const EXISTING_PRODUCTS = new Map<string, string>(); // Cache: Normalized Name -> ID

// Default Address
const DEFAULT_VENDOR_ADDRESS = {
    firstName: "Logistics",
    lastName: "Manager",
    companyName: "Vendor Warehouse",
    streetAddress1: "123 Market St",
    city: "San Francisco",
    postalCode: "94105",
    country: "US", 
    countryArea: "CA"
};

if (!BRAND_ATTRIBUTE_ID || !BRAND_MODEL_TYPE_ID || !PRODUCT_TYPE_ID || !CATEGORY_ID) {
    console.error("❌ CRITICAL: Missing Saleor Config in .env");
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
    try {
        const res = await fetch(SALEOR_URL, {
            method: 'POST',
            headers: SALEOR_HEADERS,
            body: JSON.stringify({ query, variables })
        });
        const json: any = await res.json();
        return json;
    } catch (e) {
        console.error("   ❌ Network Error during Saleor Request:", e);
        return {};
    }
}

// --- DIAGNOSTICS & CACHE ---

async function runDiagnostics() {
    console.log("🔍 Running Pre-flight Diagnostics...");
    const schemaQuery = `query { __type(name: "Mutation") { fields { name } } }`;
    const schemaJson = await saleorFetch(schemaQuery);
    
    if (schemaJson.errors) {
         console.error("   ❌ Introspection Failed:", JSON.stringify(schemaJson.errors));
         return false;
    }

    const mutations = schemaJson.data?.__type?.fields?.map((f: any) => f.name) || [];
    const hasProduct = mutations.includes("productCreate");
    const hasModernWarehouse = mutations.includes("warehouseCreate");
    const hasLegacyWarehouse = mutations.includes("createWarehouse");

    if (hasModernWarehouse) {
        WAREHOUSE_MUTATION_NAME = "warehouseCreate";
        IS_WAREHOUSE_CAPABLE = true;
    } else if (hasLegacyWarehouse) {
        WAREHOUSE_MUTATION_NAME = "createWarehouse"; 
        IS_WAREHOUSE_CAPABLE = true;
    } else {
        IS_WAREHOUSE_CAPABLE = false;
    }

    console.log("   🛡️  Capabilities:");
    console.log(`      - Product Creation:   ${hasProduct ? "✅" : "❌"}`);
    console.log(`      - Warehouse Creation: ${IS_WAREHOUSE_CAPABLE ? `✅ (Using: ${WAREHOUSE_MUTATION_NAME})` : "❌"}`);

    if (!IS_WAREHOUSE_CAPABLE) {
        console.warn("\n   ⚠️  WARNING: Warehouse creation capabilities missing.");
        console.warn("      Check 'MANAGE_PRODUCTS' and 'MANAGE_SHIPPING' permissions.");
    }
    return true; 
}

async function loadExistingProducts() {
    console.log("📥 Caching existing Saleor products (this avoids duplicates)...");
    let hasNextPage = true;
    let cursor = null;
    
    while (hasNextPage) {
        const query = `query GetAllProds($after: String) { 
            products(first: 100, after: $after) { 
                pageInfo { hasNextPage endCursor } 
                edges { node { id name } } 
            } 
        }`;
        const json = await saleorFetch(query, { after: cursor });
        
        const edges = json.data?.products?.edges || [];
        for (const edge of edges) {
            // Normalize name for robust comparison
            const normName = edge.node.name.trim().toLowerCase();
            EXISTING_PRODUCTS.set(normName, edge.node.id);
        }

        if (json.data?.products?.pageInfo?.hasNextPage) {
            cursor = json.data.products.pageInfo.endCursor;
            process.stdout.write("."); // Progress dot
        } else {
            hasNextPage = false;
        }
    }
    console.log(`\n   ✅ Cache built: ${EXISTING_PRODUCTS.size} products found.`);
}

async function getSaleorChannels() {
    console.log("📡 Fetching Saleor Channels...");
    const query = `{ channels { id slug currencyCode isActive } }`;
    const json = await saleorFetch(query);
    return json.data?.channels || [];
}

// --- BRAND LOGIC ---

async function getOrCreateBrandPage(brandName: string): Promise<string | null> {
    if (!brandName) return null;
    const findQuery = `query FindBrandPage($brandName: String!) { pages(filter: { search: $brandName }, first: 1) { edges { node { id title isPublished } } } }`;
    const findJson = await saleorFetch(findQuery, { brandName });
    const existing = findJson.data?.pages?.edges?.[0]?.node;

    if (existing) {
        if (!existing.isPublished) {
            const pubQuery = `mutation Pub($id: ID!) { pageUpdate(id: $id, input: { isPublished: true }) { errors { field } } }`;
            await saleorFetch(pubQuery, { id: existing.id });
        }
        return existing.id;
    }

    console.log(`   ✨ Creating Brand Page: "${brandName}"...`);
    const createQuery = `mutation CreateBrandPage($name: String!, $type: ID!) { pageCreate(input: { title: $name, pageType: $type, isPublished: true, content: "{}" }) { page { id } errors { field message } } }`;
    const createJson = await saleorFetch(createQuery, { name: brandName, type: BRAND_MODEL_TYPE_ID });
    return createJson.data?.pageCreate?.page?.id;
}

// --- WAREHOUSE & SHIPPING LOGIC ---

async function getOrCreateShippingZone(zoneName: string): Promise<string | null> {
    // 1. Try to Find
    const query = `query FindZone($search: String!) { shippingZones(filter: { search: $search }, first: 1) { edges { node { id name } } } }`;
    const json = await saleorFetch(query, { search: zoneName });
    const existing = json.data?.shippingZones?.edges?.[0]?.node;
    
    if (existing) return existing.id;

    // 2. Create if missing
    console.log(`   🚚 Creating Shipping Zone: "${zoneName}"...`);
    const createQuery = `
    mutation CreateShippingZone($input: ShippingZoneCreateInput!) {
        shippingZoneCreate(input: $input) {
            shippingZone { id }
            errors { field message }
        }
    }`;

    // Default basic countries for Europe zone
    const countries = ["DE", "FR", "GB", "IT", "ES", "PL", "NL", "BE", "AT", "PT", "SE", "DK", "FI", "NO", "IE"];
    
    const createJson = await saleorFetch(createQuery, { 
        input: { name: zoneName, countries: countries } 
    });

    const newZoneId = createJson.data?.shippingZoneCreate?.shippingZone?.id;
    if (!newZoneId) {
        console.error("   ❌ Failed to create shipping zone:", JSON.stringify(createJson.data?.shippingZoneCreate?.errors));
        return null;
    }
    
    return newZoneId;
}

async function assignWarehouseToChannels(warehouseId: string, channels: any[]) {
    for (const channel of channels) {
        const mutation = `
        mutation ChannelUpdate($id: ID!, $input: ChannelUpdateInput!) {
            channelUpdate(id: $id, input: $input) { errors { field message } }
        }`;
        await saleorFetch(mutation, { 
            id: channel.id, 
            input: { addWarehouses: [warehouseId] } 
        });
    }
    console.log("   🔗 Warehouse linked to Channels.");
}

// Corrected using official documentation: shippingZoneUpdate with "addWarehouses"
async function assignShippingZoneToWarehouse(warehouseId: string, zoneId: string) {
    console.log(`   🚚 Linking Warehouse (${warehouseId}) to Shipping Zone (${zoneId})...`);

    // 1. Fetch current zones for warehouse to avoid redundant calls
    const wQuery = `query GetWarehouseZones($id: ID!) { warehouse(id: $id) { shippingZones(first: 50) { edges { node { id } } } } }`;
    const wJson = await saleorFetch(wQuery, { id: warehouseId });
    const currentZones = wJson.data?.warehouse?.shippingZones?.edges?.map((e: any) => e.node.id) || [];
    
    if (currentZones.includes(zoneId)) {
        console.log("      ✅ Already linked.");
        return;
    }

    // 2. Execute Mutation: shippingZoneUpdate with addWarehouses
    const mutation = `
    mutation UpdateZone($id: ID!, $input: ShippingZoneUpdateInput!) {
        shippingZoneUpdate(id: $id, input: $input) {
            errors { field message }
        }
    }`;

    const res = await saleorFetch(mutation, { 
        id: zoneId, 
        input: { addWarehouses: [warehouseId] } 
    });

    // Handle Top-Level GraphQL Errors
    if (res.errors) {
        console.error("   ❌ GraphQL Error linking zone:", JSON.stringify(res.errors));
        return;
    }

    const errors = res.data?.shippingZoneUpdate?.errors;
    if (errors && errors.length > 0) {
        console.error("   ❌ Failed to link warehouse to zone:", JSON.stringify(errors));
    } else {
        console.log("   ✅ Warehouse assigned to Shipping Zone (Europe).");
    }
}

async function getOrCreateWarehouse(vendorName: string, channels: any[]): Promise<string | null> {
    const slugName = `vendor-${vendorName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    
    // A. FIND
    const query = `query FindWarehouse($search: String!) { warehouses(filter: { search: $search }, first: 1) { edges { node { id name slug } } } }`;
    const json = await saleorFetch(query, { search: vendorName });
    const existing = json.data?.warehouses?.edges?.[0]?.node;
    
    if (existing) return existing.id;

    // B. CREATE
    if (!IS_WAREHOUSE_CAPABLE) return null;

    console.log(`   🏭 Creating new Warehouse: "${vendorName}"...`);
    const createQuery = `
    mutation CreateWarehouse($input: WarehouseCreateInput!) {
        ${WAREHOUSE_MUTATION_NAME}(input: $input) {
            warehouse { id }
            errors { field message code }
        }
    }`;
    
    const vars = {
        input: {
            name: `${vendorName} Warehouse`,
            slug: slugName,
            address: DEFAULT_VENDOR_ADDRESS,
            email: "vendor@example.com" 
        }
    };
    
    const createJson = await saleorFetch(createQuery, vars);
    const result = createJson.data?.[WAREHOUSE_MUTATION_NAME];

    if (result?.errors?.length > 0) {
        if (result.errors.some((e: any) => e.field === 'slug')) {
            console.log(`   🔄 Slug taken. Fetching existing...`);
            const slugSearch = await saleorFetch(query, { search: slugName });
            const found = slugSearch.data?.warehouses?.edges?.find((e:any) => e.node.slug === slugName)?.node;
            if(found) return found.id;
        }
        console.error("   ⚠️ Warehouse Creation Failed:", JSON.stringify(result.errors));
        return null;
    }
    
    const newWarehouseId = result?.warehouse?.id;

    // C. ASSIGN
    if (newWarehouseId) {
        await assignWarehouseToChannels(newWarehouseId, channels);
        
        // Ensure "Europe" zone exists and assign it
        const europeZoneId = await getOrCreateShippingZone("Europe"); 
        
        if (europeZoneId) {
            await assignShippingZoneToWarehouse(newWarehouseId, europeZoneId);
        } else {
            console.error("   ❌ Could not resolve 'Europe' shipping zone.");
        }
    }
    
    return newWarehouseId;
}

// --- SHOPIFY ---

async function fetchShopifyProducts() {
    console.log("2. 📡 Connecting to Shopify...");
    const query = `
    {
      products(first: 20, query: "status:active AND inventory_total:>0") {
        edges {
          node {
            id title vendor descriptionHtml
            images(first: 1) { edges { node { url } } }
            variants(first: 10) { edges { node { sku price inventoryQuantity } } }
          }
        }
      }
    }`;
    try {
        if (!process.env.SHOPIFY_GRAPHQL_URL) throw new Error("SHOPIFY_GRAPHQL_URL missing");
        const res = await fetch(process.env.SHOPIFY_GRAPHQL_URL, {
            method: 'POST', headers: SHOPIFY_HEADERS, body: JSON.stringify({ query })
        });
        const data: any = await res.json();
        return data.data?.products?.edges || [];
    } catch (error) {
        console.error("❌ Shopify Error:", error);
        return [];
    }
}

// --- MAIN ---

async function createInSaleor(shopifyNode: any, channels: any[]) {
    const p = shopifyNode.node;
    const normalizedTitle = p.title.trim().toLowerCase();
    
    console.log(`\n📦 Processing: "${p.title}"`);

    // 1. CHECK CACHE (INSTANT & ROBUST)
    const existingId = EXISTING_PRODUCTS.get(normalizedTitle);
    
    if (existingId) {
        console.log(`   🚫 Product "${p.title}" already exists (ID: ${existingId}). Skipping.`);
        return; // EXIT EARLY
    }

    // 2. VENDOR SETUP
    const brandPageId = await getOrCreateBrandPage(p.vendor);
    let targetWarehouseId = await getOrCreateWarehouse(p.vendor, channels); 

    if (!targetWarehouseId) {
        console.warn(`   ⚠️  Using Default Warehouse.`);
        targetWarehouseId = DEFAULT_WAREHOUSE_ID;
    }

    // Attributes
    const attributesInput = [];
    if (brandPageId) {
        attributesInput.push({
            id: BRAND_ATTRIBUTE_ID,
            references: [brandPageId]
        });
    }

    // 3. CREATE PRODUCT
    console.log(`   ✨ Creating NEW Product: "${p.title}"`);
    const descriptionJson = textToEditorJs(p.descriptionHtml || p.title);
    
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
            description: descriptionJson,
            attributes: attributesInput
        }
    };

    const prodJson = await saleorFetch(createProductQuery, productVars);
    if (prodJson.errors || prodJson.data?.productCreate?.errors?.length > 0) {
        console.error("   ❌ Creation Failed:", JSON.stringify(prodJson.errors || prodJson.data.productCreate.errors));
        return;
    }

    const finalProductId = prodJson.data?.productCreate?.product?.id;
    console.log(`   ✅ Created Product ID: ${finalProductId}`);
    
    // UPDATE CACHE (Important for preventing dupes if Shopify list has dupes)
    EXISTING_PRODUCTS.set(normalizedTitle, finalProductId);

    if (!finalProductId) return;

    // 4. CHANNELS
    const dateStr = new Date().toISOString().split('T')[0];
    const channelListings = channels.map((ch: any) => ({
        channelId: ch.id,
        isPublished: true,
        publicationDate: dateStr,
        isAvailableForPurchase: true,
        visibleInListings: true,
        availableForPurchaseAt: new Date().toISOString()
    }));
    const updateChannelQuery = `mutation UpdateChannel($id: ID!, $input: ProductChannelListingUpdateInput!) { productChannelListingUpdate(id: $id, input: $input) { errors { field } } }`;
    await saleorFetch(updateChannelQuery, { id: finalProductId, input: { updateChannels: channelListings } });

    // 5. IMAGE
    const imgUrl = p.images?.edges?.[0]?.node?.url;
    if (imgUrl) {
        const mediaQuery = `mutation AddMedia($id: ID!, $url: String!) { productMediaCreate(input: { product: $id, mediaUrl: $url }) { media { id } } }`;
        await saleorFetch(mediaQuery, { id: finalProductId, url: imgUrl });
    }

    // 6. VARIANTS
    for (const vEdge of p.variants.edges) {
        const v = vEdge.node;
        if(v.inventoryQuantity > 0) {
            await createVariant(finalProductId, v, channels, targetWarehouseId!); 
        }
    }
}

async function createVariant(prodId: string, v: any, channels: any[], warehouseId: string) {
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
            attributes: [], 
            trackInventory: true,
            stocks: [{ warehouse: warehouseId, quantity: v.inventoryQuantity }] 
        }
    };

    const varJson = await saleorFetch(createVarQuery, varVars);
    const variantId = varJson.data?.productVariantCreate?.productVariant?.id;

    if (!variantId) {
        console.error(`      ❌ Variant Failed (${sku})`);
        return;
    }

    const priceListings = channels.map((ch: any) => ({
        channelId: ch.id,
        price: shopifyPrice,
        costPrice: shopifyPrice
    }));
    const updatePriceQuery = `mutation UpdatePrice($id: ID!, $input: [ProductVariantChannelListingAddInput!]!) { productVariantChannelListingUpdate(id: $id, input: $input) { errors { field } } }`;
    await saleorFetch(updatePriceQuery, { id: variantId, input: priceListings });
    
    console.log(`      ✅ Variant ${sku} created | Stock: ${v.inventoryQuantity}`);
}

// --- EXECUTE ---
(async () => {
    try {
        console.log("------------------------------------------------");
        console.log("🛠️  STARTING IMPORT (ROBUST MODE)");
        console.log("------------------------------------------------");
        
        await runDiagnostics();
        await loadExistingProducts(); // <--- PRE-LOAD STEP
        
        const channels = await getSaleorChannels();
        if (channels.length === 0) return console.error("❌ No Channels found.");

        const products = await fetchShopifyProducts();
        for (const p of products) {
            await createInSaleor(p, channels);
        }
        console.log("\n✅ IMPORT COMPLETE");
    } catch (e) {
        console.error("FATAL ERROR:", e);
    }
})();