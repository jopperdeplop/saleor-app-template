import { task } from "@trigger.dev/sdk";
import { db } from "../db";
import { integrations } from "../db/schema";
import { eq } from "drizzle-orm";
import { decrypt } from "../lib/encryption";

export const woocommerceInventorySync = task({
    id: "woocommerce-inventory-sync",
    run: async (payload: { integrationId: number, wcProductId: number, stockStatus: string, stockQuantity?: number, manageStock: boolean }) => {
        const { integrationId, wcProductId, stockStatus, stockQuantity, manageStock } = payload;

        // 1. Setup & Auth
        const integration = await db.query.integrations.findFirst({ where: eq(integrations.id, integrationId) });
        if (!integration) throw new Error("Integration not found");

        const apiUrl = process.env.SALEOR_API_URL;
        let saleorToken = (process.env.SALEOR_APP_TOKEN || process.env.SALEOR_TOKEN || "").trim();
        if (saleorToken) saleorToken = `Bearer ${saleorToken.replace(/^bearer\s+/i, "")}`;

        const saleorHeaders = { 'Authorization': saleorToken, 'Content-Type': 'application/json' };
        const saleorFetch = async (query: string, variables: any = {}) => {
            const res = await fetch(apiUrl!, { method: 'POST', headers: saleorHeaders, body: JSON.stringify({ query, variables }) });
            return await res.json();
        };

        const WAREHOUSE_ID = process.env.SALEOR_WAREHOUSE_ID;
        if (!WAREHOUSE_ID) throw new Error("Missing SALEOR_WAREHOUSE_ID");

        // 2. Map WC Stock to Saleor Quantity
        let quantity = 0;
        if (manageStock) {
            quantity = stockQuantity || 0;
        } else {
            quantity = stockStatus === 'instock' ? 100 : 0;
        }

        // 3. Find Vendor Warehouse
        const vendor = new URL(integration.storeUrl).hostname;
        const whSlug = `vendor-${vendor.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        const whRes = await saleorFetch(`query FindWH($s:String!){warehouses(filter:{search:$s},first:1){edges{node{id slug}}}}`, { s: vendor });
        let targetWarehouseId = whRes.data?.warehouses?.edges?.find((e: any) => e.node.slug === whSlug)?.node?.id || process.env.SALEOR_WAREHOUSE_ID;

        if (!targetWarehouseId) throw new Error("No target warehouse found for sync.");

        // 4. Find Saleor Variant by External Reference
        const findVarRes = await saleorFetch(`
            query FindVar($ref: String!) {
                productVariants(filter: { externalReference: $ref }, first: 10) {
                    edges {
                        node {
                            id
                        }
                    }
                }
            }
        `, { ref: wcProductId.toString() });

        const variants = findVarRes.data?.productVariants?.edges || [];
        if (variants.length === 0) {
            console.warn(`⚠️ No Saleor variant found for WooCommerce Product ID: ${wcProductId}`);
            return;
        }

        // 5. Update Stock for all matching variants
        for (const edge of variants) {
            const variantId = edge.node.id;
            console.log(`📦 Updating Saleor Stock for Variant ${variantId} -> Quantity: ${quantity} in Warehouse: ${targetWarehouseId}`);

            await saleorFetch(`
                mutation UpdateStock($id: ID!, $stocks: [StockInput!]!) {
                    productVariantUpdate(id: $id, input: { stocks: $stocks }) {
                        errors { field message }
                    }
                }
            `, {
                id: variantId,
                stocks: [{ warehouse: targetWarehouseId, quantity: quantity }]
            });
        }

        console.log(`✅ Inventory sync completed for WC Product ${wcProductId}`);
    }
});
