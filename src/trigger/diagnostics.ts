import { task } from "@trigger.dev/sdk";
import { db } from "../db";
import { integrations, users } from "../db/schema";
import { eq } from "drizzle-orm";
import { logDebug } from "../lib/utils";

export const diagnoseShopifyIntegration = task({
    id: "diagnose-shopify-integration",
    run: async (payload: { storeUrl: string, repair?: boolean, forceUrl?: string }) => {
        logDebug(`🔍 Running Diagnostics for Shopify Store: ${payload.storeUrl}`);

        // 1. Fetch Integration from DB
        const integration = await db.select()
            .from(integrations)
            .where(eq(integrations.storeUrl, payload.storeUrl))
            .limit(1);

        if (!integration[0]) {
            return { error: `Store ${payload.storeUrl} not found in database.` };
        }

        const { accessToken, storeUrl } = integration[0];

        // ENV VAR DEBUG
        const envAppUrl = process.env.APP_URL;
        const envVercelUrl = process.env.VERCEL_URL;

        // Final URL selection
        const appUrl = payload.forceUrl || envAppUrl || (envVercelUrl ? `https://${envVercelUrl}` : "https://partner.salp.shop");
        const webhookUrl = `${appUrl}/api/webhooks/shopify-fulfillment`;
        const topic = "fulfillments/create";

        logDebug(`   💡 Diagnostic Info:`);
        logDebug(`      - APP_URL env: ${envAppUrl || "NOT SET"}`);
        logDebug(`      - VERCEL_URL env: ${envVercelUrl || "NOT SET"}`);
        logDebug(`      - Target URL: ${webhookUrl}`);

        // 2. Fetch Webhooks from Shopify
        try {
            const res = await fetch(`https://${storeUrl}/admin/api/2024-04/webhooks.json`, {
                headers: {
                    'X-Shopify-Access-Token': accessToken,
                    'Accept': 'application/json'
                }
            });

            const json: any = await res.json();
            const webhooks = json.webhooks || [];

            logDebug(`   📊 Found ${webhooks.length} webhooks in Shopify.`);

            let fulfillmentWebhooks = webhooks.filter((w: any) => w.topic === topic);

            // 3. REPAIR MODE: Register or UPDATE if incorrect
            if (payload.repair) {
                const needsRepair = fulfillmentWebhooks.length === 0 || fulfillmentWebhooks.some(w => w.address !== webhookUrl);

                if (needsRepair) {
                    logDebug(`   🛠️ Repair Mode: Fixing webhooks for ${webhookUrl}...`);

                    // Cleanup old ones first if topic exists but URL is wrong
                    for (const w of fulfillmentWebhooks) {
                        if (w.address !== webhookUrl) {
                            logDebug(`      🗑️ Removing incorrect webhook: ${w.address}`);
                            await fetch(`https://${storeUrl}/admin/api/2024-04/webhooks/${w.id}.json`, {
                                method: 'DELETE',
                                headers: { 'X-Shopify-Access-Token': accessToken }
                            });
                        }
                    }

                    // Register new
                    const regRes = await fetch(`https://${storeUrl}/admin/api/2024-04/webhooks.json`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Shopify-Access-Token': accessToken
                        },
                        body: JSON.stringify({
                            webhook: {
                                topic: topic,
                                address: webhookUrl,
                                format: "json",
                                fields: ["order_id", "tracking_number", "tracking_urls"]
                            }
                        })
                    });

                    const regJson: any = await regRes.json();
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
                fulfillmentWebhooks: fulfillmentWebhooks.map((w: any) => ({
                    id: w.id,
                    address: w.address,
                    topic: w.topic
                })),
                currentEnvironment: {
                    APP_URL: envAppUrl || "MISSING",
                    VERCEL_URL: envVercelUrl || "MISSING",
                    RESOLVED_URL: appUrl
                },
                recommendation: fulfillmentWebhooks.some(w => w.address.includes('partner.salp.shop'))
                    ? "Your webhook is currently pointing to the WRONG domain. Run with repair:true and ensure forceUrl is set or APP_URL is fixed."
                    : "Looks good if the RESOLVED_URL matches your Vercel address."
            };

        } catch (e: any) {
            logDebug(`   ❌ Error: ${e.message}`);
            return { error: e.message };
        }
    }
});
