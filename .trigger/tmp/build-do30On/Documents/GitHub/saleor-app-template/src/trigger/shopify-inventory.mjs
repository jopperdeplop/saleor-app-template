import {
  db,
  eq,
  integrations
} from "../../../../../chunk-KC6DVKSX.mjs";
import {
  logger,
  schedules_exports,
  task
} from "../../../../../chunk-ENJ6DR3G.mjs";
import "../../../../../chunk-DEKBIM76.mjs";
import {
  __name,
  init_esm
} from "../../../../../chunk-CEGEFIIW.mjs";

// src/trigger/shopify-inventory.ts
init_esm();
var DEFAULT_WAREHOUSE_ID = process.env.SALEOR_WAREHOUSE_ID;
var DEFAULT_VENDOR_ADDRESS = {
  firstName: "Logistics",
  lastName: "Manager",
  companyName: "Vendor Warehouse",
  streetAddress1: "123 Market St",
  city: "San Francisco",
  postalCode: "94105",
  country: "US",
  countryArea: "CA"
};
var shopifyInventoryScheduledSync = schedules_exports.task({
  id: "shopify-inventory-scheduled-sync",
  cron: "0 */6 * * *",
  // Every 6 hours
  run: /* @__PURE__ */ __name(async (payload) => {
    const activeIntegrations = await db.query.integrations.findMany({
      where: eq(integrations.status, "active")
    });
    const shopifyStores = activeIntegrations.filter((i) => i.provider === "shopify");
    logger.info(`⏰ Scheduled Shopify Sync: Found ${shopifyStores.length} stores.`);
    for (const integration of shopifyStores) {
      await shopifyInventorySync.trigger({ integrationId: integration.id });
    }
  }, "run")
});
var shopifyInventorySync = task({
  id: "shopify-inventory-sync",
  run: /* @__PURE__ */ __name(async (payload) => {
    logger.info(`🔍 Received Sync Request for Integration ID: ${payload.integrationId}`);
    const integration = await db.query.integrations.findFirst({
      where: eq(integrations.id, payload.integrationId)
    });
    if (!integration || integration.provider !== "shopify") {
      logger.error(`❌ Integration ${payload.integrationId} not found or not Shopify.`);
      return;
    }
    const apiUrl = process.env.SALEOR_API_URL;
    let saleorToken = (process.env.SALEOR_APP_TOKEN || process.env.SALEOR_TOKEN || "").trim();
    if (saleorToken) {
      const start = saleorToken.substring(0, 5);
      const end = saleorToken.substring(saleorToken.length - 5);
      logger.info(`🔑 [SECURITY] Using Saleor Token: ${start}...${end} (Length: ${saleorToken.length})`);
      saleorToken = `Bearer ${saleorToken.replace(/^bearer\s+/i, "")}`;
    }
    if (!apiUrl || !saleorToken) throw new Error("Missing SALEOR_API_URL or SALEOR_TOKEN");
    const saleorHeaders = {
      "Authorization": saleorToken,
      "Content-Type": "application/json"
    };
    const saleorFetch = /* @__PURE__ */ __name(async (query, variables = {}) => {
      try {
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: saleorHeaders,
          body: JSON.stringify({ query, variables })
        });
        const json = await res.json();
        if (json.errors) {
          const isSchemaError = json.errors[0]?.message?.includes("Cannot query field");
          if (isSchemaError) logger.error("   ❌ Saleor Schema Error:", { message: json.errors[0].message });
          else logger.error("   ❌ Saleor Error:", { errors: json.errors });
        }
        return json;
      } catch (e) {
        logger.error("   ❌ Network Error during Saleor Request:", { error: e instanceof Error ? e.message : e });
        return {};
      }
    }, "saleorFetch");
    const baseFilter = "status:active AND inventory_total:>0";
    const filter = payload.since ? `${baseFilter} AND updated_at:>=${payload.since}` : baseFilter;
    const shopifyQuery = `{ products(first:50, query: "${filter}") { edges { node { id title vendor variants(first:50){edges{node{id title sku inventoryQuantity}}} } } } }`;
    logger.info(`📡 Connecting to Shopify for ${integration.storeUrl}...`);
    const shopifyRes = await fetch(`https://${integration.storeUrl}/admin/api/2024-04/graphql.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": integration.accessToken || ""
      },
      body: JSON.stringify({ query: shopifyQuery })
    });
    const shopifyJson = await shopifyRes.json();
    const products = shopifyJson.data?.products?.edges || [];
    if (products.length === 0) {
      logger.info(payload.since ? `✨ No recent changes found since ${payload.since}.` : "Empty Shopify catalog or no active stock found.");
      return;
    }
    const channelsRes = await saleorFetch(`{ channels { id slug } }`);
    const channels = channelsRes.data?.channels || [];
    const getWarehouseId = /* @__PURE__ */ __name(async (vendorName) => {
      const slug = `vendor-${vendorName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
      const find = await saleorFetch(`query Find($s:String!){warehouses(filter:{search:$s},first:5){edges{node{id name slug}}}}`, { s: vendorName });
      const existing = find.data?.warehouses?.edges?.find((e) => e.node.slug === slug || e.node.name === `${vendorName} Warehouse`)?.node;
      if (existing) return existing.id;
      logger.info(`🏭 Creating Warehouse: "${vendorName}"`);
      const inputs = {
        name: `${vendorName} Warehouse`,
        slug,
        address: DEFAULT_VENDOR_ADDRESS,
        email: "vendor@example.com"
      };
      const createRes = await saleorFetch(`mutation CreateWarehouse($input:WarehouseCreateInput!){createWarehouse(input:$input){warehouse{id} errors{field message}}}`, {
        input: inputs
      });
      const result = createRes.data?.createWarehouse;
      const newId = result?.warehouse?.id;
      if (newId) {
        logger.info(`   ✅ Warehouse Created: ${newId}`);
        for (const ch of channels) {
          await saleorFetch(`mutation UpdCh($id:ID!,$input:ChannelUpdateInput!){channelUpdate(id:$id,input:$input){errors{field}}}`, { id: ch.id, input: { addWarehouses: [newId] } });
        }
        return newId;
      }
      logger.warn(`   ❌ Warehouse Creation failed. Falling back to: ${DEFAULT_WAREHOUSE_ID}`);
      return DEFAULT_WAREHOUSE_ID;
    }, "getWarehouseId");
    const uniqueVendors = Array.from(new Set(products.map((p) => p.node.vendor || "Default")));
    const warehouseContext = /* @__PURE__ */ new Map();
    logger.info(`🏗️  Resolving warehouses for ${uniqueVendors.length} vendors...`);
    for (const vendor of uniqueVendors) {
      const whId = await getWarehouseId(vendor);
      if (whId) warehouseContext.set(vendor, whId);
    }
    logger.info(`🔄 Deterministic Sync for ${products.length} products...`);
    for (const pEdge of products) {
      const sp = pEdge.node;
      if (!sp || !sp.title) continue;
      const vendorName = sp.vendor || "Default";
      const warehouseId = warehouseContext.get(vendorName);
      if (!warehouseId) continue;
      const cleanTitle = sp.title.trim();
      const predictableSlug = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      let saleorProd = null;
      const slugRes = await saleorFetch(`query FindSlug($s:String!){product(slug:$s){id name variants{id name sku}}}`, { s: predictableSlug });
      saleorProd = slugRes.data?.product;
      if (!saleorProd) {
        const searchRes = await saleorFetch(`query FindProd($n:String!){products(filter:{search:$n},first:20){edges{node{id name variants{id name sku}}}}}`, { n: cleanTitle });
        saleorProd = searchRes.data?.products?.edges?.find((e) => e.node.name?.trim() === cleanTitle)?.node;
      }
      if (!saleorProd) continue;
      const variants = sp.variants?.edges || [];
      for (const vEdge of variants) {
        const sv = vEdge.node;
        const shopifyId = sv.id ? sv.id.split("/").pop() : null;
        if (!shopifyId) continue;
        const saleorVar = saleorProd.variants?.find((ev) => ev.sku === shopifyId);
        if (saleorVar) {
          const upRes = await saleorFetch(`mutation UpdStock($id:ID!,$stocks:[StockInput!]!){productVariantStocksUpdate(variantId:$id,stocks:$stocks){errors{field message}}}`, {
            id: saleorVar.id,
            stocks: [{ warehouse: warehouseId, quantity: sv.inventoryQuantity || 0 }]
          });
          if (!upRes.data?.productVariantStocksUpdate?.errors?.length) {
            logger.info(`      ✅ Stock Updated: "${cleanTitle}" - SKU ${shopifyId} -> ${sv.inventoryQuantity}`);
          }
        }
      }
    }
    logger.info(`✅ Inventory Sync Complete for ${integration.storeUrl}`);
  }, "run")
});
export {
  shopifyInventoryScheduledSync,
  shopifyInventorySync
};
//# sourceMappingURL=shopify-inventory.mjs.map
