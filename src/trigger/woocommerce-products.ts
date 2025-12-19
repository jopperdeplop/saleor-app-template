import { task } from "@trigger.dev/sdk";
import { db } from "../db";
import { integrations } from "../db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "../lib/encryption";

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

// --- TASK DEFINITION ---

export const woocommerceProductSync = task({
    id: "woocommerce-product-sync",
    run: async (payload: { integrationId: number }) => {
        console.log(`🚀 Starting WooCommerce Product Sync for Integration [${payload.integrationId}]`);

        // --- 1. SETUP & AUTH ---
        const integration = await db.query.integrations.findFirst({ where: eq(integrations.id, payload.integrationId) });
        if (!integration) throw new Error("Integration not found");
        if (integration.provider !== "woocommerce") {
            console.warn(`⚠️ skipping: Integration ${payload.integrationId} is not WooCommerce`);
            return;
        }

        if (!integration.storeUrl) {
            throw new Error(`Integration ${payload.integrationId} is missing a storeUrl. Please disconnect and reconnect your store.`);
        }

        const settings = integration.settings as any;
        const consumerKey = integration.accessToken; // consumer_key
        let consumerSecret = "";

        if (settings?.consumerSecret) {
            consumerSecret = decrypt(settings.consumerSecret);
        }

        if (!consumerKey || !consumerSecret) throw new Error("Missing WooCommerce API credentials");

        const wcHeaders = {
            'Authorization': `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`,
            'Content-Type': 'application/json'
        };

        const apiUrl = process.env.SALEOR_API_URL;
        let saleorToken = (process.env.SALEOR_APP_TOKEN || process.env.SALEOR_TOKEN || "").trim();
        if (saleorToken) {
            saleorToken = `Bearer ${saleorToken.replace(/^bearer\s+/i, "")}`;
        }

        if (!apiUrl || !saleorToken) throw new Error("Missing SALEOR_API_URL or SALEOR_TOKEN");

        const saleorHeaders = {
            'Authorization': saleorToken,
            'Content-Type': 'application/json'
        };

        // Helper: Centralized Fetch (Mirrors Shopify Baseline)
        const saleorFetch = async (query: string, variables: any = {}) => {
            try {
                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: saleorHeaders,
                    body: JSON.stringify({ query, variables })
                });
                if (!res.ok) {
                    console.error(`   ❌ Saleor HTTP ${res.status}:`, await res.text());
                    return {};
                }
                const json: any = await res.json();
                if (json.errors) {
                    console.error("   ❌ Saleor Error:", JSON.stringify(json.errors[0]?.message || json.errors));
                }
                return json;
            } catch (e) {
                console.error("   ❌ Network Error during Saleor Request:", e);
                return {};
            }
        };

        const getSaleorChannels = async () => {
            const query = `{ channels { id slug currencyCode isActive } }`;
            const json = await saleorFetch(query);
            return json.data?.channels || [];
        };

        const getOrCreateBrandPage = async (name: string) => {
            if (!name) return null;
            const find = await saleorFetch(`query Find($n:String!){pages(filter:{search:$n},first:1){edges{node{id title isPublished}}}}`, { n: name });
            const existing = find.data?.pages?.edges?.[0]?.node;
            if (existing) {
                if (!existing.isPublished) {
                    await saleorFetch(`mutation Pub($id:ID!){pageUpdate(id:$id,input:{isPublished:true}){errors{field}}}`, { id: existing.id });
                }
                return existing.id;
            }
            console.log(`   ✨ Creating Brand Page: "${name}"`);
            const create = await saleorFetch(`mutation Create($n:String!,$t:ID!){pageCreate(input:{title:$n,pageType:$t,isPublished:true,content:"{}"}){page{id}}}`, { n: name, t: BRAND_MODEL_TYPE_ID });
            return create.data?.pageCreate?.page?.id;
        };

        const getOrCreateShippingZone = async (name: string) => {
            const find = await saleorFetch(`query Find($s:String!){shippingZones(filter:{search:$s},first:1){edges{node{id}}}}`, { s: name });
            if (find.data?.shippingZones?.edges?.[0]) return find.data.shippingZones.edges[0].node.id;

            console.log(`   🚚 Creating Shipping Zone: "${name}"`);
            const countries = ["DE", "FR", "GB", "IT", "ES", "PL", "NL", "BE", "AT", "PT", "SE", "DK", "FI", "NO", "IE", "US", "CA"];
            const create = await saleorFetch(`mutation CreateZone($input:ShippingZoneCreateInput!){shippingZoneCreate(input:$input){shippingZone{id} errors{message}}}`, {
                input: { name, countries }
            });
            return create.data?.shippingZoneCreate?.shippingZone?.id;
        };

        const getOrCreateWarehouse = async (vendorName: string, channels: any[]) => {
            const slug = `vendor-${vendorName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
            const find = await saleorFetch(`query Find($s:String!){warehouses(filter:{search:$s},first:1){edges{node{id slug}}}}`, { s: vendorName });

            const existing = find.data?.warehouses?.edges?.[0]?.node;
            if (existing) return existing.id;

            console.log(`   🏭 Creating Warehouse for: "${vendorName}"`);
            const createRes = await saleorFetch(`mutation CreateWarehouse($input:WarehouseCreateInput!){warehouseCreate(input:$input){warehouse{id} errors{field message code}}}`, {
                input: {
                    name: `${vendorName} Warehouse`,
                    slug: slug,
                    address: DEFAULT_VENDOR_ADDRESS,
                    email: "vendor@example.com"
                }
            });

            const result = createRes.data?.warehouseCreate;
            if (result?.errors?.length > 0) {
                if (result.errors.some((e: any) => e.field === 'slug')) {
                    const slugSearch = await saleorFetch(`query FindS($s:String!){warehouses(filter:{search:$s},first:5){edges{node{id slug}}}}`, { s: slug });
                    const found = slugSearch.data?.warehouses?.edges?.find((e: any) => e.node.slug === slug)?.node;
                    if (found) return found.id;
                }
                console.error("   ⚠️ Warehouse Creation Failed:", JSON.stringify(result.errors));
                return null;
            }

            const newId = result?.warehouse?.id;
            if (newId) {
                for (const ch of channels) {
                    await saleorFetch(`mutation UpdCh($id:ID!,$input:ChannelUpdateInput!){channelUpdate(id:$id,input:$input){errors{field}}}`, { id: ch.id, input: { addWarehouses: [newId] } });
                }
                const zoneId = await getOrCreateShippingZone("Europe");
                if (zoneId) {
                    await saleorFetch(`mutation UpdZone($id:ID!,$input:ShippingZoneUpdateInput!){shippingZoneUpdate(id:$id,input:$input){errors{field}}}`, { id: zoneId, input: { addWarehouses: [newId] } });
                }
            }
            return newId;
        };

        async function processImage(productId: string, imageUrl: string, title: string) {
            console.log(`      🎨 Managing Media: ${imageUrl}`);
            const mediaRes = await saleorFetch(`query GetMedia($id:ID!){product(id:$id){media{id}}}`, { id: productId });
            const existingMedia = mediaRes.data?.product?.media || [];

            if (existingMedia.length > 0) {
                console.log(`      🧹 Deleting ${existingMedia.length} existing images to replace...`);
                for (const media of existingMedia) {
                    await saleorFetch(`mutation DelMedia($id:ID!){productMediaDelete(id:$id){errors{field message}}}`, { id: media.id });
                }
            }

            let imageBlob: Blob | null = null;
            if (PHOTOROOM_API_KEY) {
                try {
                    console.log(`      🧪 Sending to Photoroom for Background Removal...`);
                    const imgRes = await fetch(imageUrl);
                    if (imgRes.ok) {
                        const originalBlob = await imgRes.blob();
                        const formData = new FormData();
                        formData.append("image_file", originalBlob, "original.jpg");
                        formData.append("background.color", "FFFFFF");
                        formData.append("format", "webp");
                        const prRes = await fetch("https://sdk.photoroom.com/v1/segment", {
                            method: "POST",
                            headers: { "x-api-key": PHOTOROOM_API_KEY },
                            body: formData
                        });
                        if (prRes.ok) {
                            imageBlob = await prRes.blob();
                            console.log(`      ✨ Photoroom processed successfully.`);
                        } else {
                            console.error(`      ❌ Photoroom Error [${prRes.status}]:`, await prRes.text());
                        }
                    }
                } catch (e) {
                    console.error("      ❌ Photoroom Processing Exception:", e);
                }
            }

            if (imageBlob) {
                const fd = new FormData();
                const ops = {
                    query: `mutation CreateMedia($p: ID!, $i: Upload!, $a: String) { productMediaCreate(input: { product: $p, image: $i, alt: $a }) { media { id } errors { field message } } }`,
                    variables: { p: productId, i: null, a: title }
                };
                fd.append("operations", JSON.stringify(ops));
                fd.append("map", JSON.stringify({ "0": ["variables.i"] }));
                fd.append("0", imageBlob, "image.webp");
                const res = await fetch(apiUrl!, { method: 'POST', headers: { 'Authorization': saleorToken }, body: fd });
                const json: any = await res.json();
                if (json.data?.productMediaCreate?.errors?.length > 0) {
                    console.error("      ❌ Media Multipart Upload Failed:", JSON.stringify(json.data.productMediaCreate.errors));
                } else {
                    console.log("      ✅ Image replaced via Photoroom Blob.");
                }
            } else {
                console.log("      ℹ️ Photoroom skipped/failed. Falling back to original URL upload...");
                const res = await saleorFetch(`mutation AddMedia($id: ID!, $url: String!, $alt: String) { productMediaCreate(input: { product: $id, mediaUrl: $url, alt: $alt }) { media { id } errors { field message } } }`, {
                    id: productId, url: imageUrl, alt: title
                });
                if (res.data?.productMediaCreate?.errors?.length > 0) {
                    console.error("      ❌ Media URL Fallback Failed:", JSON.stringify(res.data.productMediaCreate.errors));
                } else {
                    console.log("      ✅ Image replaced via URL.");
                }
            }
        }

        // --- 2. FETCH WOOCOMMERCE DATA ---
        console.log(`📡 Connecting to WooCommerce at ${integration.storeUrl}...`);
        const wcResponse = await fetch(`${integration.storeUrl}/wp-json/wc/v3/products?per_page=100`, { headers: wcHeaders });
        if (!wcResponse.ok) {
            const errBody = await wcResponse.text();
            throw new Error(`WooCommerce API Error (${wcResponse.status}): ${errBody}`);
        }
        const products = await wcResponse.json();
        console.log(`📦 Fetched ${products.length} products from WooCommerce.`);

        const channels = await getSaleorChannels();
        if (channels.length === 0) throw new Error("No Channels found in Saleor.");

        // --- 3. PARALLEL PROCESSING ---
        console.log(`🔄 Starting Parallel Processing for ${products.length} products...`);

        await Promise.all(products.map(async (p: any) => {
            console.log(`\n🧵 Processing WooCommerce Product [ID: ${p.id}]: "${p.name}"`);
            console.log(`   - Type: ${p.type}`);
            console.log(`   - SKU: ${p.sku || 'N/A'}`);
            console.log(`   - Price: ${p.price}`);
            console.log(`   - Stock: ${p.stock_quantity ?? 'N/A'} (Status: ${p.stock_status})`);
            console.log(`   - Media Count: ${p.images?.length || 0}`);

            const cleanTitle = p.name.trim();
            const predictableSlug = p.slug || cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const vendor = new URL(integration.storeUrl).hostname;

            const brandPageId = await getOrCreateBrandPage(vendor);
            let targetWarehouseId = await getOrCreateWarehouse(vendor, channels);
            if (!targetWarehouseId) targetWarehouseId = DEFAULT_WAREHOUSE_ID;

            // Find or Create Product (Structural Parity with Shopify)
            let finalProductId: string | null = null;
            const slugCheck = await saleorFetch(`query FindSlug($s:String!){product(slug:$s){id}}`, { s: predictableSlug });
            finalProductId = slugCheck.data?.product?.id;

            if (finalProductId) {
                console.log(`   ✨ Syncing existing Saleor Product: "${cleanTitle}" (${finalProductId})`);
            } else {
                console.log(`   ➕ Creating new Saleor Product: "${cleanTitle}" (Slug: ${predictableSlug})`);
            }

            if (!finalProductId) {
                const createRes = await saleorFetch(`mutation Create($input:ProductCreateInput!){productCreate(input:$input){product{id} errors{field message}}}`, {
                    input: {
                        name: p.name,
                        slug: predictableSlug,
                        externalReference: p.id.toString(),
                        productType: PRODUCT_TYPE_ID,
                        category: CATEGORY_ID,
                        description: textToEditorJs(p.description || p.short_description || p.name)
                    }
                });
                finalProductId = createRes.data?.productCreate?.product?.id;
            } else {
                await saleorFetch(`mutation Update($id:ID!,$input:ProductInput!){productUpdate(id:$id,input:$input){errors{field message}}}`, {
                    id: finalProductId,
                    input: {
                        description: textToEditorJs(p.description || p.short_description || p.name),
                        externalReference: p.id.toString()
                    }
                });
            }

            if (!finalProductId) {
                console.error(`   ❌ Failed to find or create product for WC ID ${p.id}`);
                return;
            }

            // Assign Brand Attribute
            if (brandPageId && BRAND_ATTRIBUTE_ID) {
                await saleorFetch(`mutation UpdateProd($id:ID!,$input:ProductInput!){productUpdate(id:$id,input:$input){errors{field message}}}`, {
                    id: finalProductId,
                    input: { attributes: [{ id: BRAND_ATTRIBUTE_ID, reference: brandPageId }] }
                });
            }

            // Channel Listing
            const dateStr = new Date().toISOString().split('T')[0];
            const channelListings = channels.map((ch: any) => ({
                channelId: ch.id,
                isPublished: p.status === 'publish',
                publicationDate: dateStr,
                isAvailableForPurchase: true,
                visibleInListings: true,
                availableForPurchaseAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            }));
            await saleorFetch(`mutation UpdChannel($id:ID!,$input:ProductChannelListingUpdateInput!){productChannelListingUpdate(id:$id,input:$input){errors{field}}}`, {
                id: finalProductId, input: { updateChannels: channelListings }
            });

            // Media (Using First Image)
            if (p.images && p.images.length > 0) {
                const imgUrl = p.images[0].src;
                await processImage(finalProductId, imgUrl, p.name);
            }

            // Variants Synchronization
            let wcVariations = [];
            if (p.type === 'variable') {
                console.log(`   📑 Fetching Variations for Variable Product [WC ID: ${p.id}]...`);
                const vRes = await fetch(`${integration.storeUrl}/wp-json/wc/v3/products/${p.id}/variations`, { headers: wcHeaders });
                if (vRes.ok) {
                    wcVariations = await vRes.json();
                    console.log(`   📦 Found ${wcVariations.length} variations.`);
                } else {
                    console.error(`   ❌ Failed to fetch variations for WC ID ${p.id}`);
                }
            } else {
                console.log(`   🏷️ Treating simple product as single variation.`);
                // User Requirement: Use SKU from WooCommerce (Simple Product)
                wcVariations = [{
                    id: p.id,
                    sku: p.sku || `WC-${p.id}`,
                    price: p.price,
                    manage_stock: p.manage_stock,
                    stock_quantity: p.stock_quantity,
                    stock_status: p.stock_status,
                    attributes: []
                }];
            }

            // --- Variants Replacement & Sync (Mirrors Shopify Baseline) ---
            const existingVarData = await saleorFetch(`query GetVars($id:ID!){product(id:$id){variants{id sku}}}`, { id: finalProductId });
            const existingVariantIds = (existingVarData.data?.product?.variants || []).map((v: any) => v.id);
            if (existingVariantIds.length > 0) {
                console.log(`      🧹 Deleting ${existingVariantIds.length} existing variants for replacement sync...`);
                await saleorFetch(`mutation BulkDelete($ids:[ID!]!){productVariantBulkDelete(ids:$ids){errors{field message}}}`, { ids: existingVariantIds });
            }

            for (const v of wcVariations) {
                const sku = v.sku || `WC-V-${v.id}`;
                console.log(`      ➕ Creating Variant: "${sku}" (External ID: ${v.id})`);

                let quantity = 0;
                if (v.manage_stock) {
                    quantity = v.stock_quantity || 0;
                } else {
                    quantity = v.stock_status === 'instock' ? 100 : 0;
                }

                const varRes = await saleorFetch(`mutation CreateVar($input:ProductVariantCreateInput!){productVariantCreate(input:$input){productVariant{id} errors{field message}}}`, {
                    input: {
                        product: finalProductId,
                        sku: sku,
                        name: v.attributes?.map((a: any) => a.option).join(' / ') || "Default",
                        externalReference: v.id.toString(),
                        trackInventory: true,
                        stocks: targetWarehouseId ? [{ warehouse: targetWarehouseId, quantity }] : []
                    }
                });
                const variantId = varRes.data?.productVariantCreate?.productVariant?.id;

                if (variantId) {
                    const price = parseFloat(v.price || "0");
                    const priceListings = channels.map((ch: any) => ({
                        channelId: ch.id, price: price, costPrice: price
                    }));
                    await saleorFetch(`mutation UpdatePrice($id:ID!,$input:[ProductVariantChannelListingAddInput!]!){productVariantChannelListingUpdate(id:$id,input:$input){errors{field}}}`, {
                        id: variantId, input: priceListings
                    });
                    console.log(`      ✅ Variant sync successful [Saleor ID: ${variantId}]`);
                } else {
                    console.error(`      ❌ Variant sync failed for SKU: ${sku}`);
                }
            }
        }));

        console.log(`\n✅ ${products.length} WooCommerce products synced successfully.`);
    }
});
