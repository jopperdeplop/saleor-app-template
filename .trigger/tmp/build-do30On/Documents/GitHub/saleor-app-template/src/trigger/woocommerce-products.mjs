import {
  decrypt
} from "../../../../../chunk-HVB7L227.mjs";
import {
  bulkTranslateProducts
} from "../../../../../chunk-QAHN6WAL.mjs";
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

// src/trigger/woocommerce-products.ts
init_esm();
var SYNC_VERSION = "LITERAL-CLONE-V13-WCFX";
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
var woocommerceProductSync = task({
  id: "woocommerce-product-sync",
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
    if (integration.provider !== "woocommerce") {
      console.warn(`⚠️ skipping: Not WooCommerce`);
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
    const settings = integration.settings;
    const consumerKey = integration.accessToken;
    let consumerSecret = "";
    if (settings?.consumerSecret) consumerSecret = decrypt(settings.consumerSecret);
    if (!consumerKey || !consumerSecret) throw new Error("Missing WC Credentials");
    const wcHeaders = {
      "Authorization": `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64")}`,
      "Content-Type": "application/json"
    };
    let storeName = new URL(integration.storeUrl).hostname;
    try {
      const storeRes = await fetch(`${integration.storeUrl}/wp-json/`, { headers: wcHeaders });
      if (storeRes.ok) {
        const storeData = await storeRes.json();
        if (storeData.name) storeName = storeData.name;
      }
    } catch (e) {
      console.warn("   ⚠️ store name fetch failed.");
    }
    console.log("   📡 Connecting to WooCommerce...");
    const wcRes = await fetch(`${integration.storeUrl}/wp-json/wc/v3/products?per_page=100`, { headers: wcHeaders });
    if (!wcRes.ok) throw new Error(`WC API Error: ${wcRes.status}`);
    const products = await wcRes.json();
    console.log(`   📦 Fetched ${products.length} products.`);
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
      const create = await saleorFetch(`mutation Create($n:String!,$t:ID!){pageCreate(input:{title:$n,pageType:$t,isPublished:true,content:"{}"}){page{id}}}`, { n: name, t: BRAND_MODEL_TYPE_ID });
      return create.data?.pageCreate?.page?.id;
    }, "getOrCreateBrandPage");
    const getOrCreateShippingZones = /* @__PURE__ */ __name(async () => {
      const find = await saleorFetch(`query { shippingZones(first:100) { edges { node { id name } } } }`);
      return find.data?.shippingZones?.edges?.map((e) => e.node) || [];
    }, "getOrCreateShippingZones");
    const getOrCreateWarehouse = /* @__PURE__ */ __name(async (vendorName, channels2) => {
      const slug = `vendor-${vendorName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
      const find = await saleorFetch(`query Find($s:String!){warehouses(filter:{search:$s},first:5){edges{node{id slug name}}}}`, { s: vendorName });
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
      let imageBlob = null;
      if (PHOTOROOM_API_KEY) {
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
              headers: { "x-api-key": PHOTOROOM_API_KEY },
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
    console.log(`   🏗️  Setting up context for ${uniqueVendors.length} unique vendors: ${uniqueVendors.join(", ")}`);
    for (const vendor of uniqueVendors) {
      const brandPageId = await getOrCreateBrandPage(vendor);
      let warehouseId = await getOrCreateWarehouse(vendor, channels);
      if (!warehouseId) warehouseId = DEFAULT_WAREHOUSE_ID;
      vendorContext.set(vendor, { brandPageId, warehouseId });
    }
    console.log(`📦 Parallel Sync for ${products.length} products...`);
    const processedProductIds = [];
    await Promise.all(products.map(async (p) => {
      const context = vendorContext.get(officialBrandName);
      const brandPageId = context?.brandPageId;
      const targetWarehouseId = context?.warehouseId;
      let finalProductId = null;
      const cleanTitle = p.name.trim();
      const predictableSlug = p.slug || cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      const slugCheck = await saleorFetch(`query FindSlug($s:String!){product(slug:$s){id}}`, { s: predictableSlug });
      finalProductId = slugCheck.data?.product?.id;
      if (!finalProductId) {
        const createProdRes = await saleorFetch(`mutation Create($input:ProductCreateInput!){productCreate(input:$input){product{id} errors{field message}}}`, {
          input: {
            name: p.name,
            slug: predictableSlug,
            externalReference: p.id.toString(),
            productType: PRODUCT_TYPE_ID,
            category: CATEGORY_ID,
            description: textToEditorJs(p.description || p.short_description || p.name),
            metadata: [{ key: "brand", value: officialBrandName }]
          }
        });
        finalProductId = createProdRes.data?.productCreate?.product?.id;
      } else {
        await saleorFetch(`mutation Update($id:ID!,$input:ProductInput!){productUpdate(id:$id,input:$input){errors{field message}}}`, {
          id: finalProductId,
          input: {
            description: textToEditorJs(p.description || p.short_description || p.name),
            externalReference: p.id.toString(),
            metadata: [{ key: "brand", value: officialBrandName }]
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
      if (p.images && p.images.length > 0) {
        await processImage(finalProductId, p.images[0].src, p.name);
      }
      let wcVariations = [];
      if (p.type === "variable") {
        const vRes = await fetch(`${integration.storeUrl}/wp-json/wc/v3/products/${p.id}/variations`, { headers: wcHeaders });
        if (vRes.ok) wcVariations = await vRes.json();
      } else {
        wcVariations = [{
          id: p.id,
          sku: p.sku || `WC-${p.id}`,
          price: p.price,
          manage_stock: p.manage_stock,
          stock_quantity: p.stock_quantity,
          stock_status: p.stock_status,
          attributes: []
        }];
      }
      const existingVarData = await saleorFetch(`query GetVars($id:ID!){product(id:$id){variants{id sku}}}`, { id: finalProductId });
      const existingVariants = existingVarData.data?.product?.variants || [];
      if (existingVariants.length > 0) {
        await saleorFetch(`mutation BulkDelete($ids:[ID!]!){productVariantBulkDelete(ids:$ids){errors{field message}}}`, { ids: existingVariants.map((v) => v.id) });
      }
      const variantsToProcess = [];
      for (const v of wcVariations) {
        const sku = v.sku || `WC-V-${v.id}`;
        let quantity = 0;
        if (v.manage_stock) quantity = v.stock_quantity || 0;
        else quantity = v.stock_status === "instock" ? 100 : 0;
        const predictableVariantRef = `${finalProductId}-${sku}`;
        const varRes = await saleorFetch(`mutation CreateVar($input:ProductVariantCreateInput!){productVariantCreate(input:$input){productVariant{id} errors{field message}}}`, {
          input: {
            product: finalProductId,
            sku,
            name: v.attributes?.map((a) => a.option || a.name).join(" / ") || "Default",
            externalReference: v.id.toString(),
            // Store numeric ID for fulfillment
            attributes: [],
            trackInventory: true,
            stocks: targetWarehouseId ? [{ warehouse: targetWarehouseId, quantity }] : []
          }
        });
        const variantId = varRes.data?.productVariantCreate?.productVariant?.id;
        if (variantId) {
          variantsToProcess.push({ id: variantId, price: v.price, regular_price: v.regular_price, predictableRef: predictableVariantRef });
        }
      }
      const dateStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const channelListings = activeChannels.map((ch) => ({
        channelId: ch.id,
        isPublished: p.status === "publish",
        publicationDate: dateStr,
        isAvailableForPurchase: true,
        visibleInListings: true,
        availableForPurchaseAt: new Date(Date.now() - 24 * 60 * 60 * 1e3).toISOString()
      }));
      await saleorFetch(`mutation UpdChannel($id:ID!,$input:ProductChannelListingUpdateInput!){productChannelListingUpdate(id:$id,input:$input){errors{field}}}`, {
        id: finalProductId,
        input: { updateChannels: channelListings }
      });
      for (const v of variantsToProcess) {
        const price = parseFloat(v.price || "0");
        if (price > 0) {
          const priceListings = activeChannels.map((ch) => ({
            channelId: ch.id,
            price,
            costPrice: parseFloat(v.regular_price || price.toString())
          }));
          await saleorFetch(`mutation UpdVarChan($id:ID!,$input:[ProductVariantChannelListingAddInput!]!){productVariantChannelListingUpdate(id:$id,input:$input){errors{field message}}}`, {
            id: v.id,
            input: priceListings
          });
        }
      }
      if (finalProductId) {
        processedProductIds.push(finalProductId);
      }
    }));
    if (processedProductIds.length > 0) {
      await bulkTranslateProducts.trigger({ productIds: processedProductIds });
    }
    console.log(`✅ [LITERAL-CLONE-V11-PRICEFIX] WooCommerce sync finished.`);
  }, "run")
});
export {
  woocommerceProductSync
};
//# sourceMappingURL=woocommerce-products.mjs.map
