import {
  apl,
  logDebug,
  normalizeUrl
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

// src/trigger/woocommerce-fulfillment-sync.ts
init_esm();
var woocommerceFulfillmentSync = task({
  id: "woocommerce-fulfillment-sync",
  run: /* @__PURE__ */ __name(async (payload) => {
    logDebug(`🔄 [WooCommerce -> Saleor] Syncing Fulfillment for WC Order: ${payload.woocommerceOrderId} from ${payload.vendorStoreUrl}`);
    const apiUrl = process.env.SALEOR_API_URL;
    if (!apiUrl) throw new Error("SALEOR_API_URL missing");
    const authData = await apl.get(apiUrl);
    if (!authData || !authData.token) throw new Error("Saleor Auth Token missing");
    const client = makeSaleorClient(apiUrl, authData.token);
    const normalizedSource = normalizeUrl(payload.vendorStoreUrl);
    const vendorData = await db.select({ brand: users.brand }).from(integrations).innerJoin(users, eq(integrations.userId, users.id)).where(eq(integrations.storeUrl, normalizedSource)).limit(1);
    const brandName = vendorData[0]?.brand;
    if (!brandName) {
      logDebug(`   ⚠️ Could not find brand for store URL ${payload.vendorStoreUrl}.`);
    }
    const brandSlug = payload.brandSlug || (brandName ? slugify(brandName) : null);
    const metadataKey = brandSlug ? `woocommerce_order_id_${brandSlug}` : null;
    logDebug(`   🎯 Target Metadata Key: ${metadataKey || "(Broad Search)"} | Value: ${payload.woocommerceOrderId}`);
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
      const { data: narrowData } = await client.query(findOrderQuery, { key: metadataKey, val: payload.woocommerceOrderId }).toPromise();
      saleorOrder = narrowData?.orders?.edges?.[0]?.node;
    }
    if (!saleorOrder) {
      logDebug(`   🕵️ Falling back to broad metadata scan...`);
      const { data: broadData } = await client.query(`
                query BroadOrderSearch {
                    orders(first: 50) {
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
            `, {}).toPromise();
      saleorOrder = broadData?.orders?.edges?.find(
        (e) => e.node.metadata.some((m) => m.key.includes("woocommerce_order_id_") && m.value === payload.woocommerceOrderId)
      )?.node;
    }
    if (!saleorOrder) {
      logDebug(`   ❌ No matching Saleor order found for WooCommerce ID ${payload.woocommerceOrderId}.`);
      return { status: "not_found" };
    }
    logDebug(`   ✅ Found Saleor Order: #${saleorOrder.number} (${saleorOrder.id})`);
    let defaultWarehouseId = process.env.SALEOR_WAREHOUSE_ID;
    let vendorWarehouseId = null;
    if (!defaultWarehouseId) {
      const warehouseRes = await client.query(WAREHOUSE_QUERY, { search: "" }).toPromise();
      defaultWarehouseId = warehouseRes.data?.warehouses?.edges?.[0]?.node?.id;
    }
    if (brandName) {
      const vendorSlug = `vendor-${slugify(brandName)}`;
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
      }
    }
    const linesToFulfill = saleorOrder.lines.map((l) => {
      let targetWarehouse = vendorWarehouseId || (l.allocations?.length > 0 ? l.allocations[0].warehouse.id : process.env.SALEOR_WAREHOUSE_ID || defaultWarehouseId);
      if (!targetWarehouse) {
        throw new Error(`No warehouse found for line ${l.productName}.`);
      }
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
  }, "run")
});
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "-");
}
__name(slugify, "slugify");
export {
  woocommerceFulfillmentSync
};
//# sourceMappingURL=woocommerce-fulfillment-sync.mjs.map
