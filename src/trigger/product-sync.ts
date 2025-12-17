
import { task } from "@trigger.dev/sdk/v3";
import { db } from "../db";
import { integrations } from "../db/schema";
import { eq } from "drizzle-orm";

// --- CONFIGURATION FROM ENV ---
const BRAND_MODEL_TYPE_ID = process.env.SALEOR_BRAND_MODEL_TYPE_ID;
const BRAND_ATTRIBUTE_ID = process.env.SALEOR_BRAND_ATTRIBUTE_ID;
const PRODUCT_TYPE_ID = process.env.SALEOR_PRODUCT_TYPE_ID;
const CATEGORY_ID = process.env.SALEOR_CATEGORY_ID;
const DEFAULT_WAREHOUSE_ID = process.env.SALEOR_WAREHOUSE_ID;
const PHOTOROOM_API_KEY = process.env.PHOTOROOM_API_KEY;

// --- HELPERS ---

function textToEditorJs(text: string) {
    const cleanText = text ? text.replace(/\n/g, "<br>") : "";
    return JSON.stringify({
        time: Date.now(),
        blocks: [{ type: "paragraph", data: { text: cleanText } }],
        version: "2.25.0"
    });
}

async function processImageWithPhotoroom(imageUrl: string): Promise<Blob | null> {
    if (!PHOTOROOM_API_KEY) return null;

    try {
        console.log("      🎨 Processing with Photoroom...");
        const shopifyRes = await fetch(imageUrl);
        if (!shopifyRes.ok) return null;
        const originalBlob = await shopifyRes.blob();

        const formData = new FormData();
        formData.append("image_file", originalBlob, "original.jpg");
        formData.append("background.color", "FFFFFF");
        formData.append("format", "webp");

        const res = await fetch("https://sdk.photoroom.com/v1/segment", {
            method: "POST",
            headers: { "x-api-key": PHOTOROOM_API_KEY },
            body: formData
        });

        if (!res.ok) {
            console.error(`      ❌ Photoroom Error: ${res.status}`);
            return null;
        }
        return await res.blob();
    } catch (e) {
        console.error("      ❌ Photoroom Exception:", e);
        return null;
    }
}

// --- TASK DEFINITION ---

export const importShopifyProducts = task({
    id: "import-shopify-products",
    run: async (payload: { integrationId: number }) => {
        console.log(`🚀 Starting Robust Product Sync for Integration ID: ${payload.integrationId}`);

        // 1. Fetch Integration
        const integration = await db.query.integrations.findFirst({
            where: eq(integrations.id, payload.integrationId)
        });

        if (!integration) {
            throw new Error("Integration not found");
        }

        console.log(`   ✅ Found Integration: ${integration.provider} @ ${integration.storeUrl}`);

        // 2. Setup Saleor Client
        const apiUrl = process.env.SALEOR_API_URL;
        let saleorToken = (process.env.SALEOR_APP_TOKEN || process.env.SALEOR_TOKEN || "").trim();
        // Handle Bearer prefix duplication/missing
        if (!saleorToken.toLowerCase().startsWith("bearer ")) {
            saleorToken = `Bearer ${saleorToken}`;
        }
        // If it was "Bearer Bearer", fix it (common env var mistake)
        saleorToken = saleorToken.replace(/^Bearer\s+Bearer\s+/i, "Bearer ");


        if (!apiUrl || !saleorToken) {
            throw new Error("Missing SALEOR_API_URL or SALEOR_TOKEN");
        }

        const saleorHeaders = {
            'Authorization': saleorToken,
            'Content-Type': 'application/json'
        };

        const saleorFetch = async (query: string, variables: any = {}) => {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: saleorHeaders,
                body: JSON.stringify({ query, variables })
            });

            if (!res.ok) {
                const txt = await res.text();
                console.error(`   ❌ Saleor HTTP ${res.status}:`, txt);
                return {};
            }

            const json: any = await res.json();
            if (json.errors) console.error("   ❌ GraphQL Errors:", JSON.stringify(json.errors));
            return json;
        };

        // 3. Fetch Shopify Products
        console.log("   📡 Connecting to actual Shopify Store (API 2024-04)...");

        const fetchShopify = async (filterQuery: string) => {
            const graphqlQuery = `
                {
                products(first: 20${filterQuery ? `, query: "${filterQuery}"` : ""}) {
                    edges {
                    node {
                        id title vendor descriptionHtml
                        images(first: 1) { edges { node { url } } }
                        variants(first: 10) { edges { node { sku price inventoryQuantity } } }
                    }
                    }
                }
                }`;

            const res = await fetch(`https://${integration.storeUrl}/admin/api/2024-04/graphql.json`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': integration.accessToken || ""
                },
                body: JSON.stringify({ query: graphqlQuery })
            });

            return res;
        };

        // Attempt 1: Strict Filter (Standard Behavior)
        // Matches the Reference Script: "status:active AND inventory_total:>0"
        let products = [];
        let res = await fetchShopify("status:active AND inventory_total:>0");

        if (res.status === 403 || res.status === 401) {
            throw new Error(`Shopify API Access Denied (${res.status}). Ensure specific scopes are granted.`);
        }

        let json: any = await res.json();
        products = json.data?.products?.edges || [];

        console.log(`   📦 Fetched ${products.length} products (Strict Filter).`);

        // FALLBACK: If 0 products, try relaxed filter to diagnose
        if (products.length === 0) {
            console.log("   ⚠️  No products found with strict filter. Retrying with loose filter to check visibility...");
            res = await fetchShopify(""); // No filter
            json = await res.json();
            const allProducts = json.data?.products?.edges || [];

            if (allProducts.length > 0) {
                console.log(`   ⚠️  FOUND ${allProducts.length} products with NO filter!`);
                console.log("   ℹ️  The products likely have status='Draft' or inventory=0.");
                console.log("   ℹ️  Forcing sync of these found products anyway for testing.");
                products = allProducts;
            } else {
                console.log("   ❌ Still 0 products with no filter. The App likely has no product access (Check 'Sales Channel' availability in Shopify).");
            }
        }

        // 4. SYNC LOOP

        // Helper: Get Channels
        const channelsJson = await saleorFetch(`{ channels { id slug currencyCode isActive } }`);
        const channels = channelsJson.data?.channels || [];
        if (channels.length === 0) {
            console.error("❌ No Saleor Channels found. Cannot sync.");
            return;
        }

        // Helper: Create/Get Brand Page
        const getOrCreateBrandPage = async (name: string) => {
            if (!BRAND_MODEL_TYPE_ID || !name) return null;
            const find = await saleorFetch(`query Find($n:String!){pages(filter:{search:$n},first:1){edges{node{id}}}}`, { n: name });
            if (find.data?.pages?.edges?.[0]) return find.data.pages.edges[0].node.id;

            console.log(`      ✨ Creating Brand Page: "${name}"`);
            const create = await saleorFetch(`mutation Create($n:String!,$t:ID!){pageCreate(input:{title:$n,pageType:$t,isPublished:true,content:"{}"}){page{id}}}`, { n: name, t: BRAND_MODEL_TYPE_ID });
            return create.data?.pageCreate?.page?.id;
        };

        // Loop through products
        for (const edge of products) {
            const p = edge.node;
            console.log(`\n   🔄 Processing: ${p.title}`);

            // A. Vendor/Brand
            const brandId = await getOrCreateBrandPage(p.vendor);
            const attributesInput = [];
            if (brandId && BRAND_ATTRIBUTE_ID) {
                attributesInput.push({ id: BRAND_ATTRIBUTE_ID, reference: brandId });
            }

            // B. Create Product
            const desc = textToEditorJs(p.descriptionHtml || p.title);
            const createQuery = `
            mutation CreateProduct($input: ProductCreateInput!) {
                productCreate(input: $input) {
                    product { id }
                    errors { field message }
                }
            }`;

            const productRes = await saleorFetch(createQuery, {
                input: {
                    name: p.title,
                    productType: PRODUCT_TYPE_ID,
                    category: CATEGORY_ID,
                    description: desc,
                    attributes: attributesInput
                }
            });

            // Check for specific error: "Product with this slug already exists"
            // If so, we should probably fetch it (update logic), but for now just logging.

            const newProductId = productRes.data?.productCreate?.product?.id;

            if (!newProductId) {
                console.error("      ❌ Failed to create product:", JSON.stringify(productRes.data?.productCreate?.errors));
                // Try finding it?
                continue;
            }
            console.log(`      ✅ Created Product ID: ${newProductId}`);

            // C. Channel Listings
            const dateStr = new Date().toISOString().split('T')[0];
            const channelListings = channels.map((ch: any) => ({
                channelId: ch.id,
                isPublished: true,
                publicationDate: dateStr,
                isAvailableForPurchase: true,
                visibleInListings: true
            }));
            await saleorFetch(`mutation Upd($id:ID!,$in:ProductChannelListingUpdateInput!){productChannelListingUpdate(id:$id,input:$in){errors{field}}}`, {
                id: newProductId,
                input: { updateChannels: channelListings }
            });

            // D. Image Processing
            const imgUrl = p.images?.edges?.[0]?.node?.url;
            if (imgUrl) {
                let blob = await processImageWithPhotoroom(imgUrl);
                if (!blob) {
                    // Fallback to original
                    const fallbackRes = await fetch(imgUrl);
                    if (fallbackRes.ok) blob = await fallbackRes.blob();
                }

                if (blob) {
                    // Upload
                    console.log("      ⬆️ Uploading image...");
                    const fd = new FormData();
                    fd.append("operations", JSON.stringify({
                        query: `mutation($product:ID!,$image:Upload!){productMediaCreate(input:{product:$product,image:$image}){media{id} errors{message}}}`,
                        variables: { product: newProductId, image: null }
                    }));
                    fd.append("map", JSON.stringify({ "0": ["variables.image"] }));
                    fd.append("0", blob, "image.webp");

                    // Native fetch for multipart
                    // Note: No headers for Content-Type here!
                    await fetch(apiUrl, {
                        method: 'POST',
                        headers: { 'Authorization': saleorToken },
                        body: fd
                    });
                    console.log("      📸 Image uploaded.");
                }
            }

            // E. Variants
            const defaultWarehouse = DEFAULT_WAREHOUSE_ID;
            for (const vEdge of p.variants.edges) {
                const v = vEdge.node;
                const sku = v.sku || `SKU-${Math.random().toString(36).substring(7)}`;
                const price = parseFloat(v.price);

                const varRes = await saleorFetch(`mutation CreateVar($input: ProductVariantCreateInput!) {
                    productVariantCreate(input: $input) { productVariant { id } errors { field message } }
                 }`, {
                    input: {
                        product: newProductId,
                        sku: sku,
                        attributes: [],
                        trackInventory: true,
                        stocks: defaultWarehouse ? [{ warehouse: defaultWarehouse, quantity: v.inventoryQuantity }] : []
                    }
                });

                const varId = varRes.data?.productVariantCreate?.productVariant?.id;
                if (varId) {
                    // Price Listing
                    const priceListings = channels.map((ch: any) => ({
                        channelId: ch.id,
                        price: price,
                        costPrice: price
                    }));
                    await saleorFetch(`mutation UpdPrice($id:ID!,$in:[ProductVariantChannelListingAddInput!]!){productVariantChannelListingUpdate(id:$id,input:$in){errors{field}}}`, {
                        id: varId,
                        input: priceListings
                    });
                    console.log(`      ✅ Variant ${sku} created.`);
                } else {
                    console.error("      ❌ Variant failed:", JSON.stringify(varRes.data?.productVariantCreate?.errors));
                }
            }

        }

        console.log("✅ Sync Complete");
    },
});
