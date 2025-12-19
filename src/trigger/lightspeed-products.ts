
import { task } from "@trigger.dev/sdk";
import { db } from "../db";
import { integrations, users } from "../db/schema";
import { eq } from "drizzle-orm";

// --- VERSIONING ---
const SYNC_VERSION = "LIGHTSPEED-SYNC-V2-ROBUST";

// --- CONFIGURATION FROM ENV ---
const BRAND_MODEL_TYPE_ID = process.env.SALEOR_BRAND_MODEL_TYPE_ID;
const BRAND_ATTRIBUTE_ID = process.env.SALEOR_BRAND_ATTRIBUTE_ID;
const PRODUCT_TYPE_ID = process.env.SALEOR_PRODUCT_TYPE_ID;
const CATEGORY_ID = process.env.SALEOR_CATEGORY_ID;
const DEFAULT_WAREHOUSE_ID = process.env.SALEOR_WAREHOUSE_ID;

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

export const lightspeedProductSync = task({
    id: "lightspeed-product-sync",
    run: async (payload: { integrationId: number }) => {
        console.log(`🚀 [${SYNC_VERSION}] Execution Start. Integration: ${payload.integrationId}`);

        // --- 1. SETUP & AUTH ---
        const integrationData = await db.select({
            id: integrations.id,
            accessToken: integrations.accessToken,
            storeUrl: integrations.storeUrl,
            provider: integrations.provider,
            brandName: users.brand
        })
            .from(integrations)
            .innerJoin(users, eq(integrations.userId, users.id))
            .where(eq(integrations.id, payload.integrationId))
            .limit(1);

        const integration = integrationData[0];
        if (!integration) throw new Error("Integration not found");
        if (integration.provider !== "lightspeed") {
            console.warn(`⚠️ skipping: Not Lightspeed`);
            return;
        }

        const officialBrandName = integration.brandName;
        console.log(`🏷️  Using Official Brand Name: "${officialBrandName}"`);

        const domainPrefix = integration.storeUrl;
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

        const saleorFetch = async (query: string, variables: any = {}) => {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: saleorHeaders,
                body: JSON.stringify({ query, variables })
            });
            const json: any = await res.json();
            if (json.errors) {
                console.error("   ❌ Saleor API Errors:", JSON.stringify(json.errors, null, 2));
            }
            return json;
        };

        // --- 2. CORE SYNC HELPERS ---

        const getSaleorChannels = async () => {
            const query = `{ channels { id slug currencyCode isActive } }`;
            const json = await saleorFetch(query);
            return json.data?.channels || [];
        };

        const getOrCreateBrandPage = async (name: string) => {
            if (!name) return null;
            const find = await saleorFetch(`query Find($n:String!){pages(filter:{search:$n},first:5){edges{node{id title isPublished}}}}`, { n: name });
            const existing = find.data?.pages?.edges?.find((e: any) => e.node.title === name)?.node;
            if (existing) return existing.id;

            console.log(`   ✨ Creating Brand Page: "${name}"`);
            const create = await saleorFetch(`mutation Create($n:String!,$t:ID!){pageCreate(input:{title:$n,pageType:$t,isPublished:true,content:"{}"}){page{id} errors{field message}}}`, { n: name, t: BRAND_MODEL_TYPE_ID });
            return create.data?.pageCreate?.page?.id;
        };

        const getOrCreateShippingZone = async (name: string) => {
            const find = await saleorFetch(`query Find($s:String!){shippingZones(filter:{search:$s},first:5){edges{node{id name}}}}`, { s: name });
            const existing = find.data?.shippingZones?.edges?.find((e: any) => e.node.name === name)?.node;
            if (existing) return existing.id;

            console.log(`   🚚 Creating Shipping Zone: "${name}"`);
            const countries = ["DE", "FR", "GB", "IT", "ES", "NL", "BE", "US", "CA"];
            const create = await saleorFetch(`mutation CreateZone($input:ShippingZoneCreateInput!){shippingZoneCreate(input:$input){shippingZone{id} errors{message}}}`, {
                input: { name, countries }
            });
            return create.data?.shippingZoneCreate?.shippingZone?.id;
        };

        const getOrCreateWarehouse = async (vendorName: string, channels: any[]) => {
            const slug = `vendor-${vendorName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
            const find = await saleorFetch(`query Find($s:String!){warehouses(filter:{search:$s},first:5){edges{node{id name slug}}}}`, { s: vendorName });
            const existing = find.data?.warehouses?.edges?.find((e: any) => e.node.slug === slug || e.node.name === `${vendorName} Warehouse`)?.node;
            if (existing) return existing.id;

            console.log(`   🏭 Creating Warehouse: "${vendorName}"`);
            const createRes = await saleorFetch(`mutation CreateWarehouse($input:WarehouseCreateInput!){createWarehouse(input:$input){warehouse{id} errors{field message}}}`, {
                input: { name: `${vendorName} Warehouse`, slug, address: DEFAULT_VENDOR_ADDRESS, email: "vendor@example.com" }
            });
            const newId = createRes.data?.createWarehouse?.warehouse?.id;
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
            console.log(`      🎨 Syncing Image: ${imageUrl}`);
            // Check if media already exists to avoid duplicates
            const mediaRes = await saleorFetch(`query GetMedia($id:ID!){product(id:$id){media{id}}}`, { id: productId });
            if (mediaRes.data?.product?.media?.length > 0) return;

            await saleorFetch(`mutation AddMedia($id: ID!, $url: String!, $alt: String) { productMediaCreate(input: { product: $id, mediaUrl: $url, alt: $alt }) { media { id } errors { field message } } }`, {
                id: productId, url: imageUrl, alt: title
            });
        }

        const channels = await getSaleorChannels();
        const brandPageId = await getOrCreateBrandPage(officialBrandName);
        let warehouseId = await getOrCreateWarehouse(officialBrandName, channels);
        if (!warehouseId) warehouseId = DEFAULT_WAREHOUSE_ID;

        // --- 3. FETCH DATA FROM LIGHTSPEED ---

        console.log(`   📡 Connecting to Lightspeed: ${domainPrefix}`);
        const lsProductRes = await fetch(`https://${domainPrefix}.retail.lightspeed.app/api/2.0/products`, {
            headers: { 'Authorization': `Bearer ${integration.accessToken}` }
        });

        if (!lsProductRes.ok) throw new Error(`Lightspeed API Error: ${lsProductRes.status}`);
        const lsProductData = await lsProductRes.json();
        const rawProducts = lsProductData.data || [];

        // Filter out "Discount" or system items
        const products = rawProducts.filter((p: any) => {
            const name = p.name.toLowerCase();
            return !name.includes("discount") && !name.includes("gift card");
        });

        console.log(`   📦 Found ${products.length} valid products (skipped ${rawProducts.length - products.length} system items).`);

        // --- 4. SYNC TO SALEOR ---

        for (const p of products) {
            console.log(`   🔄 Syncing: ${p.name} (${p.id})`);

            const predictableSlug = `ls-${p.id}`;
            const slugCheck = await saleorFetch(`query Find($s:String!){product(slug:$s){id}}`, { s: predictableSlug });
            let finalProductId = slugCheck.data?.product?.id;

            const productInput = {
                name: p.name,
                slug: predictableSlug,
                productType: PRODUCT_TYPE_ID,
                category: CATEGORY_ID,
                description: textToEditorJs(p.description || p.name),
                externalReference: p.id
            };

            if (finalProductId) {
                await saleorFetch(`mutation Update($id:ID!,$input:ProductInput!){productUpdate(id:$id,input:$input){errors{field message}}}`, {
                    id: finalProductId, input: productInput
                });
            } else {
                const createRes = await saleorFetch(`mutation Create($input:ProductCreateInput!){productCreate(input:$input){product{id} errors{field message}}}`, {
                    input: productInput
                });
                finalProductId = createRes.data?.productCreate?.product?.id;
            }

            if (!finalProductId) continue;

            // Associate Brand
            if (brandPageId && BRAND_ATTRIBUTE_ID) {
                await saleorFetch(`mutation Brand($id:ID!,$input:ProductInput!){productUpdate(id:$id,input:$input){errors{field}}}`, {
                    id: finalProductId, input: { attributes: [{ id: BRAND_ATTRIBUTE_ID, reference: brandPageId }] }
                });
            }

            // Media
            if (p.image_url) {
                await processImage(finalProductId, p.image_url, p.name);
            }

            // Register in Channels
            const channelListings = channels.map((ch: any) => ({
                channelId: ch.id, isPublished: true, isAvailableForPurchase: true, visibleInListings: true
            }));
            await saleorFetch(`mutation Channel($id:ID!,$input:ProductChannelListingUpdateInput!){productChannelListingUpdate(id:$id,input:$input){errors{field}}}`, {
                id: finalProductId, input: { updateChannels: channelListings }
            });

            // Variants
            // X-Series 2.0 has p.variants (array) or a single product acts as a variant
            const lsVariants = p.variants || [{ id: p.id, sku: p.sku || `sku-${p.id}`, price: p.price }];

            for (const v of lsVariants) {
                const variantSlug = `ls-v-${v.id}`;
                const varFind = await saleorFetch(`query GetV($id:ID!){product(id:$id){variants{id externalReference}}}`, { id: finalProductId });
                const existingVar = varFind.data?.product?.variants?.find((ev: any) => ev.externalReference === v.id);

                const varInput = {
                    product: finalProductId,
                    sku: v.sku || variantSlug,
                    name: v.name || "Default",
                    externalReference: v.id,
                    attributes: [], // --- FIX: Explicitly pass empty attributes list ---
                    trackInventory: true,
                    stocks: [{ warehouse: warehouseId, quantity: parseInt(v.inventory_quantity?.toString() || "0") }]
                };

                let variantId = existingVar?.id;
                if (variantId) {
                    await saleorFetch(`mutation UpdV($id:ID!,$input:ProductVariantInput!){productVariantUpdate(id:$id,input:$input){errors{field message}}}`, {
                        id: variantId, input: {
                            sku: varInput.sku,
                            name: varInput.name,
                            externalReference: varInput.externalReference,
                            attributes: varInput.attributes,
                            trackInventory: varInput.trackInventory,
                            stocks: varInput.stocks
                        }
                    });
                } else {
                    const varCreateRes = await saleorFetch(`mutation CreateV($input:ProductVariantCreateInput!){productVariantCreate(input:$input){productVariant{id} errors{field message}}}`, {
                        input: varInput
                    });
                    variantId = varCreateRes.data?.productVariantCreate?.productVariant?.id;
                }

                if (variantId) {
                    const priceListings = channels.map((ch: any) => ({
                        channelId: ch.id, price: parseFloat(v.price || "0")
                    }));
                    await saleorFetch(`mutation Price($id:ID!,$input:[ProductVariantChannelListingAddInput!]!){productVariantChannelListingUpdate(id:$id,input:$input){errors{field}}}`, {
                        id: variantId, input: priceListings
                    });
                }
            }
        }

        console.log(`✅ [${SYNC_VERSION}] Finished.`);
        return { success: true, count: products.length };
    },
});
