import {
  db,
  eq,
  integrations
} from "../../../../../chunk-DZ7OZDGX.mjs";
import {
  task
} from "../../../../../chunk-ONHLK5E6.mjs";
import "../../../../../chunk-YV5CNPDY.mjs";
import {
  __name,
  init_esm
} from "../../../../../chunk-TQ3WNEB5.mjs";

// src/trigger/shopify-products.ts
init_esm();
var BRAND_MODEL_TYPE_ID = process.env.SALEOR_BRAND_MODEL_TYPE_ID;
var BRAND_ATTRIBUTE_ID = process.env.SALEOR_BRAND_ATTRIBUTE_ID;
var PRODUCT_TYPE_ID = process.env.SALEOR_PRODUCT_TYPE_ID;
var CATEGORY_ID = process.env.SALEOR_CATEGORY_ID;
var DEFAULT_WAREHOUSE_ID = process.env.SALEOR_WAREHOUSE_ID;
var PHOTOROOM_API_KEY = process.env.PHOTOROOM_API_KEY;
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
    const integration = await db.query.integrations.findFirst({ where: eq(integrations.id, payload.integrationId) });
    if (!integration) throw new Error("Integration not found");
    if (integration.provider !== "shopify") {
      console.warn(`⚠️ skipping: Integration ${payload.integrationId} is not Shopify (provider: ${integration.provider})`);
      return;
    }
    const apiUrl = process.env.SALEOR_API_URL;
    let saleorToken = (process.env.SALEOR_APP_TOKEN || process.env.SALEOR_TOKEN || "").trim();
    if (saleorToken) {
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
        if (!res.ok) {
          console.error(`   ❌ Saleor HTTP ${res.status}:`, await res.text());
          return {};
        }
        const json = await res.json();
        if (json.errors) {
          console.error("   ❌ Saleor Error:", JSON.stringify(json.errors[0]?.message || json.errors));
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
      return json.data?.channels || [];
    }, "getSaleorChannels");
    const getOrCreateBrandPage = /* @__PURE__ */ __name(async (name) => {
      if (!name) return null;
      const find = await saleorFetch(`query Find($n:String!){pages(filter:{search:$n},first:1){edges{node{id title isPublished}}}}`, { n: name });
      const existing = find.data?.pages?.edges?.[0]?.node;
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
    const getOrCreateShippingZone = /* @__PURE__ */ __name(async (name) => {
      const find = await saleorFetch(`query Find($s:String!){shippingZones(filter:{search:$s},first:1){edges{node{id}}}}`, { s: name });
      if (find.data?.shippingZones?.edges?.[0]) return find.data.shippingZones.edges[0].node.id;
      console.log(`   🚚 Creating Shipping Zone: "${name}"`);
      const countries = ["DE", "FR", "GB", "IT", "ES", "PL", "NL", "BE", "AT", "PT", "SE", "DK", "FI", "NO", "IE", "US", "CA"];
      const create = await saleorFetch(`mutation CreateZone($input:ShippingZoneCreateInput!){shippingZoneCreate(input:$input){shippingZone{id} errors{message}}}`, {
        input: { name, countries }
      });
      return create.data?.shippingZoneCreate?.shippingZone?.id;
    }, "getOrCreateShippingZone");
    const getOrCreateWarehouse = /* @__PURE__ */ __name(async (vendorName, channels2) => {
      const slug = `vendor-${vendorName.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
      const find = await saleorFetch(`query Find($s:String!){warehouses(filter:{search:$s},first:1){edges{node{id slug}}}}`, { s: vendorName });
      const existing = find.data?.warehouses?.edges?.[0]?.node;
      if (existing) return existing.id;
      console.log(`   🏭 Creating Warehouse for: "${vendorName}"`);
      const createRes = await saleorFetch(`mutation CreateWarehouse($input:WarehouseCreateInput!){warehouseCreate(input:$input){warehouse{id} errors{field message code}}}`, {
        input: {
          name: `${vendorName} Warehouse`,
          slug,
          address: DEFAULT_VENDOR_ADDRESS,
          email: "vendor@example.com"
        }
      });
      const result = createRes.data?.warehouseCreate;
      if (result?.errors?.length > 0) {
        if (result.errors.some((e) => e.field === "slug")) {
          const slugSearch = await saleorFetch(`query FindS($s:String!){warehouses(filter:{search:$s},first:5){edges{node{id slug}}}}`, { s: slug });
          const found = slugSearch.data?.warehouses?.edges?.find((e) => e.node.slug === slug)?.node;
          if (found) return found.id;
        }
        console.error("   ⚠️ Warehouse Creation Failed:", JSON.stringify(result.errors));
        return null;
      }
      const newId = result?.warehouse?.id;
      if (newId) {
        for (const ch of channels2) {
          await saleorFetch(`mutation UpdCh($id:ID!,$input:ChannelUpdateInput!){channelUpdate(id:$id,input:$input){errors{field}}}`, { id: ch.id, input: { addWarehouses: [newId] } });
        }
        const zoneId = await getOrCreateShippingZone("Europe");
        if (zoneId) {
          await saleorFetch(`mutation UpdZone($id:ID!,$input:ShippingZoneUpdateInput!){shippingZoneUpdate(id:$id,input:$input){errors{field}}}`, { id: zoneId, input: { addWarehouses: [newId] } });
        }
      }
      return newId;
    }, "getOrCreateWarehouse");
    async function processImage(productId, imageUrl, title) {
      console.log("      🎨 Managing Product Media...");
      const mediaRes = await saleorFetch(`query GetMedia($id:ID!){product(id:$id){media{id}}}`, { id: productId });
      const existingMedia = mediaRes.data?.product?.media || [];
      if (existingMedia.length > 0) {
        console.log(`      🧹 Deleting ${existingMedia.length} existing images to replace...`);
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
            if (prRes.ok) {
              imageBlob = await prRes.blob();
              console.log("      ✨ Photoroom processed successfully.");
            }
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
        const upRes = await fetch(apiUrl, { method: "POST", headers: { "Authorization": saleorToken }, body: fd });
        const upJson = await upRes.json();
        if (upJson.data?.productMediaCreate?.errors?.length > 0) {
          console.error("      ❌ Media Multipart Upload Failed:", JSON.stringify(upJson.data.productMediaCreate.errors));
        } else {
          console.log("      ✅ Image replaced via Photoroom Blob.");
        }
      } else {
        console.log("      ℹ️ Photoroom skipped/failed. Falling back to original URL upload...");
        const res = await saleorFetch(`mutation AddMedia($id: ID!, $url: String!, $alt: String) { productMediaCreate(input: { product: $id, mediaUrl: $url, alt: $alt }) { media { id } errors { field message } } }`, {
          id: productId,
          url: imageUrl,
          alt: title
        });
        if (res.data?.productMediaCreate?.errors?.length > 0) {
          console.error("      ❌ Media URL Fallback Failed:", JSON.stringify(res.data.productMediaCreate.errors));
        } else {
          console.log("      ✅ Image replaced via URL.");
        }
      }
    }
    __name(processImage, "processImage");
    const channels = await getSaleorChannels();
    if (channels.length === 0) {
      console.error("❌ No Channels found.");
      return;
    }
    console.log(`📦 Parallel Sync for ${products.length} products...`);
    await Promise.all(products.map(async (edge) => {
      const p = edge.node;
      const brandPageId = await getOrCreateBrandPage(p.vendor);
      let targetWarehouseId = await getOrCreateWarehouse(p.vendor, channels);
      if (!targetWarehouseId) targetWarehouseId = DEFAULT_WAREHOUSE_ID;
      let finalProductId = null;
      const cleanTitle = p.title.trim();
      const predictableSlug = cleanTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
      const slugCheck = await saleorFetch(`query FindSlug($s:String!){product(slug:$s){id}}`, { s: predictableSlug });
      finalProductId = slugCheck.data?.product?.id;
      if (!finalProductId) {
        const searchRes = await saleorFetch(`query FindName($n:String!){products(filter:{search:$n},first:5){edges{node{id name}}}}`, { n: cleanTitle });
        const foundItems = searchRes.data?.products?.edges || [];
        for (const item of foundItems) {
          if (item.node.name?.trim() === cleanTitle) {
            finalProductId = item.node.id;
            break;
          }
        }
      }
      if (finalProductId) {
        console.log(`✨ Syncing existing: "${cleanTitle}" (${finalProductId})`);
      } else {
        console.log(`➕ Creating new: "${cleanTitle}" (Slug: ${predictableSlug})`);
      }
      if (!finalProductId) {
        const createProdRes = await saleorFetch(`mutation Create($input:ProductCreateInput!){productCreate(input:$input){product{id} errors{field message}}}`, {
          input: {
            name: p.title,
            slug: predictableSlug,
            externalReference: p.id,
            productType: PRODUCT_TYPE_ID,
            category: CATEGORY_ID,
            description: textToEditorJs(p.descriptionHtml || p.title)
          }
        });
        finalProductId = createProdRes.data?.productCreate?.product?.id;
      } else {
        await saleorFetch(`mutation Update($id:ID!,$input:ProductInput!){productUpdate(id:$id,input:$input){errors{field message}}}`, {
          id: finalProductId,
          input: {
            description: textToEditorJs(p.descriptionHtml || p.title),
            externalReference: p.id
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
      const dateStr = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const channelListings = channels.map((ch) => ({
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
      const imgUrl = p.images?.edges?.[0]?.node?.url;
      if (imgUrl) {
        await processImage(finalProductId, imgUrl, p.title);
      }
      const existingVarData = await saleorFetch(`query GetVars($id:ID!){product(id:$id){variants{id sku}}}`, { id: finalProductId });
      const existingVariants = existingVarData.data?.product?.variants || [];
      if (existingVariants.length > 0) {
        console.log(`      🧹 Deleting ${existingVariants.length} existing variants for replacement...`);
        const varIdsToDelete = existingVariants.map((v) => v.id);
        await saleorFetch(`mutation BulkDelete($ids:[ID!]!){productVariantBulkDelete(ids:$ids){errors{field message}}}`, { ids: varIdsToDelete });
      }
      for (const vEdge of p.variants.edges) {
        const v = vEdge.node;
        const shopifyNumericId = v.id.split("/").pop();
        const sku = shopifyNumericId || `VAR-${Math.random().toString(36).substring(7)}`;
        const varRes = await saleorFetch(`mutation CreateVar($input:ProductVariantCreateInput!){productVariantCreate(input:$input){productVariant{id} errors{field message}}}`, {
          input: {
            product: finalProductId,
            sku,
            name: v.title || "Default",
            externalReference: v.id,
            attributes: [],
            trackInventory: true,
            stocks: targetWarehouseId ? [{ warehouse: targetWarehouseId, quantity: v.inventoryQuantity }] : []
          }
        });
        const variantId = varRes.data?.productVariantCreate?.productVariant?.id;
        if (variantId) {
          const shopifyPrice = parseFloat(v.price || "0");
          const priceListings = channels.map((ch) => ({
            channelId: ch.id,
            price: shopifyPrice,
            costPrice: shopifyPrice
          }));
          await saleorFetch(`mutation UpdatePrice($id:ID!,$input:[ProductVariantChannelListingAddInput!]!){productVariantChannelListingUpdate(id:$id,input:$input){errors{field}}}`, {
            id: variantId,
            input: priceListings
          });
        }
      }
    }));
    console.log(`✅ ${products.length} products synced successfully.`);
  }, "run")
});
export {
  shopifyProductSync
};
//# sourceMappingURL=shopify-products.mjs.map
