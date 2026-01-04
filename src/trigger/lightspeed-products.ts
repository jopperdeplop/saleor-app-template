import { task } from "@trigger.dev/sdk";
import { bulkTranslateProducts } from "./bulk-translate-products";
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
const COUNTRY_TO_CHANNEL: Record<string, string> = {
    "AT": "austria", "BE": "belgium", "HR": "croatia", "CY": "cyprus",
    "EE": "estonia", "FI": "finland", "FR": "france", "DE": "germany",
    "GR": "greece", "IE": "ireland", "IT": "italy", "LV": "latvia",
    "LT": "lithuania", "LU": "luxembourg", "MT": "malta", "NL": "netherlands",
    "PT": "portugal", "SK": "slovakia", "SI": "slovenia", "ES": "spain"
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
            brandName: users.brand,
            shippingCountries: users.shippingCountries,
            settings: integrations.settings
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
            return (json.data?.channels || []).filter((c: any) => c.isActive);
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

        const getOrCreateShippingZones = async () => {
            const find = await saleorFetch(`query { shippingZones(first:100) { edges { node { id name } } } }`);
            return find.data?.shippingZones?.edges?.map((e: any) => e.node) || [];
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
                const zones = await getOrCreateShippingZones();
                for (const zone of zones) {
                    await saleorFetch(`mutation UpdZone($id:ID!,$input:ShippingZoneUpdateInput!){shippingZoneUpdate(id:$id,input:$input){errors{field}}}`, { id: zone.id, input: { addWarehouses: [newId] } });
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
        const globalCountries = (integrationData[0]?.shippingCountries as string[]) || [];
        const isOptOut = !globalCountries || globalCountries.length === 0;
        const targetCountryCodes = isOptOut ? Object.keys(COUNTRY_TO_CHANNEL) : globalCountries;
        const activeChannels = channels.filter((ch: any) => 
            targetCountryCodes.some((c: string) => COUNTRY_TO_CHANNEL[c] === ch.slug)
        );

        const brandPageId = await getOrCreateBrandPage(officialBrandName);
        let warehouseId = await getOrCreateWarehouse(officialBrandName, activeChannels);
        if (!warehouseId) warehouseId = DEFAULT_WAREHOUSE_ID;

        // --- 3. FETCH DATA FROM LIGHTSPEED ---

        console.log(`   📡 Connecting to Lightspeed: ${domainPrefix}`);

        // A. Fetch Products
        const lsProductRes = await fetch(`https://${domainPrefix}.retail.lightspeed.app/api/2.0/products`, {
            headers: { 'Authorization': `Bearer ${integration.accessToken}` }
        });
        if (!lsProductRes.ok) throw new Error(`Lightspeed Products API Error: ${lsProductRes.status}`);
        const lsProductData = await lsProductRes.json();

        // B. Fetch Inventory (API 2.0 requires separate call)
        console.log(`   📦 Fetching Inventory Records...`);
        const lsInventoryRes = await fetch(`https://${domainPrefix}.retail.lightspeed.app/api/2.0/inventory`, {
            headers: { 'Authorization': `Bearer ${integration.accessToken}` }
        });
        if (!lsInventoryRes.ok) throw new Error(`Lightspeed Inventory API Error: ${lsInventoryRes.status}`);
        const lsInventoryData = await lsInventoryRes.json();

        // C. Create Inventory Map
        const inventoryMap = new Map<string, number>();
        lsInventoryData.data?.forEach((inv: any) => {
            const current = inventoryMap.get(inv.product_id) || 0;
            inventoryMap.set(inv.product_id, current + parseFloat(inv.inventory_level?.toString() || "0"));
        });

        const rawProducts = lsProductData.data || [];

        // Filter out "Discount" or system items
        const products = rawProducts.filter((p: any) => {
            const name = p.name.toLowerCase();
            return !name.includes("discount") && !name.includes("gift card");
        });

        console.log(`   📦 Found ${products.length} valid products (skipped ${rawProducts.length - products.length} system items).`);

        // --- 4. SYNC TO SALEOR ---

        const processedProductIds: Set<string> = new Set();

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
                externalReference: p.id,
                metadata: [{ key: "brand", value: officialBrandName }]
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
            const channelListings = activeChannels.map((ch: any) => ({
                channelId: ch.id, isPublished: true, isAvailableForPurchase: true, visibleInListings: true
            }));
            await saleorFetch(`mutation Channel($id:ID!,$input:ProductChannelListingUpdateInput!){productChannelListingUpdate(id:$id,input:$input){errors{field}}}`, {
                id: finalProductId, input: { updateChannels: channelListings }
            });

            // Variants
            // X-Series 2.0 has p.variants (array) or a single product acts as a variant
            const lsVariants = p.variants || [p];

            for (const v of lsVariants) {
                const variantSlug = `ls-v-${v.id}`;
                const varFind = await saleorFetch(`query GetV($id:ID!){product(id:$id){variants{id externalReference}}}`, { id: finalProductId });
                const existingVar = varFind.data?.product?.variants?.find((ev: any) => ev.externalReference === v.id);

                // --- 📦 INVENTORY CALCULATION ---
                // Fetch total stock from map (summed across outlets)
                const totalStock = inventoryMap.get(v.id) || 0;
                console.log(`      📦 Variant ${v.sku || v.id} Stock: ${totalStock}`);

                const varInput = {
                    product: finalProductId,
                    sku: v.sku || variantSlug,
                    name: v.variant_name || v.name || "Default",
                    externalReference: v.id,
                    attributes: [],
                    trackInventory: true,
                    stocks: [{ warehouse: warehouseId, quantity: Math.max(0, Math.floor(totalStock)) }]
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
                    // --- 💰 PRICING ---
                    // X-Series uses 'price' (retail) and 'supply_price' (cost)
                    const retailPrice = parseFloat(v.price_including_tax?.toString() || v.retail_price?.toString() || v.price?.toString() || "0");
                    const costPrice = parseFloat(v.supply_price?.toString() || "0");

                    console.log(`      💰 Variant ${v.sku || v.id} Price: ${retailPrice}, Cost: ${costPrice}`);

                    const priceListings = activeChannels.map((ch: any) => ({
                        channelId: ch.id,
                        price: retailPrice,
                        costPrice: costPrice > 0 ? costPrice : retailPrice
                    }));

                    await saleorFetch(`mutation Price($id:ID!,$input:[ProductVariantChannelListingAddInput!]!){productVariantChannelListingUpdate(id:$id,input:$input){errors{field}}}`, {
                        id: variantId, input: priceListings
                    });
                }

                // 📢 Trigger Translation for this product
                // 📢 Trigger Translation for this product
                if (finalProductId) {
                    processedProductIds.add(finalProductId);
                }
            }
        }
        
        // 📢 Trigger Bulk Translation Task
        if (processedProductIds.size > 0) {
            await bulkTranslateProducts.trigger({ productIds: Array.from(processedProductIds) });
        }

        console.log(`✅ [${SYNC_VERSION}] Finished.`);
        return { success: true, count: products.length };
    },
});
