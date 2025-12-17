
import { task } from "@trigger.dev/sdk/v3";
import { db } from "../db";
import { integrations } from "../db/schema";
import { eq } from "drizzle-orm";
import { makeSaleorClient, PRODUCT_CREATE, PRODUCT_VARIANT_CREATE, PRODUCT_TYPE_QUERY } from "../lib/saleor-client";

// --- CONFIGURATION FROM ENV ---
const BRAND_MODEL_TYPE_ID = process.env.SALEOR_BRAND_MODEL_TYPE_ID;
const BRAND_ATTRIBUTE_ID = process.env.SALEOR_BRAND_ATTRIBUTE_ID;
const PRODUCT_TYPE_ID = process.env.SALEOR_PRODUCT_TYPE_ID;
const CATEGORY_ID = process.env.SALEOR_CATEGORY_ID;
const DEFAULT_WAREHOUSE_ID = process.env.SALEOR_WAREHOUSE_ID;
const PHOTOROOM_API_KEY = process.env.PHOTOROOM_API_KEY;

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
            console.error("❌ Integration not found");
            throw new Error("Integration not found");
        }

        console.log(`   ✅ Found Integration: ${integration.provider} @ ${integration.storeUrl}`);

        // 2. Setup Saleor Client
        const apiUrl = process.env.SALEOR_API_URL;
        const saleorToken = (process.env.SALEOR_APP_TOKEN || process.env.SALEOR_TOKEN || "").replace(/^Bearer\s+/i, "");

        if (!apiUrl || !saleorToken) {
            throw new Error("Missing SALEOR_API_URL or SALEOR_TOKEN");
        }

        // Helper wrapper for Saleor Requests using urql client is possible, but for File Uploads and dynamic queries
        // logic from reference script used fetch. We will use the structured makeSaleorClient for standard ops,
        // and raw fetch for uploads/complex logic if needed, or stick to the client.
        // Let's stick to the REFERENCE SCRIPT style for stability as requested.

        const saleorHeaders = {
            'Authorization': `Bearer ${saleorToken}`,
            'Content-Type': 'application/json'
        };

        const saleorFetch = async (query: string, variables: any = {}) => {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: saleorHeaders,
                body: JSON.stringify({ query, variables })
            });
            const json: any = await res.json();
            if (json.errors) console.error("   ❌ GraphQL Errors:", JSON.stringify(json.errors));
            return json;
        };

        // 3. Fetch Shopify Products
        console.log("   📡 Connecting to actual Shopify Store...");
        const shopifyQuery = `
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

        const shopifyRes = await fetch(`https://${integration.storeUrl}/admin/api/2023-10/graphql.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': integration.accessToken || ""
            },
            body: JSON.stringify({ query: shopifyQuery })
        });

        if (shopifyRes.status === 403 || shopifyRes.status === 401) {
            throw new Error(`Shopify API Access Denied (${shopifyRes.status}). Ensure specific scopes are granted.`);
        }

        const shopifyJson: any = await shopifyRes.json();
        const products = shopifyJson.data?.products?.edges || [];
        console.log(`   📦 Fetched ${products.length} products from Shopify.`);

        // 4. SYNC LOOP
        // Using "saleorFetch" helper defined above to keep logic close to reference script

        // Helper: Get Channels
        const channelsJson = await saleorFetch(`{ channels { id slug currencyCode isActive } }`);
        const channels = channelsJson.data?.channels || [];
        if (channels.length === 0) throw new Error("No Saleor Channels found.");

        // Helper: Create/Get Brand Page
        const getOrCreateBrandPage = async (name: string) => {
            if (!BRAND_MODEL_TYPE_ID) return null;
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

            const newProductId = productRes.data?.productCreate?.product?.id;

            if (!newProductId) {
                console.error("      ❌ Failed to create product:", JSON.stringify(productRes.data?.productCreate?.errors));
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
                        headers: { 'Authorization': `Bearer ${saleorToken}` },
                        body: fd
                    });
                    console.log("      📸 Image uploaded.");
                }
            }

            // E. Variants
            const defaultWarehouse = DEFAULT_WAREHOUSE_ID; // Simplified for MVP: Use default warehouse
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
