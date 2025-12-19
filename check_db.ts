
import { db } from "./src/db";
import { integrations } from "./src/db/schema";
import { normalizeUrl } from "./src/lib/utils";
import { eq } from "drizzle-orm";

async function checkIntegrations() {
    const all = await db.select().from(integrations);
    console.log("Found Integrations:");
    for (const i of all) {
        console.log(`ID: ${i.id} | Store: ${i.storeUrl} | Has Secret: ${!!(i.settings as any)?.webhookSecret}`);
        const normalized = normalizeUrl(i.storeUrl);
        if (normalized !== i.storeUrl) {
            console.log(`   ⚠️ Normalizing ${i.storeUrl} -> ${normalized}`);
            await db.update(integrations).set({ storeUrl: normalized }).where(eq(integrations.id, i.id));
        }
    }
    process.exit(0);
}

checkIntegrations();
