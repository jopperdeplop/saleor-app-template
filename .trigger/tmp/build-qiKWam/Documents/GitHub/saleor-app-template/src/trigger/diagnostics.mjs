import {
  logDebug
} from "../../../../../chunk-JUBDIEYX.mjs";
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

// src/trigger/diagnostics.ts
init_esm();
var diagnoseShopifyIntegration = task({
  id: "diagnose-shopify-integration",
  run: /* @__PURE__ */ __name(async (payload) => {
    logDebug(`🔍 Running Diagnostics for Shopify Store: ${payload.storeUrl}`);
    const integration = await db.select().from(integrations).where(eq(integrations.storeUrl, payload.storeUrl)).limit(1);
    if (!integration[0]) {
      return { error: `Store ${payload.storeUrl} not found in database.` };
    }
    const { accessToken, storeUrl } = integration[0];
    const envAppUrl = process.env.APP_URL;
    const envVercelUrl = process.env.VERCEL_URL;
    const appUrl = payload.forceUrl || envAppUrl || (envVercelUrl ? `https://${envVercelUrl}` : "https://partner.salp.shop");
    const webhookUrl = `${appUrl}/api/webhooks/shopify-fulfillment`;
    const topic = "fulfillments/create";
    logDebug(`   💡 Diagnostic Info:`);
    logDebug(`      - APP_URL env: ${envAppUrl || "NOT SET"}`);
    logDebug(`      - VERCEL_URL env: ${envVercelUrl || "NOT SET"}`);
    logDebug(`      - Target URL: ${webhookUrl}`);
    try {
      const res = await fetch(`https://${storeUrl}/admin/api/2024-04/webhooks.json`, {
        headers: {
          "X-Shopify-Access-Token": accessToken,
          "Accept": "application/json"
        }
      });
      const json = await res.json();
      const webhooks = json.webhooks || [];
      logDebug(`   📊 Found ${webhooks.length} webhooks in Shopify.`);
      let fulfillmentWebhooks = webhooks.filter((w) => w.topic === topic);
      if (payload.repair) {
        const needsRepair = fulfillmentWebhooks.length === 0 || fulfillmentWebhooks.some((w) => w.address !== webhookUrl);
        if (needsRepair) {
          logDebug(`   🛠️ Repair Mode: Fixing webhooks for ${webhookUrl}...`);
          for (const w of fulfillmentWebhooks) {
            if (w.address !== webhookUrl) {
              logDebug(`      🗑️ Removing incorrect webhook: ${w.address}`);
              await fetch(`https://${storeUrl}/admin/api/2024-04/webhooks/${w.id}.json`, {
                method: "DELETE",
                headers: { "X-Shopify-Access-Token": accessToken }
              });
            }
          }
          const regRes = await fetch(`https://${storeUrl}/admin/api/2024-04/webhooks.json`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": accessToken
            },
            body: JSON.stringify({
              webhook: {
                topic,
                address: webhookUrl,
                format: "json",
                fields: ["order_id", "tracking_number", "tracking_urls"]
              }
            })
          });
          const regJson = await regRes.json();
          if (regRes.ok) {
            logDebug(`   ✅ Successfully registered webhook to: ${webhookUrl}`);
            return {
              status: "repaired",
              finalUrl: webhookUrl,
              details: "Existing incorrect webhooks were removed and replaced."
            };
          } else {
            logDebug(`   ❌ Registration Failed:`, JSON.stringify(regJson));
            return { status: "failed", error: regJson, suggestedAppUrl: appUrl };
          }
        } else {
          logDebug(`   ✨ Webhook is already correctly pointing to: ${webhookUrl}`);
        }
      }
      return {
        storeUrl,
        totalWebhooks: webhooks.length,
        fulfillmentWebhooks: fulfillmentWebhooks.map((w) => ({
          id: w.id,
          address: w.address,
          topic: w.topic
        })),
        currentEnvironment: {
          APP_URL: envAppUrl || "MISSING",
          VERCEL_URL: envVercelUrl || "MISSING",
          RESOLVED_URL: appUrl
        },
        recommendation: fulfillmentWebhooks.some((w) => w.address.includes("partner.salp.shop")) ? "Your webhook is currently pointing to the WRONG domain. Run with repair:true and ensure forceUrl is set or APP_URL is fixed." : "Looks good if the RESOLVED_URL matches your Vercel address."
      };
    } catch (e) {
      logDebug(`   ❌ Error: ${e.message}`);
      return { error: e.message };
    }
  }, "run")
});
export {
  diagnoseShopifyIntegration
};
//# sourceMappingURL=diagnostics.mjs.map
