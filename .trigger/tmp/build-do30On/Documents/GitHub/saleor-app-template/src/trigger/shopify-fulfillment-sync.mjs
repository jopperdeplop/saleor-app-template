import {
  apl,
  logDebug
} from "../../../../../chunk-Y5F4RJXU.mjs";
import {
  db,
  eq,
  integrations,
  users
} from "../../../../../chunk-KC6DVKSX.mjs";
import {
  FULFILLMENT_CREATE,
  WAREHOUSE_QUERY,
  makeSaleorClient
} from "../../../../../chunk-DLK7GY2S.mjs";
import "../../../../../chunk-L34HRTRG.mjs";
import {
  task
} from "../../../../../chunk-ENJ6DR3G.mjs";
import "../../../../../chunk-DEKBIM76.mjs";
import {
  __name,
  init_esm
} from "../../../../../chunk-CEGEFIIW.mjs";

// src/trigger/shopify-fulfillment-sync.ts
init_esm();
var shopifyFulfillmentSync = task({
  id: "shopify-fulfillment-sync",
  run: /* @__PURE__ */ __name(async (payload) => {
    logDebug(`🔄 [Shopify -> Saleor] Syncing Fulfillment for Shopify Order: ${payload.shopifyOrderId} from ${payload.vendorStoreUrl}`);
    const apiUrl = process.env.SALEOR_API_URL;
    if (!apiUrl) throw new Error("SALEOR_API_URL missing");
    const authData = await apl.get(apiUrl);
    if (!authData || !authData.token) throw new Error("Saleor Auth Token missing");
    const client = makeSaleorClient(apiUrl, authData.token);
    logDebug(`   🔍 Looking up brand for store: ${payload.vendorStoreUrl}`);
    const vendorData = await db.select({ brand: users.brand }).from(integrations).innerJoin(users, eq(integrations.userId, users.id)).where(eq(integrations.storeUrl, payload.vendorStoreUrl)).limit(1);
    const brandName = vendorData[0]?.brand;
    if (!brandName) {
      logDebug(`   ⚠️ Could not find brand for store URL ${payload.vendorStoreUrl}. Check integrations table.`);
    }
    const brandSlug = brandName ? slugify(brandName) : null;
    const metadataKey = brandSlug ? `shopify_order_id_${brandSlug}` : null;
    logDebug(`   🎯 Target Metadata Key: ${metadataKey || "(Broad Search)"} | Value: ${payload.shopifyOrderId}`);
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
      saleorOrder = broadData?.orders?.edges?.find(
        (e) => e.node.metadata.some((m) => m.key.startsWith("shopify_order_id_") && m.value === payload.shopifyOrderId)
      )?.node;
    }
    if (!saleorOrder) {
      logDebug(`   ❌ No matching Saleor order found for Shopify ID ${payload.shopifyOrderId}.`);
      return { status: "not_found" };
    }
    logDebug(`   ✅ Found Saleor Order: #${saleorOrder.number} (${saleorOrder.id})`);
    let defaultWarehouseId = process.env.SALEOR_WAREHOUSE_ID;
    let vendorWarehouseId = null;
    if (!defaultWarehouseId) {
      const warehouseRes = await client.query(WAREHOUSE_QUERY, { search: "" }).toPromise();
      defaultWarehouseId = warehouseRes.data?.warehouses?.edges?.[0]?.node?.id;
      if (defaultWarehouseId) logDebug(`   🏢 Found Default Warehouse: ${defaultWarehouseId}`);
    }
    if (brandName) {
      const vendorSlug = `vendor-${slugify(brandName)}`;
      logDebug(`   🏭 Looking for Vendor Warehouse: "${brandName}" (Slug: ${vendorSlug})`);
      const { data: whData } = await client.query(`
                query FindWarehouse($slug: String, $search: String) {
                    warehouses(filter: { slug: [$slug], search: $search }, first: 5) {
                        edges { node { id name slug } }
                    }
                }
            `, { slug: vendorSlug, search: brandName }).toPromise();
      const edges = whData?.warehouses?.edges || [];
      const foundWarehouse = edges.find((e) => e.node.slug === vendorSlug)?.node || edges.find((e) => e.node.name.toLowerCase().includes(brandName.toLowerCase()))?.node;
      if (foundWarehouse) {
        vendorWarehouseId = foundWarehouse.id;
        logDebug(`   ✅ Found Vendor Warehouse: ${foundWarehouse.name} (${vendorWarehouseId})`);
      } else {
        logDebug(`   ⚠️ Vendor Warehouse not found. Will rely on Allocations or Default.`);
      }
    }
    const linesToFulfill = saleorOrder.lines.map((l) => {
      let targetWarehouse = null;
      let source = "NONE";
      if (vendorWarehouseId) {
        targetWarehouse = vendorWarehouseId;
        source = "VENDOR_MATCH";
      } else if (l.allocations?.length > 0) {
        targetWarehouse = l.allocations[0].warehouse.id;
        source = "ALLOCATION";
      } else {
        targetWarehouse = process.env.SALEOR_WAREHOUSE_ID || defaultWarehouseId;
        source = targetWarehouse === process.env.SALEOR_WAREHOUSE_ID ? "ENV" : "DEFAULT";
      }
      if (!targetWarehouse) {
        throw new Error(`No warehouse found for line ${l.productName}.`);
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
  }, "run")
});
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "-");
}
__name(slugify, "slugify");
export {
  shopifyFulfillmentSync
};
//# sourceMappingURL=shopify-fulfillment-sync.mjs.map
