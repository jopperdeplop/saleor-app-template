
import { db } from "./src/db";
import { integrations } from "./src/db/schema";
import { normalizeUrl } from "./src/lib/utils";
import { eq } from "drizzle-orm";

async function checkIntegrations() {
    try {
        const all = await db.select().from(integrations);
        console.log(`Found ${all.length} Integrations`);
        for (const i of all) {
            const secret = (i.settings as any)?.webhookSecret;
            console.log(`- ID: ${i.id}`);
            console.log(`  URL: "${i.storeUrl}"`);
            console.log(`  Normalized: "${normalizeUrl(i.storeUrl)}"`);
            console.log(`  Secret: ${secret ? secret.substring(0, 8) + "..." : "MISSING"}`);

            if (!secret) {
                console.log("  ⚠️ Secret is missing. Generating one now...");
                const newSecret = "temp_secret_" + Math.random().toString(36).substring(7);
                await db.update(integrations)
                    .set({ settings: { ...(i.settings as any || {}), webhookSecret: newSecret } })
                    .where(eq(integrations.id, i.id));
                console.log("  ✅ Generated and saved temp secret.");
            }
        }
    } catch (e) {
        console.error("Error checking DB:", e);
    }
    process.exit(0);
}

checkIntegrations();
