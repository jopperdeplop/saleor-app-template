import { task } from "@trigger.dev/sdk";
import { db } from "../db";
import { integrations, users } from "../db/schema";
import { eq } from "drizzle-orm";

// --- VERSIONING FOR VERIFICATION ---
const SYNC_VERSION = "LITERAL-CLONE-V12-BRANDFIX";

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

export const shopifyProductSync = task({
    id: "shopify-product-sync",
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

        const officialBrandName = integration.brandName;
        console.log(`🏷️  Using Official Brand Name from DB: "${officialBrandName}"`);
        if (integration.provider !== "shopify") {
            console.warn(`⚠️ skipping: Not Shopify`);
            return;
        }

        const apiUrl = process.env.SALEOR_API_URL;
        let saleorToken = (process.env.SALEOR_APP_TOKEN || process.env.SALEOR_TOKEN || "").trim();

        // --- 🩺 TOKEN VERIFICATION (MASKED) ---
        if (saleorToken) {
            const start = saleorToken.substring(0, 5);
            const end = saleorToken.substring(saleorToken.length - 5);
            console.log(`🔑 [SECURITY] Using Saleor Token: ${start}...${end} (Length: ${saleorToken.length})`);
            saleorToken = `Bearer ${saleorToken.replace(/^bearer\s+/i, "")}`;
        }

        if (!apiUrl || !saleorToken) throw new Error("Missing SALEOR_API_URL or SALEOR_TOKEN");
        console.log(`🌐 [ENV] SALEOR_API_URL: ${apiUrl}`);

        const saleorHeaders = {
            'Authorization': saleorToken,
            'Content-Type': 'application/json'
        };

        // Helper: Centralized Fetch (RESILIENT TO 400 ERRORS)
        const saleorFetch = async (query: string, variables: any = {}) => {
            try {
                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: saleorHeaders,
                    body: JSON.stringify({ query, variables })
                });

                // Saleor returns 400 for structural errors. We MUST parse to handle fallout.
                const json: any = await res.json();

                if (json.errors) {
                    const isSchemaError = json.errors[0]?.message?.includes("Cannot query field");
                    if (isSchemaError) {
                        console.error("   ❌ Saleor Schema Error:", json.errors[0].message);
                    } else {
                        console.error("   ❌ Saleor Error:", JSON.stringify(json.errors[0]?.message || json.errors));
                    }
                }
                return json;
            } catch (e) {
                console.error("   ❌ Network Error during Saleor Request:", e);
                return {};
            }
        };

        // --- 2. FETCH SHOPIFY DATA ---
        console.log("   📡 Connecting to Shopify...");
        const fetchShopify = async (q: string) => {
            const query = `{ products(first:20${q ? `, query: "${q}"` : ""}) { edges { node { id title vendor descriptionHtml images(first:1){edges{node{url}}} variants(first:10){edges{node{id title sku price inventoryQuantity}}} } } } }`;
            return await fetch(`https://${integration.storeUrl}/admin/api/2024-04/graphql.json`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Shopify-Access-Token': integration.accessToken || ""
                },
                body: JSON.stringify({ query })
            });
        };

        // Attempt strict fetch first
        let shopifyRes = await fetchShopify("status:active AND inventory_total:>0");
        if (shopifyRes.status === 401 || shopifyRes.status === 403) throw new Error("Shopify API Access Denied.");
        let shopifyJson = await shopifyRes.json();
        let products = shopifyJson.data?.products?.edges || [];
        console.log(`   📦 Fetched ${products.length} products (Strict mode).`);

        if (products.length === 0) {
            console.warn("   ⚠️  Strict mode returned 0. Retrying loose mode...");
            shopifyRes = await fetchShopify("");
            shopifyJson = await shopifyRes.json();
            products = shopifyJson.data?.products?.edges || [];
            console.log(`   ℹ️  Loose mode found ${products.length} products.`);
        }

        // --- 3. CORE SYNC FUNCTIONS ---

        const getSaleorChannels = async () => {
            const query = `{ channels { id slug currencyCode isActive } }`;
            const json = await saleorFetch(query);
            return json.data?.channels || [];
        };

        const getOrCreateBrandPage = async (name: string) => {
            if (!name) return null;
            // Use exact title matching to avoid fuzzy search duplicates
            const find = await saleorFetch(`query Find($n:String!){pages(filter:{search:$n},first:5){edges{node{id title isPublished}}}}`, { n: name });
            const existing = find.data?.pages?.edges?.find((e: any) => e.node.title === name)?.node;

            if (existing) {
                if (!existing.isPublished) {
                    await saleorFetch(`mutation Pub($id:ID!){pageUpdate(id:$id,input:{isPublished:true}){errors{field}}}`, { id: existing.id });
                }
                return existing.id;
            }
            console.log(`   ✨ Creating Brand Page: "${name}"`);
            const create = await saleorFetch(`mutation Create($n:String!,$t:ID!){pageCreate(input:{title:$n,pageType:$t,isPublished:true,content:"{}"}){page{id} errors{field message}}}`, { n: name, t: BRAND_MODEL_TYPE_ID });
            return create.data?.pageCreate?.page?.id;
        };

        const getOrCreateShippingZone = async (name: string) => {
            const find = await saleorFetch(`query Find($s:String!){shippingZones(filter:{search:$s},first:5){edges{node{id name}}}}`, { s: name });
            const existing = find.data?.shippingZones?.edges?.find((e: any) => e.node.name === name)?.node;
            if (existing) return existing.id;

            console.log(`   🚚 Creating Shipping Zone: "${name}"`);
            const countries = ["DE", "FR", "GB", "IT", "ES", "PL", "NL", "BE", "AT", "PT", "SE", "DK", "FI", "NO", "IE", "US", "CA"];
            const create = await saleorFetch(`mutation CreateZone($input:ShippingZoneCreateInput!){shippingZoneCreate(input:$input){shippingZone{id} errors{message}}}`, {
                input: { name, countries }
            });
            return create.data?.shippingZoneCreate?.shippingZone?.id;
        };

        const getOrCreateWarehouse = async (vendorName: string, channels: any[]) => {
            const slug = `vendor-${vendorName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
            // Use Exact Slug Matching if possible, or filter results
            const find = await saleorFetch(`query Find($s:String!){warehouses(filter:{search:$s},first:5){edges{node{id name slug}}}}`, { s: vendorName });

            const existing = find.data?.warehouses?.edges?.find((e: any) => e.node.slug === slug || e.node.name === `${vendorName} Warehouse`)?.node;
            if (existing) return existing.id;

            console.log(`   🏭 Creating Warehouse: "${vendorName}"`);
            const inputs = {
                name: `${vendorName} Warehouse`,
                slug: slug,
                address: DEFAULT_VENDOR_ADDRESS,
                email: "vendor@example.com"
            };

            const createRes = await saleorFetch(`mutation CreateWarehouse($input:WarehouseCreateInput!){createWarehouse(input:$input){warehouse{id} errors{field message}}}`, {
                input: inputs
            });

            const result = createRes.data?.createWarehouse;

            if (result?.errors?.length > 0) {
                if (result.errors.some((e: any) => e.field === 'slug')) {
                    const slugSearch = await saleorFetch(`query FindS($s:String!){warehouses(filter:{search:$s},first:10){edges{node{id slug}}}}`, { s: slug });
                    const found = slugSearch.data?.warehouses?.edges?.find((e: any) => e.node.slug === slug)?.node;
                    if (found) return found.id;
                }
                console.error("   ⚠️ Warehouse Creation Failed:", JSON.stringify(result.errors));
                return null;
            }

            const newId = result?.warehouse?.id;
            if (newId) {
                console.log(`   ✅ Warehouse Created: ${newId}`);
                // Link to Channels
                for (const ch of channels) {
                    await saleorFetch(`mutation UpdCh($id:ID!,$input:ChannelUpdateInput!){channelUpdate(id:$id,input:$input){errors{field}}}`, { id: ch.id, input: { addWarehouses: [newId] } });
                }
                // Link to Shipping Zone
                const zoneId = await getOrCreateShippingZone("Europe");
                if (zoneId) {
                    await saleorFetch(`mutation UpdZone($id:ID!,$input:ShippingZoneUpdateInput!){shippingZoneUpdate(id:$id,input:$input){errors{field}}}`, { id: zoneId, input: { addWarehouses: [newId] } });
                }
            }
            return newId;
        };

        async function processImage(productId: string, imageUrl: string, title: string) {
            console.log("      🎨 Managing Product Media...");

            // 1. Fetch Existing Media
            const mediaRes = await saleorFetch(`query GetMedia($id:ID!){product(id:$id){media{id}}}`, { id: productId });
            const existingMedia = mediaRes.data?.product?.media || [];

            // 2. Delete Existing Media
            if (existingMedia.length > 0) {
                console.log(`      🧹 Deleting ${existingMedia.length} existing images...`);
                for (const media of existingMedia) {
                    await saleorFetch(`mutation DelMedia($id:ID!){productMediaDelete(id:$id){errors{field message}}}`, { id: media.id });
                }
            }

            const photoroomKey = PHOTOROOM_API_KEY;
            let imageBlob: Blob | null = null;
            if (photoroomKey) {
                try {
                    const shopifyImgRes = await fetch(imageUrl);
                    if (shopifyImgRes.ok) {
                        const originalBlob = await shopifyImgRes.blob();
                        const formData = new FormData();
                        formData.append("image_file", originalBlob, "original.jpg");
                        formData.append("background.color", "FFFFFF");
                        formData.append("format", "webp");
                        const prRes = await fetch("https://sdk.photoroom.com/v1/segment", {
                            method: "POST",
                            headers: { "x-api-key": photoroomKey },
                            body: formData
                        });
                        if (prRes.ok) imageBlob = await prRes.blob();
                    }
                } catch (e) {
                    console.error("      ❌ Photoroom error:", e);
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
                await fetch(apiUrl!, { method: 'POST', headers: { 'Authorization': saleorToken }, body: fd });
            } else {
                await saleorFetch(`mutation AddMedia($id: ID!, $url: String!, $alt: String) { productMediaCreate(input: { product: $id, mediaUrl: $url, alt: $alt }) { media { id } errors { field message } } }`, {
                    id: productId, url: imageUrl, alt: title
                });
            }
        }

        const channels = await getSaleorChannels();
        if (channels.length === 0) { console.error("❌ No Channels found."); return; }

        // --- 4. SETUP CONTEXT (DEDUPLICATION) ---
        // --- 4. SETUP CONTEXT (DEDUPLICATION) ---
        const uniqueVendors: string[] = [officialBrandName];
        const vendorContext = new Map<string, { brandPageId: string | null, warehouseId: string | null }>();

        console.log(`   🏗️  Setting up context for ${uniqueVendors.length} unique vendors...`);
        for (const vendor of uniqueVendors) {
            const brandPageId = await getOrCreateBrandPage(vendor);
            let warehouseId = await getOrCreateWarehouse(vendor, channels);
            if (!warehouseId) warehouseId = DEFAULT_WAREHOUSE_ID;
            vendorContext.set(vendor, { brandPageId, warehouseId });
        }

        // --- 5. PARALLEL PROCESSING ---
        console.log(`📦 Parallel Sync for ${products.length} products...`);

        await Promise.all(products.map(async (pEdge: any) => {
            const p = pEdge.node;
            const vendorName = officialBrandName;
            const context = vendorContext.get(vendorName);
            const brandPageId = context?.brandPageId;
            const targetWarehouseId = context?.warehouseId;

            let finalProductId: string | null = null;
            const cleanTitle = p.title.trim();
            const predictableSlug = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

            const slugCheck = await saleorFetch(`query FindSlug($s:String!){product(slug:$s){id}}`, { s: predictableSlug });
            finalProductId = slugCheck.data?.product?.id;

            if (!finalProductId) {
                const createProdRes = await saleorFetch(`mutation Create($input:ProductCreateInput!){productCreate(input:$input){product{id} errors{field message}}}`, {
                    input: {
                        name: p.title,
                        slug: predictableSlug,
                        externalReference: p.id.split('/').pop(),
                        productType: PRODUCT_TYPE_ID,
                        category: CATEGORY_ID,
                        description: textToEditorJs(p.descriptionHtml || p.title)
                    }
                });
                finalProductId = createProdRes.data?.productCreate?.product?.id;
            } else {
                await saleorFetch(`mutation Update($id:ID!,$input:ProductInput!){productUpdate(id:$id,input:$input){errors{field message}}}`, {
                    id: finalProductId,
                    input: {
                        description: textToEditorJs(p.descriptionHtml || p.title),
                        externalReference: p.id.split('/').pop()
                    }
                });
            }

            if (!finalProductId) return;

            if (brandPageId && BRAND_ATTRIBUTE_ID) {
                await saleorFetch(`mutation UpdateProd($id:ID!,$input:ProductInput!){productUpdate(id:$id,input:$input){errors{field message}}}`, {
                    id: finalProductId,
                    input: { attributes: [{ id: BRAND_ATTRIBUTE_ID, reference: brandPageId }] }
                });
            }



            if (p.images?.edges?.[0]?.node?.url) {
                await processImage(finalProductId, p.images.edges[0].node.url, p.title);
            }

            const variants = p.variants?.edges || [];
            const existingVarData = await saleorFetch(`query GetVars($id:ID!){product(id:$id){variants{id sku}}}`, { id: finalProductId });
            const existingVariants = existingVarData.data?.product?.variants || [];
            if (existingVariants.length > 0) {
                await saleorFetch(`mutation BulkDelete($ids:[ID!]!){productVariantBulkDelete(ids:$ids){errors{field message}}}`, { ids: existingVariants.map((v: any) => v.id) });
            }

            // --- 📢 Step 1: Create all variants first (without prices) ---
            for (const vEdge of variants) {
                const v = vEdge.node;
                const variantExternalRef = `${p.id.split('/').pop()}-${v.id.split('/').pop()}`; // Unique external reference for variant
                await saleorFetch(`mutation CreateVar($input:ProductVariantCreateInput!){productVariantCreate(input:$input){productVariant{id} errors{field message}}}`, {
                    input: {
                        product: finalProductId,
                        sku: v.sku || variantExternalRef, // Use SKU if available, otherwise externalRef
                        name: v.title || "Default",
                        externalReference: variantExternalRef,
                        attributes: [],
                        trackInventory: true,
                        stocks: targetWarehouseId ? [{ warehouse: targetWarehouseId, quantity: v.inventoryQuantity || 0 }] : []
                    }
                });
            }

            // --- 📢 Step 2: Ensure Product is in Channels (Saleor requirement for Variant Prices) ---
            const dateStr = new Date().toISOString().split('T')[0];
            const channelListings = channels.map((ch: any) => ({
                channelId: ch.id,
                isPublished: true,
                publicationDate: dateStr,
                isAvailableForPurchase: true,
                visibleInListings: true,
                availableForPurchaseAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            }));
            await saleorFetch(`mutation UpdChannel($id:ID!,$input:ProductChannelListingUpdateInput!){productChannelListingUpdate(id:$id,input:$input){errors{field}}}`, {
                id: finalProductId,
                input: { updateChannels: channelListings }
            });

            // --- 💰 Step 3: Assign Prices to Variants (Now that product is in channels) ---
            for (const vEdge of p.variants.edges) {
                const v = vEdge.node;
                const predictableSlug = `${p.id.split('/').pop()}-${v.id.split('/').pop()}`;

                // Lookup created variant
                const findVar = await saleorFetch(`query FindVar($s:String!){productVariant(externalReference:$s){id}}`, { s: predictableSlug });
                const variantId = findVar.data?.productVariant?.id;

                if (variantId) {
                    const priceListings = channels.map((ch: any) => ({
                        channelId: ch.id, price: parseFloat(v.price || "0"), costPrice: parseFloat(v.price || "0")
                    }));
                    await saleorFetch(`mutation UpdatePrice($id:ID!,$input:[ProductVariantChannelListingAddInput!]!){productVariantChannelListingUpdate(id:$id,input:$input){errors{field}}}`, {
                        id: variantId, input: priceListings
                    });
                }
            }
        }));

        console.log(`✅ [LITERAL-CLONE-V11-PRICEFIX] Shopify sync finished.`);
    }
});
