import {
  db,
  eq,
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

// src/trigger/auto-assign-product-channels.ts
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
var autoAssignProductChannels = task({
  id: "auto-assign-product-channels",
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
    console.log(`🚀 Auto-assigning channels for Product: ${payload.productId} (Brand: ${payload.brand})`);
    const userData = await db.select().from(users).where(eq(users.brand, payload.brand)).limit(1);
    const user = userData[0];
    if (!user) {
      console.warn(`⚠️ Brand settings not found for: ${payload.brand}. Skipping auto-assignment.`);
      return;
    }
    let targetCountries = user.shippingCountries || [];
    if (targetCountries.length === 0) {
      targetCountries = Object.keys(COUNTRY_TO_CHANNEL);
    }
    const channelsRes = await saleorFetch(`query { channels { id slug isActive } }`);
    const allChannels = (channelsRes.data?.channels || []).filter((c) => c.isActive);
    const channelSlugToId = new Map(allChannels.map((c) => [c.slug, c.id]));
    const targetChannelSlugs = targetCountries.map((c) => COUNTRY_TO_CHANNEL[c]).filter(Boolean);
    const targetChannelIds = targetChannelSlugs.map((slug) => channelSlugToId.get(slug)).filter(Boolean);
    if (targetChannelIds.length === 0) {
      console.warn(`⚠️ No valid channels found for countries: ${targetCountries.join(", ")}`);
      return;
    }
    const updateChannels = targetChannelIds.map((id) => ({
      channelId: id,
      isPublished: true,
      isAvailableForPurchase: true,
      visibleInListings: true
    }));
    console.log(`📦 Assigning to ${targetChannelIds.length} channels...`);
    const result = await saleorFetch(`
            mutation UpdateProductChannels($id: ID!, $input: ProductChannelListingUpdateInput!) {
                productChannelListingUpdate(id: $id, input: $input) {
                    errors { field message }
                }
            }
        `, {
      id: payload.productId,
      input: {
        updateChannels
      }
    });
    if (result.data?.productChannelListingUpdate?.errors?.length > 0) {
      console.error(`❌ Failed to assign channels:`, JSON.stringify(result.data.productChannelListingUpdate.errors));
    } else {
      console.log(`✅ Successfully assigned channels.`);
    }
  }, "run")
});
export {
  autoAssignProductChannels
};
//# sourceMappingURL=auto-assign-product-channels.mjs.map
