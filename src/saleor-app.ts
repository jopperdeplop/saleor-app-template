import { APL } from "@saleor/app-sdk/APL";
import { SaleorApp } from "@saleor/app-sdk/saleor-app";
import { FileAPL } from "@saleor/app-sdk/APL/file";
import { UpstashAPL } from "@saleor/app-sdk/APL/upstash";
import { DrizzleAPL } from "./lib/db-apl";

/**
 * Persistently store Saleor auth data.
 * Priority: 1. Upstash 2. Database (Drizzle) 3. Local File (Dev only)
 */
export let apl: APL;

if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
  console.log("✅ UpstashAPL selected.");
  apl = new UpstashAPL({
    restURL: process.env.KV_REST_API_URL,
    restToken: process.env.KV_REST_API_TOKEN,
  });
} else if (process.env.DATABASE_URL) {
  console.log("✅ DrizzleAPL selected (Database).");
  apl = new DrizzleAPL();
} else {
  console.warn("⚠️ FileAPL selected (Non-persistent).");
  apl = new FileAPL();
}

export const saleorApp = new SaleorApp({
  apl,
});
