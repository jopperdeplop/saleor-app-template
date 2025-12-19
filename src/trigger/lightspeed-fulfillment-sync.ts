
import { task } from "@trigger.dev/sdk";
import { makeSaleorClient, WAREHOUSE_QUERY, FULFILLMENT_CREATE } from "../lib/saleor-client";
import { logDebug } from "../lib/utils";
import { apl } from "../saleor-app";
import { db } from "../db";
import { integrations, users } from "../db/schema";
import { eq, and } from "drizzle-orm";

export const lightspeedFulfillmentSync = task({
    id: "lightspeed-fulfillment-sync",
    run: async (payload: {
        lightspeedOrderId: string,
        trackingNumber?: string,
        trackingUrl?: string,
        vendorStoreUrl: string // This is the domainPrefix
    }) => {
        logDebug(`🔄 [Lightspeed -> Saleor] Syncing Fulfillment for Lightspeed Order: ${payload.lightspeedOrderId} from ${payload.vendorStoreUrl}`);

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
            logDebug(`   ⚠️ Could not find brand for store URL ${payload.vendorStoreUrl}.`);
        }

        const brandSlug = brandName ? slugify(brandName) : null;
        const metadataKey = brandSlug ? `lightspeed_order_id_${brandSlug}` : null;

        logDebug(`   🎯 Target Metadata Key: ${metadataKey || '(Broad Search)'} | Value: ${payload.lightspeedOrderId}`);

        // 3. Find the Saleor Order by Metadata Filter
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
            const { data: narrowData } = await client.query(findOrderQuery, { key: metadataKey, val: payload.lightspeedOrderId }).toPromise();
            saleorOrder = narrowData?.orders?.edges?.[0]?.node;
        }

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
            `, { val: payload.lightspeedOrderId }).toPromise();

            saleorOrder = broadData?.orders?.edges?.find((e: any) =>
                e.node.metadata.some((m: any) => m.key.startsWith('lightspeed_order_id_') && m.value === payload.lightspeedOrderId)
            )?.node;
        }

        if (!saleorOrder) {
            logDebug(`   ❌ No matching Saleor order found for Lightspeed ID ${payload.lightspeedOrderId}.`);
            return { status: "not_found" };
        }

        logDebug(`   ✅ Found Saleor Order: #${saleorOrder.number} (${saleorOrder.id})`);

        // 4. Execute Saleor Fulfillment
        // We reuse the logic from shopify sync for warehouse determination
        const linesToFulfill = saleorOrder.lines.map((l: any) => {
            const targetWarehouse = l.allocations?.[0]?.warehouse?.id || process.env.SALEOR_WAREHOUSE_ID;
            return {
                orderLineId: l.id,
                stocks: [{
                    quantity: l.quantity,
                    warehouse: targetWarehouse
                }]
            };
        });

        const fulfillRes = await client.mutation(FULFILLMENT_CREATE, {
            order: saleorOrder.id,
            input: {
                lines: linesToFulfill,
                trackingNumber: payload.trackingNumber,
                notifyCustomer: true
            }
        }).toPromise();

        if (fulfillRes.data?.orderFulfill?.errors?.length > 0) {
            throw new Error(`Saleor Fulfillment Failed: ${JSON.stringify(fulfillRes.data.orderFulfill.errors)}`);
        }

        return { success: true, orderNumber: saleorOrder.number };
    },
});

function slugify(text: string) {
    return text.toLowerCase().replace(/[^a-z0-9]/g, '_');
}
