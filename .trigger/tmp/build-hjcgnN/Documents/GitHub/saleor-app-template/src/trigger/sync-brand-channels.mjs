import {
  bulkTranslateProducts
} from "../../../../../chunk-VTDZGDM7.mjs";
import {
  db,
  eq,
  productOverrides,
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

// src/trigger/sync-brand-channels.ts
init_esm();
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
var syncBrandChannels = task({
  id: "sync-brand-channels",
  run: /* @__PURE__ */ __name(async (payload) => {
    const apiUrl = process.env.SALEOR_API_URL;
    let saleorToken = (process.env.SALEOR_APP_TOKEN || process.env.SALEOR_TOKEN || "").trim();
    if (!apiUrl || !saleorToken) throw new Error("Missing SALEOR_API_URL or SALEOR_TOKEN");
    saleorToken = `Bearer ${saleorToken.replace(/^bearer\s+/i, "")}`;
    const saleorFetch = /* @__PURE__ */ __name(async (query, variables = {}) => {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: { "Authorization": saleorToken, "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables })
      });
      return await res.json();
    }, "saleorFetch");
    const userData = await db.select().from(users).where(eq(users.brand, payload.brandName)).limit(1);
    const user = userData[0];
    if (!user) throw new Error(`Brand settings not found for: ${payload.brandName}`);
    const globalCountries = user.shippingCountries || [];
    console.log(`🔄 Syncing channels for ${payload.brandName}. Global countries: ${globalCountries.join(", ")}`);
    const channelsRes = await saleorFetch(`query { channels { id slug isActive } }`);
    const allChannels = (channelsRes.data?.channels || []).filter((c) => c.isActive);
    const channelSlugToId = new Map(allChannels.map((c) => [c.slug, c.id]));
    let hasNextPage = true;
    let endCursor = null;
    let totalCount = 0;
    const processedProductIds = [];
    while (hasNextPage) {
      const productsRes = await saleorFetch(`
                query GetProducts($brand: String!, $after: String) {
                    products(filter: { metadata: { key: "brand", value: $brand } }, first: 50, after: $after) {
                        pageInfo { hasNextPage endCursor }
                        edges {
                            node {
                                id
                                name
                                channelListings {
                                    channel { id slug }
                                }
                            }
                        }
                    }
                }
            `, { brand: payload.brandName, after: endCursor });
      const products = productsRes.data?.products?.edges || [];
      if (products.length === 0 && totalCount === 0) {
        console.log(`⚠️ No products found via Metadata. Attempting search by Brand Name: "${payload.brandName}"`);
      }
      hasNextPage = productsRes.data?.products?.pageInfo.hasNextPage;
      endCursor = productsRes.data?.products?.pageInfo.endCursor;
      for (const pEdge of products) {
        const p = pEdge.node;
        totalCount++;
        const override = await db.select().from(productOverrides).where(eq(productOverrides.productId, p.id)).limit(1);
        let targetCountries = override[0] ? override[0].shippingCountries : globalCountries;
        if (!targetCountries || targetCountries.length === 0) {
          targetCountries = Object.keys(COUNTRY_TO_CHANNEL);
        }
        const targetChannelSlugs = targetCountries.map((c) => COUNTRY_TO_CHANNEL[c]).filter(Boolean);
        const targetChannelIds = targetChannelSlugs.map((slug) => channelSlugToId.get(slug)).filter(Boolean);
        const currentChannelIds = p.channelListings.map((l) => l.channel.id);
        const toAdd = targetChannelIds.filter((id) => !currentChannelIds.includes(id));
        const toRemove = currentChannelIds.filter((id) => !targetChannelIds.includes(id));
        if (toAdd.length > 0 || toRemove.length > 0) {
          console.log(`   📦 Updating ${p.name}: +${toAdd.length} / -${toRemove.length} channels`);
          const updateChannels = toAdd.map((id) => ({
            channelId: id,
            isPublished: true,
            isAvailableForPurchase: true,
            visibleInListings: true
          }));
          await saleorFetch(`
                        mutation UpdateProductChannels($id: ID!, $input: ProductChannelListingUpdateInput!) {
                            productChannelListingUpdate(id: $id, input: $input) {
                                errors { field message }
                            }
                        }
                    `, {
            id: p.id,
            input: {
              updateChannels,
              removeChannels: toRemove
            }
          });
        }
        processedProductIds.push(p.id);
      }
    }
    if (processedProductIds.length > 0) {
      console.log(`📢 Triggering bulk translation for ${processedProductIds.length} products...`);
      await bulkTranslateProducts.trigger({ productIds: processedProductIds });
    }
    console.log(`✅ Finished syncing ${totalCount} products for ${payload.brandName}`);
  }, "run")
});
export {
  syncBrandChannels
};
//# sourceMappingURL=sync-brand-channels.mjs.map
