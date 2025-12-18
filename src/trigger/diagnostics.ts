import { task } from "@trigger.dev/sdk";
import { db } from "../db";
import { integrations, users } from "../db/schema";
import { eq } from "drizzle-orm";
import { logDebug } from "../lib/utils";

export const diagnoseShopifyIntegration = task({
    id: "diagnose-shopify-integration",
    run: async (payload: { storeUrl: string, repair?: boolean }) => {
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
        const appUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://partner.salp.shop");
        const webhookUrl = `${appUrl}/api/webhooks/shopify-fulfillment`;
        const topic = "fulfillments/create";

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

            // 3. REPAIR MODE: Register if missing
            if (payload.repair && fulfillmentWebhooks.length === 0) {
                logDebug(`   🛠️ Repair Mode Active: Registering webhook to ${webhookUrl}`);
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
                    logDebug(`   ✅ Successfully registered webhook.`);
                    // Refresh the list for the final report
                    return {
                        status: "repaired",
                        registeredUrl: webhookUrl,
                        shopifyResponse: regJson
                    };
                } else {
                    logDebug(`   ❌ Failed to register webhook:`, JSON.stringify(regJson));
                    return { status: "failed", error: regJson };
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
                allTopics: webhooks.map((w: any) => w.topic),
                currentAppUrlEnv: process.env.APP_URL || "NOT SET",
                currentVercelUrlEnv: process.env.VERCEL_URL || "NOT SET",
                targetWebhookUrl: webhookUrl
            };

        } catch (e: any) {
            logDebug(`   ❌ Error fetching webhooks: ${e.message}`);
            return { error: e.message };
        }
    }
});
