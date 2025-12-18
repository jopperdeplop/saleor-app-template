import { task } from "@trigger.dev/sdk";
import { makeSaleorClient, WAREHOUSE_QUERY, FULFILLMENT_CREATE, ORDER_QUERY } from "../lib/saleor-client";
import { logDebug } from "../lib/utils";
import { apl } from "../saleor-app";
import { db } from "../db";
import { integrations, users } from "../db/schema";
import { eq, and } from "drizzle-orm";

export const shopifyFulfillmentSync = task({
    id: "shopify-fulfillment-sync",
    run: async (payload: {
        shopifyOrderId: string,
        trackingNumber?: string,
        trackingUrl?: string,
        vendorStoreUrl: string
    }) => {
        logDebug(`🔄 [Shopify -> Saleor] Syncing Fulfillment for Shopify Order: ${payload.shopifyOrderId} from ${payload.vendorStoreUrl}`);

        // 1. Setup Saleor Context
        const apiUrl = process.env.SALEOR_API_URL;
        if (!apiUrl) throw new Error("SALEOR_API_URL missing");
        const authData = await apl.get(apiUrl);
        if (!authData || !authData.token) throw new Error("Saleor Auth Token missing");
        const client = makeSaleorClient(apiUrl, authData.token);

        // 2. Find the Brand Slug for this Store URL
        logDebug(`   🔍 Looking up brand for store: ${payload.vendorStoreUrl}`);
        const vendorData = await db.select({ brand: users.brand })
            .from(integrations)
            .innerJoin(users, eq(integrations.userId, users.id))
            .where(eq(integrations.storeUrl, payload.vendorStoreUrl))
            .limit(1);

        const brandName = vendorData[0]?.brand;
        if (!brandName) {
            logDebug(`   ⚠️ Could not find brand for store URL ${payload.vendorStoreUrl}. Check integrations table.`);
            // Fallback: Continue and try broad search, but this is the primary failure point
        }

        const brandSlug = brandName ? slugify(brandName) : null;
        const metadataKey = brandSlug ? `shopify_order_id_${brandSlug}` : null;

        logDebug(`   🎯 Target Metadata Key: ${metadataKey || '(Broad Search)'} | Value: ${payload.shopifyOrderId}`);

        // 3. Find the Saleor Order by Metadata Filter (Strict)
        let saleorOrder = null;

        if (metadataKey) {
            const findOrderQuery = `
              query FindOrderByMeta($key: String!, $val: String!) {
                orders(filter: { metadata: [{ key: $key, value: $val }] }, first: 1) {
                  edges {
                    node {
                      id
                      number
                      lines {
                        id
                        quantity
                        productName
                        allocations {
                          quantity
                          warehouse { id }
                        }
                      }
                    }
                  }
                }
              }
            `;
            const { data: narrowData } = await client.query(findOrderQuery, { key: metadataKey, val: payload.shopifyOrderId }).toPromise();
            saleorOrder = narrowData?.orders?.edges?.[0]?.node;
        }

        // 4. Broad Search Fallback (if key lookup failed)
        if (!saleorOrder) {
            logDebug(`   🕵️ Falling back to broad metadata scan...`);
            const { data: broadData } = await client.query(`
                query BroadOrderSearch($val: String!) {
                    orders(first: 20, filter: { search: $val }) {
                        edges {
                            node {
                                id
                                number
                                metadata { key value }
                                lines {
                                    id
                                    quantity
                                    productName
                                    allocations {
                                      quantity
                                      warehouse { id }
                                    }
                                }
                            }
                        }
                    }
                }
            `, { val: payload.shopifyOrderId }).toPromise();

            saleorOrder = broadData?.orders?.edges?.find((e: any) =>
                e.node.metadata.some((m: any) => m.key.startsWith('shopify_order_id_') && m.value === payload.shopifyOrderId)
            )?.node;
        }

        if (!saleorOrder) {
            logDebug(`   ❌ No matching Saleor order found for Shopify ID ${payload.shopifyOrderId}.`);
            return { status: "not_found" };
        }

        logDebug(`   ✅ Found Saleor Order: #${saleorOrder.number} (${saleorOrder.id})`);

        // 5. Determine Warehouses (Default & Vendor)
        let defaultWarehouseId = process.env.SALEOR_WAREHOUSE_ID;
        let vendorWarehouseId: string | null = null;

        // A. Fetch Default if needed
        if (!defaultWarehouseId) {
            const warehouseRes = await client.query(WAREHOUSE_QUERY, { search: "" }).toPromise();
            defaultWarehouseId = warehouseRes.data?.warehouses?.edges?.[0]?.node?.id;
            if (defaultWarehouseId) logDebug(`   🏢 Found Default Warehouse: ${defaultWarehouseId}`);
        }

        // B. Fetch Vendor Warehouse (Best Effort)
        if (brandName) {
            const vendorSlug = `vendor-${slugify(brandName)}`;
            logDebug(`   🏭 Looking for Vendor Warehouse with slug: ${vendorSlug}`);
            // We use a custom query to filter by slug specifically if possible, or search
            const { data: whData } = await client.query(`
                query FindWarehouseBySlug($slug: String) {
                    warehouses(filter: { slug: [$slug] }, first: 1) {
                        edges { node { id name } }
                    }
                }
            `, { slug: vendorSlug }).toPromise();

            vendorWarehouseId = whData?.warehouses?.edges?.[0]?.node?.id;
            if (vendorWarehouseId) {
                logDebug(`   ✅ Found Vendor Warehouse: ${whData.warehouses.edges[0].node.name} (${vendorWarehouseId})`);
            } else {
                logDebug(`   ⚠️ Vendor Warehouse not found. Will rely on Allocations or Default.`);
            }
        }

        // 6. Execute Saleor Fulfillment
        const linesToFulfill = saleorOrder.lines.map((l: any) => {
            let targetWarehouse = process.env.SALEOR_WAREHOUSE_ID; // 1. Env Override
            let source = "ENV";

            if (!targetWarehouse && vendorWarehouseId) {
                // 2. Vendor Warehouse (Pattern Matching) - Prioritize this if no Env set
                // This covers "Zero Touch" where allocation might not exist yet
                targetWarehouse = vendorWarehouseId;
                source = "VENDOR_MATCH";
            } else if (!targetWarehouse && l.allocations?.length > 0) {
                // 3. Exact Allocation (Fallback if Vendor WH mismatch or specific stock used)
                targetWarehouse = l.allocations[0].warehouse.id;
                source = "ALLOCATION";
            } else if (!targetWarehouse) {
                // 4. Default Fallback
                if (defaultWarehouseId) {
                    targetWarehouse = defaultWarehouseId;
                    source = "DEFAULT";
                } else {
                    throw new Error(`No warehouse found for line ${l.productName}.`);
                }
            }

            logDebug(`   📦 Line: "${l.productName}" -> Warehouse: ${targetWarehouse} (Source: ${source})`);

            return {
                orderLineId: l.id,
                stocks: [{
                    quantity: l.quantity,
                    warehouse: targetWarehouse
                }]
            };
        });

        logDebug(`   📦 Sending Fulfillment Mutation...`);

        const fulfillRes = await client.mutation(FULFILLMENT_CREATE, {
            order: saleorOrder.id,
            input: {
                lines: linesToFulfill,
                trackingNumber: payload.trackingNumber,
                notifyCustomer: true
            }
        }).toPromise();

        logDebug(`   🔍 Raw Mutation Result:`, JSON.stringify(fulfillRes));

        if (fulfillRes.error) {
            logDebug(`   ❌ GraphQL Network/Auth Error:`, fulfillRes.error.message);
            throw new Error("GraphQL Error: " + fulfillRes.error.message);
        }

        if (fulfillRes.data?.orderFulfill?.errors?.length > 0) {
            const errorMsg = JSON.stringify(fulfillRes.data.orderFulfill.errors);
            logDebug(`   ❌ Saleor Logic Error:`, errorMsg);
            throw new Error(`Saleor Fulfillment Failed: ${errorMsg}`);
        } else if (fulfillRes.data?.orderFulfill?.fulfillments?.length > 0) {
            logDebug(`   🎉 Saleor Order #${saleorOrder.number} marked as Fulfilled! ID: ${fulfillRes.data.orderFulfill.fulfillments[0].id}`);
        } else {
            throw new Error("Mutation success but no fulfillments returned?");
        }

        return { success: true, orderNumber: saleorOrder.number };
    }
});

function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]/g, '_');
}
