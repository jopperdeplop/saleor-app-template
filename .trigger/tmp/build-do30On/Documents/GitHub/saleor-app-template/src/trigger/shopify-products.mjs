import {
  bulkTranslateProducts
} from "../../../../../chunk-VTDZGDM7.mjs";
import {
  db,
  eq,
  integrations,
  users
} from "../../../../../chunk-KC6DVKSX.mjs";
import {
  task
} from "../../../../../chunk-ENJ6DR3G.mjs";
import "../../../../../chunk-DEKBIM76.mjs";
import {
  __name,
  init_esm
} from "../../../../../chunk-CEGEFIIW.mjs";

// src/trigger/shopify-products.ts
init_esm();
var SYNC_VERSION = "LITERAL-CLONE-V12-BRANDFIX";
var BRAND_MODEL_TYPE_ID = process.env.SALEOR_BRAND_MODEL_TYPE_ID;
var BRAND_ATTRIBUTE_ID = process.env.SALEOR_BRAND_ATTRIBUTE_ID;
var PRODUCT_TYPE_ID = process.env.SALEOR_PRODUCT_TYPE_ID;
var CATEGORY_ID = process.env.SALEOR_CATEGORY_ID;
var DEFAULT_WAREHOUSE_ID = process.env.SALEOR_WAREHOUSE_ID;
var PHOTOROOM_API_KEY = process.env.PHOTOROOM_API_KEY;
var COUNTRY_TO_CHANNEL = {
  "AT": "austria",
  "BE": "belgium",
  "HR": "croatia",
  "CY": "cyprus",
  "EE": "estonia",
  "FI": "finland",
  "FR": "france",
  "DE": "germany",
  "GR": "greece",
  "IE": "ireland",
  "IT": "italy",
  "LV": "latvia",
  "LT": "lithuania",
  "LU": "luxembourg",
  "MT": "malta",
  "NL": "netherlands",
  "PT": "portugal",
  "SK": "slovakia",
  "SI": "slovenia",
  "ES": "spain"
};
function textToEditorJs(text) {
  const cleanText = text ? text.replace(/\n/g, "<br>") : "";
  return JSON.stringify({
    time: Date.now(),
    blocks: [{ type: "paragraph", data: { text: cleanText } }],
    version: "2.25.0"
  });
}
__name(textToEditorJs, "textToEditorJs");
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
var shopifyProductSync = task({
  id: "shopify-product-sync",
  run: /* @__PURE__ */ __name(async (payload) => {
    console.log(`🚀 [${SYNC_VERSION}] Execution Start. Integration: ${payload.integrationId}`);
    const integrationData = await db.select({
      id: integrations.id,
      accessToken: integrations.accessToken,
      storeUrl: integrations.storeUrl,
      provider: integrations.provider,
      brandName: users.brand,
      shippingCountries: users.shippingCountries,
      settings: integrations.settings
    }).from(integrations).innerJoin(users, eq(integrations.userId, users.id)).where(eq(integrations.id, payload.integrationId)).limit(1);
    const integration = integrationData[0];
    if (!integration) throw new Error("Integration not found");
    const officialBrandName = integration.brandName;
    console.log(`🏷️  Using Official Brand Name from DB: "${officialBrandName}"`);
    if (integration.provider !== "shopify") {
      console.warn(`⚠️ skipping: Not Shopify`);
      return;
    }
    const apiUrl = process.env.SALEOR_API_URL;
    let saleorToken = (process.env.SALEOR_APP_TOKEN || process.env.SALEOR_TOKEN || "").trim();
    if (saleorToken) {
      const start = saleorToken.substring(0, 5);
      const end = saleorToken.substring(saleorToken.length - 5);
      console.log(`🔑 [SECURITY] Using Saleor Token: ${start}...${end} (Length: ${saleorToken.length})`);
      saleorToken = `Bearer ${saleorToken.replace(/^bearer\s+/i, "")}`;
    }
    if (!apiUrl || !saleorToken) throw new Error("Missing SALEOR_API_URL or SALEOR_TOKEN");
    console.log(`🌐 [ENV] SALEOR_API_URL: ${apiUrl}`);
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
          if (isSchemaError) {
            console.error("   ❌ Saleor Schema Error:", json.errors[0].message);
          } else {
            console.error("   ❌ Saleor Error:", JSON.stringify(json.errors[0]?.message || json.errors));
          }
        }
        return json;
      } catch (e) {
        console.error("   ❌ Network Error during Saleor Request:", e);
        return {};
      }
    }, "saleorFetch");
    console.log("   📡 Connecting to Shopify...");
    const fetchShopify = /* @__PURE__ */ __name(async (q) => {
      const query = `{ products(first:20${q ? `, query: "${q}"` : ""}) { edges { node { id title vendor descriptionHtml images(first:1){edges{node{url}}} variants(first:10){edges{node{id title sku price inventoryQuantity}}} } } } }`;
      return await fetch(`https://${integration.storeUrl}/admin/api/2024-04/graphql.json`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": integration.accessToken || ""
        },
        body: JSON.stringify({ query })
      });
    }, "fetchShopify");
    let shopifyRes = await fetchShopify("status:active AND inventory_total:>0");
    if (shopifyRes.status === 401 || shopifyRes.status === 403) throw new Error("Shopify API Access Denied.");
    let shopifyJson = await shopifyRes.json();
    let products = shopifyJson.data?.products?.edges || [];
    console.log(`   📦 Fetched ${products.length} products (Strict mode).`);
    if (products.length === 0) {
      console.warn("   ⚠️  Strict mode returned 0. Retrying loose mode...");
      shopifyRes = await fetchShopify("");
      shopifyJson = await shopifyRes.json();
      products = shopifyJson.data?.products?.edges || [];
      console.log(`   ℹ️  Loose mode found ${products.length} products.`);
    }
    const getSaleorChannels = /* @__PURE__ */ __name(async () => {
      const query = `{ channels { id slug currencyCode isActive } }`;
      const json = await saleorFetch(query);
      return (json.data?.channels || []).filter((c) => c.isActive);
    }, "getSaleorChannels");
    const getOrCreateBrandPage = /* @__PURE__ */ __name(async (name) => {
      if (!name) return null;
      const find = await saleorFetch(`query Find($n:String!){pages(filter:{search:$n},first:5){edges{node{id title isPublished}}}}`, { n: name });
      const existing = find.data?.pages?.edges?.find((e) => e.node.title === name)?.node;
      if (existing) {
        if (!existing.isPublished) {
          await saleorFetch(`mutation Pub($id:ID!){pageUpdate(id:$id,input:{isPublished:true}){errors{field}}}`, { id: existing.id });
        }
        return existing.id;
      }
      console.log(`   ✨ Creating Brand Page: "${name}"`);
      const create = await saleorFetch(`mutation Create($n:String!,$t:ID!){pageCreate(input:{title:$n,pageType:$t,isPublished:true,content:"{}"}){page{id} errors{field message}}}`, { n: name, t: BRAND_MODEL_TYPE_ID });
      return create.data?.pageCreate?.page?.id;
    }, "getOrCreateBrandPage");
    const getOrCreateShippingZones = /* @__PURE__ */ __name(async () => {
      const find = await saleorFetch(`query { shippingZones(first:100) { edges { node { id name } } } }`);
      return find.data?.shippingZones?.edges?.map((e) => e.node) || [];
    }, "getOrCreateShippingZones");
    const getOrCreateWarehouse = /* @__PURE__ */ __name(async (vendorName, channels2) => {
      const slug = `vendor-${vendorName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
      const find = await saleorFetch(`query Find($s:String!){warehouses(filter:{search:$s},first:5){edges{node{id name slug}}}}`, { s: vendorName });
      const existing = find.data?.warehouses?.edges?.find((e) => e.node.slug === slug || e.node.name === `${vendorName} Warehouse`)?.node;
      if (existing) return existing.id;
      console.log(`   🏭 Creating Warehouse: "${vendorName}"`);
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
      if (result?.errors?.length > 0) {
        if (result.errors.some((e) => e.field === "slug")) {
          const slugSearch = await saleorFetch(`query FindS($s:String!){warehouses(filter:{search:$s},first:10){edges{node{id slug}}}}`, { s: slug });
          const found = slugSearch.data?.warehouses?.edges?.find((e) => e.node.slug === slug)?.node;
          if (found) return found.id;
        }
        console.error("   ⚠️ Warehouse Creation Failed:", JSON.stringify(result.errors));
        return null;
      }
      const newId = result?.warehouse?.id;
      if (newId) {
        console.log(`   ✅ Warehouse Created: ${newId}`);
        for (const ch of channels2) {
          await saleorFetch(`mutation UpdCh($id:ID!,$input:ChannelUpdateInput!){channelUpdate(id:$id,input:$input){errors{field}}}`, { id: ch.id, input: { addWarehouses: [newId] } });
        }
        const zones = await getOrCreateShippingZones();
        for (const zone of zones) {
          await saleorFetch(`mutation UpdZone($id:ID!,$input:ShippingZoneUpdateInput!){shippingZoneUpdate(id:$id,input:$input){errors{field}}}`, { id: zone.id, input: { addWarehouses: [newId] } });
        }
      }
      return newId;
    }, "getOrCreateWarehouse");
    async function processImage(productId, imageUrl, title) {
      console.log("      🎨 Managing Product Media...");
      const mediaRes = await saleorFetch(`query GetMedia($id:ID!){product(id:$id){media{id}}}`, { id: productId });
      const existingMedia = mediaRes.data?.product?.media || [];
      if (existingMedia.length > 0) {
        console.log(`      🧹 Deleting ${existingMedia.length} existing images...`);
        for (const media of existingMedia) {
          await saleorFetch(`mutation DelMedia($id:ID!){productMediaDelete(id:$id){errors{field message}}}`, { id: media.id });
        }
      }
      const photoroomKey = PHOTOROOM_API_KEY;
      let imageBlob = null;
      if (photoroomKey) {
        try {
          const shopifyImgRes = await fetch(imageUrl);
          if (shopifyImgRes.ok) {
            const originalBlob = await shopifyImgRes.blob();
            const formData = new FormData();
            formData.append("image_file", originalBlob, "original.jpg");
            formData.append("background.color", "FFFFFF");
            formData.append("format", "webp");
            const prRes = await fetch("https://sdk.photoroom.com/v1/segment", {
              method: "POST",
              headers: { "x-api-key": photoroomKey },
              body: formData
            });
            if (prRes.ok) imageBlob = await prRes.blob();
          }
        } catch (e) {
          console.error("      ❌ Photoroom error:", e);
        }
      }
      if (imageBlob) {
        const fd = new FormData();
        const ops = {
          query: `mutation CreateMedia($p: ID!, $i: Upload!, $a: String) { productMediaCreate(input: { product: $p, image: $i, alt: $a }) { media { id } errors { field message } } }`,
          variables: { p: productId, i: null, a: title }
        };
        fd.append("operations", JSON.stringify(ops));
        fd.append("map", JSON.stringify({ "0": ["variables.i"] }));
        fd.append("0", imageBlob, "image.webp");
        await fetch(apiUrl, { method: "POST", headers: { "Authorization": saleorToken }, body: fd });
      } else {
        await saleorFetch(`mutation AddMedia($id: ID!, $url: String!, $alt: String) { productMediaCreate(input: { product: $id, mediaUrl: $url, alt: $alt }) { media { id } errors { field message } } }`, {
          id: productId,
          url: imageUrl,
          alt: title
        });
      }
    }
    __name(processImage, "processImage");
    const channels = await getSaleorChannels();
    const globalCountries = integrationData[0]?.shippingCountries || [];
    const isOptOut = !globalCountries || globalCountries.length === 0;
    const targetCountryCodes = isOptOut ? Object.keys(COUNTRY_TO_CHANNEL) : globalCountries;
    const activeChannels = channels.filter(
      (ch) => targetCountryCodes.some((c) => COUNTRY_TO_CHANNEL[c] === ch.slug)
    );
    if (channels.length === 0) {
      console.error("❌ No Active Channels found.");
      return;
    }
    const uniqueVendors = [officialBrandName];
    const vendorContext = /* @__PURE__ */ new Map();
    console.log(`   🏗️  Setting up context for ${uniqueVendors.length} unique vendors...`);
    for (const vendor of uniqueVendors) {
      const brandPageId = await getOrCreateBrandPage(vendor);
      let warehouseId = await getOrCreateWarehouse(vendor, channels);
      if (!warehouseId) warehouseId = DEFAULT_WAREHOUSE_ID;
      vendorContext.set(vendor, { brandPageId, warehouseId });
    }
    console.log(`📦 Parallel Sync for ${products.length} products...`);
    const processedProductIds = [];
    await Promise.all(products.map(async (pEdge) => {
      const p = pEdge.node;
      const vendorName = officialBrandName;
      const context = vendorContext.get(vendorName);
      const brandPageId = context?.brandPageId;
      const targetWarehouseId = context?.warehouseId;
      let finalProductId = null;
      const cleanTitle = p.title.trim();
      const predictableSlug = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const slugCheck = await saleorFetch(`query FindSlug($s:String!){product(slug:$s){id}}`, { s: predictableSlug });
      finalProductId = slugCheck.data?.product?.id;
      if (!finalProductId) {
        const createProdRes = await saleorFetch(`mutation Create($input:ProductCreateInput!){productCreate(input:$input){product{id} errors{field message}}}`, {
          input: {
            name: p.title,
            slug: predictableSlug,
            externalReference: p.id.split("/").pop(),
            productType: PRODUCT_TYPE_ID,
            category: CATEGORY_ID,
            description: textToEditorJs(p.descriptionHtml || p.title),
            metadata: [{ key: "brand", value: vendorName }]
          }
        });
        finalProductId = createProdRes.data?.productCreate?.product?.id;
      } else {
        await saleorFetch(`mutation Update($id:ID!,$input:ProductInput!){productUpdate(id:$id,input:$input){errors{field message}}}`, {
          id: finalProductId,
          input: {
            description: textToEditorJs(p.descriptionHtml || p.title),
            externalReference: p.id.split("/").pop(),
            metadata: [{ key: "brand", value: vendorName }]
          }
        });
      }
      if (!finalProductId) return;
      if (brandPageId && BRAND_ATTRIBUTE_ID) {
        await saleorFetch(`mutation UpdateProd($id:ID!,$input:ProductInput!){productUpdate(id:$id,input:$input){errors{field message}}}`, {
          id: finalProductId,
          input: { attributes: [{ id: BRAND_ATTRIBUTE_ID, reference: brandPageId }] }
        });
      }
      if (p.images?.edges?.[0]?.node?.url) {
        await processImage(finalProductId, p.images.edges[0].node.url, p.title);
      }
      const variants = p.variants?.edges || [];
      const existingVarData = await saleorFetch(`query GetVars($id:ID!){product(id:$id){variants{id sku}}}`, { id: finalProductId });
      const existingVariants = existingVarData.data?.product?.variants || [];
      if (existingVariants.length > 0) {
        await saleorFetch(`mutation BulkDelete($ids:[ID!]!){productVariantBulkDelete(ids:$ids){errors{field message}}}`, { ids: existingVariants.map((v) => v.id) });
      }
      for (const vEdge of variants) {
        const v = vEdge.node;
        const variantExternalRef = `${p.id.split("/").pop()}-${v.id.split("/").pop()}`;
        await saleorFetch(`mutation CreateVar($input:ProductVariantCreateInput!){productVariantCreate(input:$input){productVariant{id} errors{field message}}}`, {
          input: {
            product: finalProductId,
            sku: v.sku || variantExternalRef,
            // Use SKU if available, otherwise externalRef
            name: v.title || "Default",
            externalReference: variantExternalRef,
            attributes: [],
            trackInventory: true,
            stocks: targetWarehouseId ? [{ warehouse: targetWarehouseId, quantity: v.inventoryQuantity || 0 }] : []
          }
        });
      }
      const dateStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const channelListings = activeChannels.map((ch) => ({
        channelId: ch.id,
        isPublished: true,
        publicationDate: dateStr,
        isAvailableForPurchase: true,
        visibleInListings: true,
        availableForPurchaseAt: new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString()
      }));
      await saleorFetch(`mutation UpdChannel($id:ID!,$input:ProductChannelListingUpdateInput!){productChannelListingUpdate(id:$id,input:$input){errors{field}}}`, {
        id: finalProductId,
        input: { updateChannels: channelListings }
      });
      for (const vEdge of p.variants.edges) {
        const v = vEdge.node;
        const predictableSlug2 = `${p.id.split("/").pop()}-${v.id.split("/").pop()}`;
        const findVar = await saleorFetch(`query FindVar($s:String!){productVariant(externalReference:$s){id}}`, { s: predictableSlug2 });
        const variantId = findVar.data?.productVariant?.id;
        if (variantId) {
          const price = parseFloat(v.price || "0");
          if (price > 0) {
            const priceListings = activeChannels.map((ch) => ({
              channelId: ch.id,
              price,
              costPrice: parseFloat(v.compare_at_price || price.toString())
            }));
            await saleorFetch(`mutation UpdVarChan($id:ID!,$input:[ProductVariantChannelListingAddInput!]!){productVariantChannelListingUpdate(id:$id,input:$input){errors{field message}}}`, {
              id: variantId,
              input: priceListings
            });
          }
        }
      }
      if (finalProductId) {
        processedProductIds.push(finalProductId);
      }
    }));
    if (processedProductIds.length > 0) {
      await bulkTranslateProducts.trigger({ productIds: processedProductIds });
    }
    console.log(`✅ [${SYNC_VERSION}] Sync Complete for ${officialBrandName}`);
  }, "run")
});
export {
  shopifyProductSync
};
//# sourceMappingURL=shopify-products.mjs.map
