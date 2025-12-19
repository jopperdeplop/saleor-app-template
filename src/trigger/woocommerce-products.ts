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

// --- HELPERS (Literal Port from Shopify Baseline) ---

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
        console.log(`🚀 Starting WooCommerce Sync Task [Integration: ${payload.integrationId}]`);

        // --- 1. SETUP & AUTH ---
        const integration = await db.query.integrations.findFirst({ where: eq(integrations.id, payload.integrationId) });
        if (!integration) throw new Error("Integration not found");
        if (integration.provider !== "woocommerce") {
            console.warn(`⚠️ skipping: Integration ${payload.integrationId} is not WooCommerce`);
            return;
        }

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

        const settings = integration.settings as any;
        const consumerKey = integration.accessToken;
        let consumerSecret = "";
        if (settings?.consumerSecret) consumerSecret = decrypt(settings.consumerSecret);

        if (!consumerKey || !consumerSecret) throw new Error("Missing WooCommerce API credentials");
        const wcHeaders = {
            'Authorization': `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')}`,
            'Content-Type': 'application/json'
        };

        // Helper: Centralized Fetch (Literal Port from Shopify Baseline)
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
                    // Deep logging for debugging
                    console.error("   ❌ Saleor Error Structure:", JSON.stringify(json.errors, null, 2));
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
            // Literal Port from shopify script line 159
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
            console.log(`      🎨 Managing Product Media: ${imageUrl}`);
            const mediaRes = await saleorFetch(`query GetMedia($id:ID!){product(id:$id){media{id}}}`, { id: productId });
            const existingMedia = mediaRes.data?.product?.media || [];
            if (existingMedia.length > 0) {
                for (const media of existingMedia) {
                    await saleorFetch(`mutation DelMedia($id:ID!){productMediaDelete(id:$id){errors{field message}}}`, { id: media.id });
                }
            }

            let imageBlob: Blob | null = null;
            if (PHOTOROOM_API_KEY) {
                try {
                    const resFetch = await fetch(imageUrl);
                    if (resFetch.ok) {
                        const originalBlob = await resFetch.blob();
                        const formData = new FormData();
                        formData.append("image_file", originalBlob, "original.jpg");
                        formData.append("background.color", "FFFFFF");
                        formData.append("format", "webp");
                        const prRes = await fetch("https://sdk.photoroom.com/v1/segment", {
                            method: "POST",
                            headers: { "x-api-key": PHOTOROOM_API_KEY },
                            body: formData
                        });
                        if (prRes.ok) imageBlob = await prRes.blob();
                    }
                } catch (e) { console.error("      ❌ Photoroom error:", e); }
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
                await fetch(apiUrl!, { method: 'POST', headers: { 'Authorization': saleorToken }, body: fd });
            } else {
                await saleorFetch(`mutation AddMedia($id: ID!, $url: String!, $alt: String) { productMediaCreate(input: { product: $id, mediaUrl: $url, alt: $alt }) { media { id } errors { field message } } }`, {
                    id: productId, url: imageUrl, alt: title
                });
            }
        }

        // --- 2. FETCH WOOCOMMERCE DATA ---
        let storeName = new URL(integration.storeUrl).hostname;
        try {
            const storeRes = await fetch(`${integration.storeUrl}/wp-json/`, { headers: wcHeaders });
            if (storeRes.ok) {
                const storeData = await storeRes.json();
                if (storeData.name) {
                    storeName = storeData.name;
                    console.log(`📡 Fetched Store Name: ${storeName}`);
                }
            }
        } catch (e) { console.warn("   ⚠️ store name fetch failed."); }

        console.log(`📡 Connecting to WooCommerce at ${integration.storeUrl}...`);
        const wcRes = await fetch(`${integration.storeUrl}/wp-json/wc/v3/products?per_page=100`, { headers: wcHeaders });
        if (!wcRes.ok) throw new Error(`WC API Error: ${wcRes.status}`);
        const products = await wcRes.json();
        console.log(`📦 Fetched ${products.length} products from WooCommerce.`);

        const channels = await getSaleorChannels();
        if (channels.length === 0) throw new Error("No Channels found.");

        // --- 3. PARALLEL PROCESSING ---
        await Promise.all(products.map(async (p: any) => {
            const cleanTitle = p.name.trim();
            const predictableSlug = p.slug || cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');

            // 1. Warehouse & Brand (Literal Port from Shopify logic)
            const brandPageId = await getOrCreateBrandPage(storeName);
            let targetWarehouseId = await getOrCreateWarehouse(storeName, channels);
            if (!targetWarehouseId) targetWarehouseId = DEFAULT_WAREHOUSE_ID;

            // 2. Find or Create Product
            const slugCheck = await saleorFetch(`query FindSlug($s:String!){product(slug:$s){id}}`, { s: predictableSlug });
            let finalProductId = slugCheck.data?.product?.id;

            if (!finalProductId) {
                console.log(`   ➕ Creating new Saleor Product: "${cleanTitle}"`);
                const createProdRes = await saleorFetch(`mutation Create($input:ProductCreateInput!){productCreate(input:$input){product{id} errors{field message}}}`, {
                    input: {
                        name: p.name,
                        slug: predictableSlug,
                        externalReference: p.id.toString(),
                        productType: PRODUCT_TYPE_ID,
                        category: CATEGORY_ID,
                        description: textToEditorJs(p.description || p.short_description || p.name)
                    }
                });
                finalProductId = createProdRes.data?.productCreate?.product?.id;
            } else {
                console.log(`   ✨ Syncing existing Saleor Product: "${cleanTitle}"`);
                await saleorFetch(`mutation Update($id:ID!,$input:ProductInput!){productUpdate(id:$id,input:$input){errors{field message}}}`, {
                    id: finalProductId,
                    input: {
                        description: textToEditorJs(p.description || p.short_description || p.name),
                        externalReference: p.id.toString()
                    }
                });
            }

            if (!finalProductId) return;

            // Brand Attribute
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
                id: finalProductId,
                input: { updateChannels: channelListings }
            });

            // Image
            if (p.images && p.images.length > 0) {
                await processImage(finalProductId, p.images[0].src, p.name);
            }

            // 5. Variants Replacement & Sync (Literal Port from Shopify script line 368)
            let wcVariations = [];
            if (p.type === 'variable') {
                const vRes = await fetch(`${integration.storeUrl}/wp-json/wc/v3/products/${p.id}/variations`, { headers: wcHeaders });
                if (vRes.ok) wcVariations = await vRes.json();
            } else {
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

            const existingVarData = await saleorFetch(`query GetVars($id:ID!){product(id:$id){variants{id sku}}}`, { id: finalProductId });
            const existingVariants = existingVarData.data?.product?.variants || [];
            if (existingVariants.length > 0) {
                console.log(`      🧹 Deleting ${existingVariants.length} existing variants for replacement...`);
                await saleorFetch(`mutation BulkDelete($ids:[ID!]!){productVariantBulkDelete(ids:$ids){errors{field message}}}`, { ids: existingVariants.map((v: any) => v.id) });
            }

            for (const v of wcVariations) {
                const sku = v.sku || `WC-V-${v.id}`;
                console.log(`      ➕ Creating Variant: "${sku}"`);

                let quantity = 0;
                if (v.manage_stock) quantity = v.stock_quantity || 0;
                else quantity = v.stock_status === 'instock' ? 100 : 0;

                const varInput = {
                    product: finalProductId,
                    sku: sku,
                    name: v.attributes?.map((a: any) => a.option).join(' / ') || "Default",
                    externalReference: v.id.toString(),
                    attributes: [], // Literal Port: Strict empty array
                    trackInventory: true,
                    stocks: targetWarehouseId ? [{ warehouse: targetWarehouseId, quantity }] : []
                };

                // Deep Log BEFORE sending to verify JSON structure
                console.log("      🔍 Variant Input Pre-flight:", JSON.stringify(varInput, null, 2));

                const varRes = await saleorFetch(`mutation CreateVar($input:ProductVariantCreateInput!){productVariantCreate(input:$input){productVariant{id} errors{field message}}}`, {
                    input: varInput
                });

                const variantId = varRes.data?.productVariantCreate?.productVariant?.id;
                if (variantId) {
                    const priceListings = channels.map((ch: any) => ({
                        channelId: ch.id, price: parseFloat(v.price || "0"), costPrice: parseFloat(v.price || "0")
                    }));
                    await saleorFetch(`mutation UpdatePrice($id:ID!,$input:[ProductVariantChannelListingAddInput!]!){productVariantChannelListingUpdate(id:$id,input:$input){errors{field}}}`, {
                        id: variantId, input: priceListings
                    });
                    console.log(`      ✅ Variant sync successful: ${sku}`);
                } else {
                    console.error(`      ❌ Variant sync failed for SKU: ${sku}`);
                }
            }
        }));

        console.log(`✅ ${products.length} WooCommerce products synced successfully.`);
    }
});
