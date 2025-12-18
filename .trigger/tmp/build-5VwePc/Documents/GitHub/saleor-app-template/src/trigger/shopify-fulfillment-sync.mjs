import {
  FULFILLMENT_CREATE,
  apl,
  makeSaleorClient
} from "../../../../../chunk-HYDI5HR6.mjs";
import "../../../../../chunk-UHMN67P6.mjs";
import {
  logDebug
} from "../../../../../chunk-JUBDIEYX.mjs";
import {
  db,
  eq,
  integrations,
  users
} from "../../../../../chunk-DZ7OZDGX.mjs";
import {
  task
} from "../../../../../chunk-ONHLK5E6.mjs";
import "../../../../../chunk-YV5CNPDY.mjs";
import {
  __name,
  init_esm
} from "../../../../../chunk-TQ3WNEB5.mjs";

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
    let warehouseId = process.env.SALEOR_WAREHOUSE_ID;
    if (!warehouseId) {
      logDebug(`   ⚠️ SALEOR_WAREHOUSE_ID not set. Fetching default warehouse...`);
      const { data: whData } = await client.query(`query DefaultWarehouse { warehouses(first: 1) { edges { node { id name } } } }`, {}).toPromise();
      warehouseId = whData?.warehouses?.edges?.[0]?.node?.id;
      if (warehouseId) {
        logDebug(`   🏢 Using Default Warehouse: ${whData?.warehouses?.edges?.[0]?.node?.name} (${warehouseId})`);
      } else {
        throw new Error("No Warehouse found in Saleor. Cannot fulfill order.");
      }
    }
    const linesToFulfill = saleorOrder.lines.map((l) => ({
      orderLineId: l.id,
      stocks: [{
        quantity: l.quantity,
        warehouse: warehouseId
      }]
    }));
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
  return text.toLowerCase().replace(/[^a-z0-9]/g, "_");
}
__name(slugify, "slugify");
export {
  shopifyFulfillmentSync
};
//# sourceMappingURL=shopify-fulfillment-sync.mjs.map
