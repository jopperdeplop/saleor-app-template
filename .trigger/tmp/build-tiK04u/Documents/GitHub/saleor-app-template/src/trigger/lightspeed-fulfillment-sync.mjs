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

// src/trigger/lightspeed-fulfillment-sync.ts
init_esm();
var lightspeedFulfillmentSync = task({
  id: "lightspeed-fulfillment-sync",
  run: /* @__PURE__ */ __name(async (payload) => {
    logDebug(`🔄 [Lightspeed -> Saleor] Syncing Fulfillment for Lightspeed Order: ${payload.lightspeedOrderId} from ${payload.vendorStoreUrl}`);
    const apiUrl = process.env.SALEOR_API_URL;
    if (!apiUrl) throw new Error("SALEOR_API_URL missing");
    const authData = await apl.get(apiUrl);
    if (!authData || !authData.token) throw new Error("Saleor Auth Token missing");
    const client = makeSaleorClient(apiUrl, authData.token);
    logDebug(`   🔍 Looking up integration for store: ${payload.vendorStoreUrl}`);
    const results = await db.select({
      accessToken: integrations.accessToken,
      brand: users.brand
    }).from(integrations).innerJoin(users, eq(integrations.userId, users.id)).where(eq(integrations.storeUrl, payload.vendorStoreUrl.toLowerCase())).limit(1);
    const integration = results[0];
    if (!integration || !integration.accessToken) {
      logDebug(`   ⚠️ Could not find active integration for store URL ${payload.vendorStoreUrl}.`);
      return { status: "not_found" };
    }
    const brandName = integration.brand;
    const brandSlug = brandName ? slugify(brandName) : null;
    const metadataKey = brandSlug ? `lightspeed_order_id_${brandSlug}` : null;
    let trackingNumber = payload.trackingNumber;
    if (!trackingNumber) {
      logDebug(`   📡 Fetching latest sale data for ${payload.lightspeedOrderId}...`);
      const saleRes = await fetch(`https://${payload.vendorStoreUrl}.retail.lightspeed.app/api/2.0/register_sales/${payload.lightspeedOrderId}`, {
        headers: { "Authorization": `Bearer ${integration.accessToken}` }
      });
      if (saleRes.ok) {
        const saleData = await saleRes.json();
        const sale = saleData.data;
        const isCompleted = ["CLOSED", "COMPLETED", "SHIPPED", "FULFILLED"].includes(sale.status?.toUpperCase());
        if (!isCompleted) {
          logDebug(`   ⏳ Sale status is ${sale.status}. Skipping Saleor fulfillment for now.`);
          return { status: "pending", currentStatus: sale.status };
        }
        const fulfillRes2 = await fetch(`https://${payload.vendorStoreUrl}.retail.lightspeed.app/api/2.0/register_sales/${payload.lightspeedOrderId}/fulfillments`, {
          headers: { "Authorization": `Bearer ${integration.accessToken}` }
        });
        if (fulfillRes2.ok) {
          const fulfillData = await fulfillRes2.json();
          const latestFulfillment = fulfillData.data?.[0];
          trackingNumber = latestFulfillment?.tracking_number || latestFulfillment?.delivery_track_id;
        }
      }
    }
    logDebug(`   🎯 Target Metadata Key: ${metadataKey || "(Broad Search)"} | Value: ${payload.lightspeedOrderId}`);
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
      saleorOrder = broadData?.orders?.edges?.find(
        (e) => e.node.metadata.some((m) => m.key.startsWith("lightspeed_order_id_") && m.value === payload.lightspeedOrderId)
      )?.node;
    }
    if (!saleorOrder) {
      logDebug(`   ❌ No matching Saleor order found for Lightspeed ID ${payload.lightspeedOrderId}.`);
      return { status: "not_found" };
    }
    logDebug(`   ✅ Found Saleor Order: #${saleorOrder.number} (${saleorOrder.id})`);
    const linesToFulfill = saleorOrder.lines.map((l) => {
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
        trackingNumber: trackingNumber || payload.trackingNumber,
        notifyCustomer: true
      }
    }).toPromise();
    if (fulfillRes.data?.orderFulfill?.errors?.length > 0) {
      throw new Error(`Saleor Fulfillment Failed: ${JSON.stringify(fulfillRes.data.orderFulfill.errors)}`);
    }
    return { success: true, orderNumber: saleorOrder.number, trackingNumber };
  }, "run")
});
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/g, "_");
}
__name(slugify, "slugify");
export {
  lightspeedFulfillmentSync
};
//# sourceMappingURL=lightspeed-fulfillment-sync.mjs.map
