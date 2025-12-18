import { schedules, task, tasks } from "@trigger.dev/sdk";
import { db } from "../db";
import { integrations } from "../db/schema";
import { eq } from "drizzle-orm";

const DEFAULT_WAREHOUSE_ID = process.env.SALEOR_WAREHOUSE_ID;

// Helper: Addressing for Warehouse (Copied from product-sync for consistency)
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

/**
 * PARENT TASK: Runs every 6 hours and triggers a sync for every active store.
 */
export const shopifyInventoryScheduledSync = schedules.task({
    id: "shopify-inventory-scheduled-sync",
    cron: "0 */6 * * *", // Every 6 hours
    run: async (payload) => {
        const activeIntegrations = await db.query.integrations.findMany({
            where: eq(integrations.status, "active")
        });

        // ONLY trigger for Shopify stores. WooCommerce will have its own scheduled task.
        const shopifyStores = activeIntegrations.filter(i => i.provider === "shopify");

        console.log(`⏰ Scheduled Shopify Sync: Found ${shopifyStores.length} stores.`);

        for (const integration of shopifyStores) {
            await shopifyInventorySync.trigger({ integrationId: integration.id });
        }
    }
});

/**
 * CHILD TASK: Syncs inventory for a specific Shopify store.
 * Supports partial sync via 'since' parameter (ISO date string).
 */
export const shopifyInventorySync = task({
    id: "shopify-inventory-sync",
    run: async (payload: { integrationId: number, since?: string }) => {
        console.log(`🔍 Received Sync Request for Integration ID: ${payload.integrationId}`);

        const integration = await db.query.integrations.findFirst({
            where: eq(integrations.id, payload.integrationId)
        });

        if (!integration) {
            const all = await db.query.integrations.findMany({ columns: { id: true, provider: true, storeUrl: true } });
            console.error(`❌ Integration ${payload.integrationId} not found.`);
            console.log("   Available Integrations in DB:", JSON.stringify(all, null, 2));
            throw new Error(`Integration ID ${payload.integrationId} not found. Please check your Trigger.dev payload and use a valid ID from the list above.`);
        }

        if (integration.provider !== "shopify") {
            console.warn(`⚠️ Integration ${payload.integrationId} is not a Shopify provider (${integration.provider}). skipping.`);
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

        const saleorFetch = async (query: string, variables: any = {}) => {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: saleorHeaders,
                body: JSON.stringify({ query, variables })
            });
            return await res.json();
        };

        // 1. Fetch Shopify Inventory
        // Mirroring shopify-products.ts logic: Only sync active products with stock.
        const baseFilter = "status:active AND inventory_total:>0";
        const filter = payload.since ? `${baseFilter} AND updated_at:>=${payload.since}` : baseFilter;

        const shopifyQuery = `{ products(first:50, query: "${filter}") { edges { node { title vendor variants(first:50){edges{node{title sku inventoryQuantity}}} } } } }`;

        const shopifyRes = await fetch(`https://${integration.storeUrl}/admin/api/2024-04/graphql.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': integration.accessToken || ""
            },
            body: JSON.stringify({ query: shopifyQuery })
        });
        const shopifyJson = await shopifyRes.json();
        const products = shopifyJson.data?.products?.edges || [];

        if (products.length === 0) {
            console.log(payload.since ? `✨ No recent changes found since ${payload.since} (using strict filter).` : "Empty Shopify catalog or no active stock found.");
            return;
        }

        // 2. Setup Saleor Context (Channels/Warehouses)
        const channelsRes = await saleorFetch(`{ channels { id slug } }`);
        const channels = channelsRes.data?.channels || [];

        // Helper to find/create warehouse
        const getWarehouseId = async (vendorName: string) => {
            const find = await saleorFetch(`query Find($s:String!){warehouses(filter:{search:$s},first:1){edges{node{id slug}}}}`, { s: vendorName });
            const existing = find.data?.warehouses?.edges?.[0]?.node;
            if (existing) return existing.id;

            console.log(`🏭 Creating Warehouse for: "${vendorName}"`);
            const createRes = await saleorFetch(`mutation CreateWarehouse($input:WarehouseCreateInput!){warehouseCreate(input:$input){warehouse{id} errors{field message}}}`, {
                input: {
                    name: `${vendorName} Warehouse`,
                    slug: `vendor-${vendorName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
                    address: DEFAULT_VENDOR_ADDRESS,
                    email: "vendor@example.com"
                }
            });
            return createRes.data?.warehouseCreate?.warehouse?.id || DEFAULT_WAREHOUSE_ID;
        };

        // 3. Process Inventory Updates
        console.log(`🔄 Deterministic Sync for ${products.length} products ${payload.since ? `(Changes since ${payload.since})` : "..."}`);

        await Promise.all(products.map(async (pEdge: any) => {
            const sp = pEdge.node;
            const warehouseId = await getWarehouseId(sp.vendor);
            if (!warehouseId) return;

            // A. Generate Predictable Slug (Exactly as in shopify-products.ts)
            const cleanTitle = sp.title.trim();
            const predictableSlug = cleanTitle.toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-+|-+$/g, '');

            // B. Find Saleor Product
            let saleorProd: any = null;

            // Step 1: Lookup by Slug (Deterministic & Fastest)
            const slugRes = await saleorFetch(`query FindSlug($s:String!){product(slug:$s){id name variants{id name sku}}}`, { s: predictableSlug });
            saleorProd = slugRes.data?.product;

            // Step 2: Fallback to Search (In case slug changed or was manually set)
            if (!saleorProd) {
                const searchRes = await saleorFetch(`query FindProd($n:String!){products(filter:{search:$n},first:20){edges{node{id name variants{id name sku}}}}}`, { n: cleanTitle });
                saleorProd = searchRes.data?.products?.edges?.find((e: any) => e.node.name?.trim() === cleanTitle)?.node;
            }

            if (!saleorProd) {
                console.warn(`      ⚠️ Product not found in Saleor: "${cleanTitle}" (Tried Slug: ${predictableSlug})`);
                return;
            }

            // C. Map Variants by Name
            for (const vEdge of sp.variants.edges) {
                const sv = vEdge.node;

                // Find matching Saleor Variant by SKU (which is the Shopify ID)
                const saleorVar = saleorProd.variants.find((ev: any) => {
                    const shopifyId = sv.id.split('/').pop();
                    return ev.sku === shopifyId;
                });

                if (saleorVar) {
                    const upRes = await saleorFetch(`mutation UpdStock($id:ID!,$stocks:[StockInput!]!){productVariantStocksUpdate(variantId:$id,stocks:$stocks){errors{field message}}}`, {
                        id: saleorVar.id,
                        stocks: [{ warehouse: warehouseId, quantity: sv.inventoryQuantity }]
                    });

                    if (upRes.data?.productVariantStocksUpdate?.errors?.length > 0) {
                        console.error(`      ❌ Stock Update Failed for "${cleanTitle}" - "${sv.title}":`, JSON.stringify(upRes.data.productVariantStocksUpdate.errors));
                    } else {
                        console.log(`      ✅ Stock Updated: "${cleanTitle}" - "${sv.title}" -> ${sv.inventoryQuantity}`);
                    }
                } else {
                    console.warn(`      ⚠️ Variant not found for "${cleanTitle}": "${sv.title}" (Options: ${saleorProd.variants.map((v: any) => v.name || "Default").join(", ")})`);
                }
            }
        }));

        console.log(`✅ Inventory Sync Complete for ${integration.storeUrl}`);
    }
});
