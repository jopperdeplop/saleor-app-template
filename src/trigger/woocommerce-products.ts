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
        console.log(`🚀 [DIAGNOSTIC] Starting WooCommerce Sync for Integration: ${payload.integrationId}`);

        // --- 1. SETUP & AUTH ---
        const integration = await db.query.integrations.findFirst({ where: eq(integrations.id, payload.integrationId) });
        if (!integration) throw new Error("Integration not found");
        if (integration.provider !== "woocommerce") {
            console.warn(`⚠️ skipping: Integration ${payload.integrationId} is not WooCommerce`);
            return;
        }

        const settings = integration.settings as any;
        const consumerKey = integration.accessToken;
        let consumerSecret = "";
        if (settings?.consumerSecret) consumerSecret = decrypt(settings.consumerSecret);

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

        // Helper: Centralized Fetch (with verbose logging)
        const saleorFetch = async (query: string, variables: any = {}) => {
            console.log(`      📡 [GQL CALL] Mutation/Query length: ${query.length} chars`);
            try {
                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: saleorHeaders,
                    body: JSON.stringify({ query, variables })
                });
                if (!res.ok) {
                    console.error(`      ❌ Saleor HTTP ${res.status}:`, await res.text());
                    return {};
                }
                const json: any = await res.json();
                if (json.errors) {
                    console.error("      ❌ Saleor Error Response:", JSON.stringify(json.errors, null, 2));
                }
                return json;
            } catch (e) {
                console.error("      ❌ Network Error during Saleor Request:", e);
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
            if (existing) return existing.id;

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

            console.log(`   🏭 [ATTEMPT] Creating Warehouse for: "${vendorName}"`);
            console.log(`      - Name: "${vendorName} Warehouse"`);
            console.log(`      - Slug: "${slug}"`);

            // mutation exactly as in shopify script
            const mutation = `mutation CreateWarehouse($input:WarehouseCreateInput!){warehouseCreate(input:$input){warehouse{id} errors{field message code}}}`;
            const variables = {
                input: {
                    name: `${vendorName} Warehouse`,
                    slug: slug,
                    address: DEFAULT_VENDOR_ADDRESS,
                    email: "vendor@example.com"
                }
            };

            const createRes = await saleorFetch(mutation, variables);
            const result = createRes.data?.warehouseCreate;
            if (result?.errors?.length > 0) {
                console.error("   ⚠️ Warehouse Creation Failed Errors:", JSON.stringify(result.errors));
                return null;
            }

            const newId = result?.warehouse?.id;
            if (newId) {
                console.log(`      ✅ Warehouse Created with ID: ${newId}`);
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

        // --- 2. FETCH WOOCOMMERCE DATA ---
        let storeName = new URL(integration.storeUrl).hostname;
        try {
            const storeRes = await fetch(`${integration.storeUrl}/wp-json/`, { headers: wcHeaders });
            if (storeRes.ok) {
                const storeData = await storeRes.json();
                if (storeData.name) {
                    storeName = storeData.name;
                    console.log(`📡 Fetched WooCommerce Store Name: "${storeName}"`);
                }
            }
        } catch (e) {
            console.warn("⚠️ store name fetch failed, using hostname.");
        }

        console.log(`📡 Connecting to WooCommerce at ${integration.storeUrl}...`);
        const wcResponse = await fetch(`${integration.storeUrl}/wp-json/wc/v3/products?per_page=100`, { headers: wcHeaders });
        if (!wcResponse.ok) throw new Error(`WC API Error: ${wcResponse.status}`);
        const products = await wcResponse.json();
        console.log(`📦 Fetched ${products.length} products total.`);

        const channels = await getSaleorChannels();
        if (channels.length === 0) throw new Error("No Channels found.");

        const brandPageId = await getOrCreateBrandPage(storeName);
        let targetWarehouseId = await getOrCreateWarehouse(storeName, channels);
        if (!targetWarehouseId) targetWarehouseId = DEFAULT_WAREHOUSE_ID;

        console.log(`🎯 Target Warehouse ID for this run: ${targetWarehouseId || "NONE"}`);

        // --- 3. SEQUENTIAL PROCESSING (for cleaner logs) ---
        for (const p of products) {
            console.log(`\n🧵 [PRODUCT] Processing: "${p.name}" (ID: ${p.id})`);
            const cleanTitle = p.name.trim();
            const predictableSlug = p.slug || cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');

            const slugCheck = await saleorFetch(`query FindSlug($s:String!){product(slug:$s){id}}`, { s: predictableSlug });
            let finalProductId = slugCheck.data?.product?.id;

            if (!finalProductId) {
                console.log(`   ➕ Creating new product: ${cleanTitle}`);
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
                console.log(`   ✨ Syncing existing product: ${cleanTitle}`);
            }

            if (!finalProductId) {
                console.error("   ❌ Failed to get finalProductId.");
                continue;
            }

            // Assign Brand
            if (brandPageId && BRAND_ATTRIBUTE_ID) {
                await saleorFetch(`mutation UpProd($id:ID!,$input:ProductInput!){productUpdate(id:$id,input:$input){errors{field}}}`, {
                    id: finalProductId, input: { attributes: [{ id: BRAND_ATTRIBUTE_ID, reference: brandPageId }] }
                });
            }

            // Variants Synchronization
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

            // Clean old variants
            const existingVarData = await saleorFetch(`query GetVars($id:ID!){product(id:$id){variants{id sku}}}`, { id: finalProductId });
            const oldIds = (existingVarData.data?.product?.variants || []).map((v: any) => v.id);
            if (oldIds.length > 0) {
                console.log(`      🧹 Cleaning up ${oldIds.length} existing variants...`);
                await saleorFetch(`mutation BulkDelete($ids:[ID!]!){productVariantBulkDelete(ids:$ids){errors{field}}}`, { ids: oldIds });
            }

            for (const v of wcVariations) {
                const sku = v.sku || `WC-V-${v.id}`;
                let quantity = 0;
                if (v.manage_stock) quantity = v.stock_quantity || 0;
                else quantity = v.stock_status === 'instock' ? 100 : 0;

                console.log(`      ➕ [ATTEMPT] Creating Variant: "${sku}"`);
                console.log(`         - External ID: ${v.id}`);
                console.log(`         - Stock: ${quantity} (Warehouse: ${targetWarehouseId})`);

                const variantInput = {
                    product: finalProductId,
                    sku: sku,
                    name: v.attributes?.map((a: any) => a.option).join(' / ') || "Default",
                    externalReference: v.id.toString(),
                    attributes: [],
                    trackInventory: true,
                    stocks: targetWarehouseId ? [{ warehouse: targetWarehouseId, quantity }] : []
                };

                const varRes = await saleorFetch(`mutation CreateVar($input:ProductVariantCreateInput!){productVariantCreate(input:$input){productVariant{id} errors{field message}}}`, {
                    input: variantInput
                });

                const variantId = varRes.data?.productVariantCreate?.productVariant?.id;
                if (variantId) {
                    console.log(`         ✅ Variant Created ID: ${variantId}`);
                    const priceListings = channels.map((ch: any) => ({
                        channelId: ch.id, price: parseFloat(v.price || "0"), costPrice: parseFloat(v.price || "0")
                    }));
                    await saleorFetch(`mutation UpdatePrice($id:ID!,$input:[ProductVariantChannelListingAddInput!]!){productVariantChannelListingUpdate(id:$id,input:$input){errors{field}}}`, {
                        id: variantId, input: priceListings
                    });
                } else {
                    console.error(`         ❌ Variant Creation FAILED for SKU: ${sku}`);
                }
            }
        }

        console.log(`✅ WooCommerce sync completed.`);
    }
});
