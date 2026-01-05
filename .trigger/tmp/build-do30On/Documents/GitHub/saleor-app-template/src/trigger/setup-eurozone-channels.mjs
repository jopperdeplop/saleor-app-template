import {
  task
} from "../../../../../chunk-ENJ6DR3G.mjs";
import "../../../../../chunk-DEKBIM76.mjs";
import {
  __name,
  init_esm
} from "../../../../../chunk-CEGEFIIW.mjs";

// src/trigger/setup-eurozone-channels.ts
init_esm();
var EUROZONE_COUNTRIES = [
  { name: "Austria", code: "AT", channel: "austria" },
  { name: "Belgium", code: "BE", channel: "belgium" },
  { name: "Croatia", code: "HR", channel: "croatia" },
  { name: "Cyprus", code: "CY", channel: "cyprus" },
  { name: "Estonia", code: "EE", channel: "estonia" },
  { name: "Finland", code: "FI", channel: "finland" },
  { name: "France", code: "FR", channel: "france" },
  { name: "Germany", code: "DE", channel: "germany" },
  { name: "Greece", code: "GR", channel: "greece" },
  { name: "Ireland", code: "IE", channel: "ireland" },
  { name: "Italy", code: "IT", channel: "italy" },
  { name: "Latvia", code: "LV", channel: "latvia" },
  { name: "Lithuania", code: "LT", channel: "lithuania" },
  { name: "Luxembourg", code: "LU", channel: "luxembourg" },
  { name: "Malta", code: "MT", channel: "malta" },
  { name: "Netherlands", code: "NL", channel: "netherlands" },
  { name: "Portugal", code: "PT", channel: "portugal" },
  { name: "Slovakia", code: "SK", channel: "slovakia" },
  { name: "Slovenia", code: "SI", channel: "slovenia" },
  { name: "Spain", code: "ES", channel: "spain" }
];
var setupEurozoneChannels = task({
  id: "setup-eurozone-channels",
  run: /* @__PURE__ */ __name(async () => {
    const apiUrl = process.env.SALEOR_API_URL;
    let saleorToken = (process.env.SALEOR_APP_TOKEN || process.env.SALEOR_TOKEN || "").trim();
    if (!apiUrl || !saleorToken) throw new Error("Missing SALEOR_API_URL or SALEOR_TOKEN");
    saleorToken = `Bearer ${saleorToken.replace(/^bearer\s+/i, "")}`;
    const saleorHeaders = {
      "Authorization": saleorToken,
      "Content-Type": "application/json"
    };
    const saleorFetch = /* @__PURE__ */ __name(async (query, variables = {}) => {
      const res = await fetch(apiUrl, {
        method: "POST",
        headers: saleorHeaders,
        body: JSON.stringify({ query, variables })
      });
      const json = await res.json();
      if (json.errors) {
        console.error("❌ Saleor Error:", JSON.stringify(json.errors));
      }
      return json;
    }, "saleorFetch");
    console.log("🚀 Starting Eurozone Channel Setup...");
    const existingChannelsRes = await saleorFetch(`query { channels { id slug } }`);
    const existingChannels = existingChannelsRes.data?.channels || [];
    const existingSlugs = new Set(existingChannels.map((c) => c.slug));
    for (const country of EUROZONE_COUNTRIES) {
      console.log(`--- Processing ${country.name} (${country.code}) ---`);
      let channelId;
      if (existingSlugs.has(country.channel)) {
        console.log(`✅ Channel '${country.channel}' already exists.`);
        channelId = existingChannels.find((c) => c.slug === country.channel).id;
      } else {
        console.log(`✨ Creating Channel: ${country.channel}`);
        const createRes = await saleorFetch(`
                    mutation CreateChannel($input: ChannelCreateInput!) {
                        channelCreate(input: $input) {
                            channel { id }
                            errors { field message }
                        }
                    }
                `, {
          input: {
            name: country.name,
            slug: country.channel,
            currencyCode: "EUR",
            isActive: true,
            defaultCountry: country.code
          }
        });
        channelId = createRes.data?.channelCreate?.channel?.id;
        if (!channelId) {
          console.error(`❌ Failed to create channel ${country.channel}`);
          continue;
        }
      }
      const zoneName = `Shipping ${country.name}`;
      const existingZoneRes = await saleorFetch(`query FindZone($n: String!) { shippingZones(filter: { search: $n }, first: 5) { edges { node { id name } } } }`, { n: zoneName });
      let zoneId = existingZoneRes.data?.shippingZones?.edges?.find((e) => e.node.name === zoneName)?.node?.id;
      if (zoneId) {
        console.log(`✅ Shipping Zone '${zoneName}' already exists.`);
      } else {
        console.log(`🚚 Creating Shipping Zone: ${zoneName}`);
        const createZoneRes = await saleorFetch(`
                    mutation CreateZone($input: ShippingZoneCreateInput!) {
                        shippingZoneCreate(input: $input) {
                            shippingZone { id }
                            errors { field message }
                        }
                    }
                `, {
          input: {
            name: zoneName,
            countries: [country.code],
            addChannels: [channelId]
          }
        });
        zoneId = createZoneRes.data?.shippingZoneCreate?.shippingZone?.id;
      }
      if (!zoneId) {
        console.error(`❌ Failed to create shipping zone for ${country.name}`);
        continue;
      }
      await saleorFetch(`
                mutation UpdateZone($id: ID!, $input: ShippingZoneUpdateInput!) {
                    shippingZoneUpdate(id: $id, input: $input) {
                        errors { field message }
                    }
                }
            `, {
        id: zoneId,
        input: { addChannels: [channelId] }
      });
      const zoneDetailsRes = await saleorFetch(`query GetZone($id: ID!) { shippingZone(id: $id) { shippingMethods { id name } } }`, { id: zoneId });
      const existingMethods = zoneDetailsRes.data?.shippingZone?.shippingMethods || [];
      if (existingMethods.length === 0) {
        console.log(`📦 Adding Standard Shipping Method to ${zoneName}`);
        const methodRes = await saleorFetch(`
                    mutation CreateMethod($input: ShippingPriceInput!) {
                        shippingPriceCreate(input: $input) {
                            shippingMethod { id }
                            errors { field message }
                        }
                    }
                `, {
          input: {
            name: "Standard Shipping",
            type: "PRICE",
            shippingZone: zoneId
          }
        });
        const methodId = methodRes.data?.shippingPriceCreate?.shippingMethod?.id;
        if (methodId) {
          console.log(`🔗 Linking Shipping Method to Channel: ${country.channel}`);
          await saleorFetch(`
                        mutation UpdateListing($id: ID!, $input: ShippingMethodChannelListingInput!) {
                            shippingMethodChannelListingUpdate(id: $id, input: $input) {
                                errors { field message }
                            }
                        }
                    `, {
            id: methodId,
            input: {
              addChannels: [{
                channelId,
                price: 0
              }]
            }
          });
        } else {
          console.error(`❌ Failed to create shipping method for ${zoneName}`);
        }
      } else {
        console.log(`✅ Shipping methods already exist for ${zoneName}.`);
      }
    }
    console.log("✅ Eurozone Channel Setup Complete!");
  }, "run")
});
export {
  setupEurozoneChannels
};
//# sourceMappingURL=setup-eurozone-channels.mjs.map
