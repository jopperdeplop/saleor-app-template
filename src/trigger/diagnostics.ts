import { task } from "@trigger.dev/sdk";
import { db } from "../db";
import { integrations, users } from "../db/schema";
import { eq } from "drizzle-orm";
import { logDebug } from "../lib/utils";

export const diagnoseShopifyIntegration = task({
    id: "diagnose-shopify-integration",
    run: async (payload: { storeUrl: string }) => {
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

            const fulfillmentWebhooks = webhooks.filter((w: any) => w.topic === 'fulfillments/create');

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
                currentVercelUrlEnv: process.env.VERCEL_URL || "NOT SET"
            };

        } catch (e: any) {
            logDebug(`   ❌ Error fetching webhooks: ${e.message}`);
            return { error: e.message };
        }
    }
});
