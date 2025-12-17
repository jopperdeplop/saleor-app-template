import dotenv from 'dotenv';
dotenv.config();

// --- CONFIGURATION ---
const SALEOR_URL = process.env.SALEOR_API_URL!;
const SALEOR_TOKEN = process.env.SALEOR_TOKEN!;
const PHOTOROOM_API_KEY = process.env.PHOTOROOM_API_KEY!;

const SALEOR_HEADERS = {
    'Authorization': `Bearer ${SALEOR_TOKEN}`.replace("Bearer Bearer", "Bearer") // Handle if token already has Bearer
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

if (!PHOTOROOM_API_KEY) {
    console.warn("⚠️  WARNING: PHOTOROOM_API_KEY not found in .env. Image processing will be skipped.");
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

// Native fetch wrapper for JSON requests
async function saleorFetch(query: string, variables: any = {}): Promise<any> {
    try {
        const res = await fetch(SALEOR_URL, {
            method: 'POST',
            headers: {
                ...SALEOR_HEADERS,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ query, variables })
        });

        if (!res.ok) {
            console.error(`   ❌ HTTP Error: ${res.status} ${res.statusText}`);
            const text = await res.text();
            console.error("   Response Body:", text);
            return {};
        }

        const json: any = await res.json();
        if (json.errors) {
            console.error("   ❌ GraphQL Errors:", JSON.stringify(json.errors));
        }
        return json;
    } catch (e) {
        console.error("   ❌ Network Error during Saleor Request:", e);
        return {};
    }
}

// --- PHOTOROOM & UPLOAD LOGIC ---

async function processImageWithPhotoroom(imageUrl: string): Promise<Blob | null> {
    if (!PHOTOROOM_API_KEY) return null;

    try {
        console.log("      🎨 Processing with Photoroom (White BG, WebP)...");

        // 1. Download image from Shopify first (More robust than sending URL to Photoroom)
        const shopifyRes = await fetch(imageUrl);
        if (!shopifyRes.ok) {
            console.error(`      ❌ Failed to download original image: ${shopifyRes.status}`);
            return null;
        }
        const originalBlob = await shopifyRes.blob();

        // 2. Upload to Photoroom
        const formData = new FormData();
        formData.append("image_file", originalBlob, "original.jpg");
        formData.append("background.color", "FFFFFF");
        formData.append("format", "webp");

        const res = await fetch("https://sdk.photoroom.com/v1/segment", {
            method: "POST",
            headers: {
                "x-api-key": PHOTOROOM_API_KEY
            },
            body: formData
        });

        if (!res.ok) {
            console.error(`      ❌ Photoroom Error request: ${res.status} ${res.statusText}`);
            const errText = await res.text();
            console.error("      Photoroom Response:", errText);
            return null;
        }

        return await res.blob();
    } catch (e) {
        console.error("      ❌ Photoroom Exception:", e);
        return null;
    }
}

async function uploadImageToSaleor(productId: string, imageBlob: Blob, altText: string) {
    console.log("      ⬆️  Uploading processed image to Saleor...");

    // GraphQL Multipart Request Specification
    const operations = {
        query: `
            mutation CreateMedia($product: ID!, $image: Upload!, $alt: String) {
                productMediaCreate(input: { product: $product, image: $image, alt: $alt }) {
                    media { id }
                    errors { field message }
                }
            }
        `,
        variables: {
            product: productId,
            image: null, // Placeholder
            alt: altText
        }
    };

    const map = {
        "0": ["variables.image"]
    };

    const formData = new FormData();
    formData.append("operations", JSON.stringify(operations));
    formData.append("map", JSON.stringify(map));
    formData.append("0", imageBlob, "image.webp");

    try {
        // Native fetch handles multipart boundary automatically when body is FormData
        const res = await fetch(SALEOR_URL, {
            method: 'POST',
            headers: SALEOR_HEADERS, // Do NOT set Content-Type here
            body: formData
        });

        const json: any = await res.json();
        if (json.data?.productMediaCreate?.errors?.length > 0) {
            console.error("      ❌ Saleor Upload Failed:", JSON.stringify(json.data.productMediaCreate.errors));
        } else {
            console.log("      ✅ Image uploaded successfully.");
        }
    } catch (e) {
        console.error("      ❌ Saleor Upload Exception:", e);
    }
}

// --- DIAGNOSTICS & CACHE ---

async function runDiagnostics() {
    console.log("🔍 Running Pre-flight Diagnostics...");
    const schemaQuery = `query { __type(name: "Mutation") { fields { name } } }`;
    const schemaJson = await saleorFetch(schemaQuery);

    if (schemaJson.errors) {
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

    // New Configuration Check
    if (PRODUCT_TYPE_ID && BRAND_ATTRIBUTE_ID) {
        await checkProductTypeConfig(PRODUCT_TYPE_ID, BRAND_ATTRIBUTE_ID);
    }

    return true;
}

async function checkProductTypeConfig(productTypeId: string, attributeId: string) {
    console.log(`   🔍 Verifying Product Type Configuration...`);
    const query = `
    query ProductTypeDetails($id: ID!) {
        productType(id: $id) {
            name
            productAttributes { id name slug inputType }
            variantAttributes { id name slug inputType }
        }
    }`;

    const json = await saleorFetch(query, { id: productTypeId });
    const pt = json.data?.productType;

    if (!pt) {
        console.error(`   ❌ CRITICAL: Product Type ${productTypeId} NOT FOUND.`);
        return;
    }

    const allAttrs = [...(pt.productAttributes || []), ...(pt.variantAttributes || [])];
    const found = allAttrs.find((a: any) => a.id === attributeId);

    if (found) {
        console.log(`      ✅ Product Type "${pt.name}" is configured with Attribute "${found.name}" (${found.slug}).`);
    } else {
        console.error(`      ❌ CRITICAL CONFIG ERROR: Product Type "${pt.name}" DOES NOT HAVE Attribute ${attributeId} assigned.`);
    }
}

async function loadExistingProducts(channelSlug: string) {
    console.log(`📥 Caching existing Saleor products (Channel: ${channelSlug})...`);
    let hasNextPage = true;
    let cursor = null;

    while (hasNextPage) {
        const query = `query GetAllProds($after: String, $channel: String) { 
            products(first: 100, after: $after, channel: $channel) { 
                pageInfo { hasNextPage endCursor } 
                edges { node { id name } } 
            } 
        }`;
        const json = await saleorFetch(query, { after: cursor, channel: channelSlug });

        if (json.errors) {
            console.error("   ❌ Error loading products:", JSON.stringify(json.errors));
            break;
        }

        const edges = json.data?.products?.edges || [];
        for (const edge of edges) {
            const normName = edge.node.name.trim().toLowerCase();
            EXISTING_PRODUCTS.set(normName, edge.node.id);
        }

        if (json.data?.products?.pageInfo?.hasNextPage) {
            cursor = json.data.products.pageInfo.endCursor;
            process.stdout.write(".");
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
    if (!json.data?.channels) {
        console.error("   ❌ No channels returned in data:", JSON.stringify(json));
    }
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
    const query = `query FindZone($search: String!) { shippingZones(filter: { search: $search }, first: 1) { edges { node { id name } } } }`;
    const json = await saleorFetch(query, { search: zoneName });
    const existing = json.data?.shippingZones?.edges?.[0]?.node;

    if (existing) return existing.id;

    console.log(`   🚚 Creating Shipping Zone: "${zoneName}"...`);
    const createQuery = `
    mutation CreateShippingZone($input: ShippingZoneCreateInput!) {
        shippingZoneCreate(input: $input) {
            shippingZone { id }
            errors { field message }
        }
    }`;

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

async function assignShippingZoneToWarehouse(warehouseId: string, zoneId: string) {
    console.log(`   🚚 Linking Warehouse (${warehouseId}) to Shipping Zone (${zoneId})...`);

    const wQuery = `query GetWarehouseZones($id: ID!) { warehouse(id: $id) { shippingZones(first: 50) { edges { node { id } } } } }`;
    const wJson = await saleorFetch(wQuery, { id: warehouseId });
    const currentZones = wJson.data?.warehouse?.shippingZones?.edges?.map((e: any) => e.node.id) || [];

    if (currentZones.includes(zoneId)) {
        console.log("      ✅ Already linked.");
        return;
    }

    const mutation = `
    mutation UpdateZone($id: ID!, $input: ShippingZoneUpdateInput!) {
        shippingZoneUpdate(id: $id, input: $input) { errors { field message } }
    }`;

    await saleorFetch(mutation, {
        id: zoneId,
        input: { addWarehouses: [warehouseId] }
    });
    console.log("   ✅ Warehouse assigned to Shipping Zone (Europe).");
}

async function getOrCreateWarehouse(vendorName: string, channels: any[]): Promise<string | null> {
    const slugName = `vendor-${vendorName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

    const query = `query FindWarehouse($search: String!) { warehouses(filter: { search: $search }, first: 1) { edges { node { id name slug } } } }`;
    const json = await saleorFetch(query, { search: vendorName });
    const existing = json.data?.warehouses?.edges?.[0]?.node;

    if (existing) return existing.id;

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
            const found = slugSearch.data?.warehouses?.edges?.find((e: any) => e.node.slug === slugName)?.node;
            if (found) return found.id;
        }
        console.error("   ⚠️ Warehouse Creation Failed:", JSON.stringify(result.errors));
        return null;
    }

    const newWarehouseId = result?.warehouse?.id;

    if (newWarehouseId) {
        await assignWarehouseToChannels(newWarehouseId, channels);
        const europeZoneId = await getOrCreateShippingZone("Europe");
        if (europeZoneId) {
            await assignShippingZoneToWarehouse(newWarehouseId, europeZoneId);
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

    // 1. VENDOR SETUP
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
            reference: brandPageId
        });
    }

    // 2. CHECK CACHE
    const existingId = EXISTING_PRODUCTS.get(normalizedTitle);

    if (existingId) {
        console.log(`   🚫 Product "${p.title}" already exists (ID: ${existingId}). Skipping.`);
        return;
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
            description: descriptionJson
        }
    };

    const prodJson = await saleorFetch(createProductQuery, productVars);
    if (prodJson.errors || prodJson.data?.productCreate?.errors?.length > 0) {
        console.error("   ❌ Creation Failed:", JSON.stringify(prodJson.errors || prodJson.data.productCreate.errors));
        return;
    }

    const finalProductId = prodJson.data?.productCreate?.product?.id;
    console.log(`   ✅ Created Product ID: ${finalProductId}`);

    // 3.1 ATTRIBUTE UPDATE
    if (attributesInput.length > 0 && finalProductId) {
        console.log(`      🔗 Assigning Brand Attribute via Update...`);
        const updateQuery = `
        mutation UpdateProductAttrs($id: ID!, $input: ProductInput!) {
            productUpdate(id: $id, input: $input) { errors { field message } }
        }`;
        await saleorFetch(updateQuery, {
            id: finalProductId,
            input: { attributes: attributesInput }
        });
        console.log(`      ✅ Brand Attribute Assigned Successfully!`);
    }

    // UPDATE CACHE
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
        availableForPurchaseAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    }));
    const updateChannelQuery = `mutation UpdateChannel($id: ID!, $input: ProductChannelListingUpdateInput!) { productChannelListingUpdate(id: $id, input: $input) { errors { field } } }`;
    await saleorFetch(updateChannelQuery, { id: finalProductId, input: { updateChannels: channelListings } });

    // 5. IMAGE (Photoroom Integration)
    const imgUrl = p.images?.edges?.[0]?.node?.url;
    if (imgUrl) {
        let processed = false;
        // Try Photoroom first
        const imageBlob = await processImageWithPhotoroom(imgUrl);
        if (imageBlob) {
            await uploadImageToSaleor(finalProductId, imageBlob, p.title);
            processed = true;
        }

        // Fallback to URL upload if Photoroom failed or skipped
        if (!processed) {
            console.log("   Using original image URL (fallback)...");
            const mediaQuery = `mutation AddMedia($id: ID!, $url: String!, $alt: String) { productMediaCreate(input: { product: $id, mediaUrl: $url, alt: $alt }) { media { id } } }`;
            await saleorFetch(mediaQuery, { id: finalProductId, url: imgUrl, alt: p.title });
            console.log("   📸 Image attached (Original URL).");
        }
    } else {
        console.warn("   ⚠️  No Image URL found in Shopify data for this product. Skipping image.");
    }

    // 6. VARIANTS
    for (const vEdge of p.variants.edges) {
        const v = vEdge.node;
        if (v.inventoryQuantity > 0) {
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
        console.log("🛠️  STARTING IMPORT WITH PHOTOROOM");
        console.log("------------------------------------------------");

        // DEBUG: Check Auth
        if (!SALEOR_HEADERS.Authorization || SALEOR_HEADERS.Authorization.length < 10) {
            console.error("❌ CRITICAL: Authorization Header is missing or too short! Check .env SALEOR_TOKEN");
            if (SALEOR_HEADERS.Authorization) console.log("   Header Value:", SALEOR_HEADERS.Authorization);
        } else {
            console.log("   🔑 Auth Token detected (Length: " + SALEOR_HEADERS.Authorization.length + ")");
        }

        await runDiagnostics();

        // 1. Get Channels FIRST
        const channels = await getSaleorChannels();
        if (channels.length === 0) return console.error("❌ No Channels found (or Auth failed).");

        // 2. Load Cache (using default channel)
        const defaultChannelSlug = channels[0].slug;
        await loadExistingProducts(defaultChannelSlug);

        const products = await fetchShopifyProducts();
        for (const p of products) {
            await createInSaleor(p, channels);
        }
        console.log("\n✅ IMPORT COMPLETE");
    } catch (e) {
        console.error("FATAL ERROR:", e);
    }
})();
