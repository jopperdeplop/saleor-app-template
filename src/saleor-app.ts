import { APL } from "@saleor/app-sdk/APL";
import { SaleorApp } from "@saleor/app-sdk/saleor-app";
import { FileAPL } from "@saleor/app-sdk/APL/file";

/**
 * By default auth data are stored in the `.auth-data.json` (FileAPL).
 * For multi-tenant applications and deployments please use UpstashAPL.
 *
 * To read more about storing auth data, read the
 * [APL documentation](https://github.com/saleor/saleor-app-sdk/blob/main/docs/apl.md)
 */
import { UpstashAPL } from "@saleor/app-sdk/APL/upstash";

/**
 * By default auth data are stored in the `.auth-data.json` (FileAPL).
 * For multi-tenant applications and deployments please use UpstashAPL.
 *
 * To read more about storing auth data, read the
 * [APL documentation](https://github.com/saleor/saleor-app-sdk/blob/main/docs/apl.md)
 */
export let apl: APL;

if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
  console.log("✅ UpstashAPL selected. KV_REST_API_URL is found.");
  apl = new UpstashAPL({
    restURL: process.env.KV_REST_API_URL,
    restToken: process.env.KV_REST_API_TOKEN,
  });
} else {
  console.warn("⚠️ FileAPL selected. KV_REST_API_URL was NOT found.");
  console.log("Env check: URL exists?", !!process.env.KV_REST_API_URL, "Token exists?", !!process.env.KV_REST_API_TOKEN);
  apl = new FileAPL();
}

export const saleorApp = new SaleorApp({
  apl,
});
