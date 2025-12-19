import { task } from "@trigger.dev/sdk";
import { db } from "../db";
import { integrations } from "../db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "../lib/encryption";

// --- CONFIGURATION FROM ENV ---
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

// --- TASK DEFINITION ---

export const woocommerceProductSync = task({
    id: "woocommerce-product-sync",
    run: async (payload: { integrationId: number }) => {
        // --- 1. SETUP & AUTH ---
        const integration = await db.query.integrations.findFirst({ where: eq(integrations.id, payload.integrationId) });
        if (!integration) throw new Error("Integration not found");
        if (integration.provider !== "woocommerce") {
            console.warn(`⚠️ skipping: Integration ${payload.integrationId} is not WooCommerce`);
            return;
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

        const saleorFetch = async (query: string, variables: any = {}) => {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: saleorHeaders,
                body: JSON.stringify({ query, variables })
            });
            const json: any = await res.json();
            return json;
        };

        // --- 2. FETCH WOOCOMMERCE PRODUCTS ---
        console.log(`   📡 Connecting to WooCommerce at ${integration.storeUrl}...`);
        const wcResponse = await fetch(`${integration.storeUrl}/wp-json/wc/v3/products?per_page=100`, {
            headers: wcHeaders
        });

        if (!wcResponse.ok) {
            const errBody = await wcResponse.text();
            throw new Error(`WooCommerce API Error (${wcResponse.status}): ${errBody}`);
        }

        const products = await wcResponse.json();
        console.log(`   📦 Fetched ${products.length} products from WooCommerce.`);

        const getSaleorChannels = async () => {
            const json = await saleorFetch(`{ channels { id slug currencyCode isActive } }`);
            return json.data?.channels || [];
        };

        const channels = await getSaleorChannels();
        if (channels.length === 0) { console.error("❌ No Channels found in Saleor."); return; }

        // --- 3. SYNC LOOP ---
        for (const p of products) {
            const cleanTitle = p.name.trim();
            const predictableSlug = p.slug || cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');

            console.log(`🔄 Syncing: "${cleanTitle}" (WC ID: ${p.id})`);

            // Find or Create Product in Saleor
            // Check by Slug
            const slugCheck = await saleorFetch(`query FindSlug($s:String!){product(slug:$s){id}}`, { s: predictableSlug });
            let finalProductId = slugCheck.data?.product?.id;

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

            if (!finalProductId) continue;

            // Channel Listing
            const dateStr = new Date().toISOString().split('T')[0];
            const channelListings = channels.map((ch: any) => ({
                channelId: ch.id,
                isPublished: p.status === 'publish',
                publicationDate: dateStr,
                isAvailableForPurchase: true,
                visibleInListings: true
            }));
            await saleorFetch(`mutation UpdChannel($id:ID!,$input:ProductChannelListingUpdateInput!){productChannelListingUpdate(id:$id,input:$input){errors{field}}}`, {
                id: finalProductId,
                input: { updateChannels: channelListings }
            });

            // --- Stock and SKU Logic ---
            const sku = p.sku || `WC-${p.id}`;

            // Handle Stock: Use numerical quantity if available, otherwise map status
            let saleorQuantity = 0;
            if (p.manage_stock) {
                saleorQuantity = p.stock_quantity || 0;
            } else {
                // If not tracking quantity, "instock" means available (mapped to 100 for Saleor visibility)
                saleorQuantity = p.stock_status === 'instock' ? 100 : 0;
            }

            // Look for existing variant by SKU (User Requirement: Match WC SKU to Variant SKU)
            const varData = await saleorFetch(`query GetVars($id:ID!){product(id:$id){variants{id sku}}}`, { id: finalProductId });
            const existingVariants = varData.data?.product?.variants || [];
            let variantId = existingVariants.find((v: any) => v.sku === sku)?.id;

            if (!variantId) {
                const varRes = await saleorFetch(`mutation CreateVar($input:ProductVariantCreateInput!){productVariantCreate(input:$input){productVariant{id} errors{field message}}}`, {
                    input: {
                        product: finalProductId,
                        sku: sku,
                        name: "Default",
                        externalReference: p.id.toString(),
                        trackInventory: true, // Always track inventory for Saleor to manage stock
                        stocks: DEFAULT_WAREHOUSE_ID ? [{ warehouse: DEFAULT_WAREHOUSE_ID, quantity: saleorQuantity }] : []
                    }
                });
                variantId = varRes.data?.productVariantCreate?.productVariant?.id;
            } else {
                // Update variant stock
                if (DEFAULT_WAREHOUSE_ID) {
                    await saleorFetch(`mutation UpdateStock($id:ID!,$stocks:[StockInput!]!){productVariantUpdate(id:$id,input:{stocks:$stocks}){errors{field message}}}`, {
                        id: variantId,
                        stocks: [{ warehouse: DEFAULT_WAREHOUSE_ID, quantity: saleorQuantity }]
                    });
                }
            }

            const price = parseFloat(p.price || "0");
            if (variantId) {
                const priceListings = channels.map((ch: any) => ({
                    channelId: ch.id, price: price
                }));
                await saleorFetch(`mutation UpdatePrice($id:ID!,$input:[ProductVariantChannelListingAddInput!]!){productVariantChannelListingUpdate(id:$id,input:$input){errors{field}}}`, {
                    id: variantId, input: priceListings
                });
            }
        }

        console.log(`✅ ${products.length} WooCommerce products synced.`);
    }
});
