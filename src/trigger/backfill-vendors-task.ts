// eslint-disable-next-line no-restricted-imports
import { task } from "@trigger.dev/sdk/v3";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";
import { geocodeVendorAddress } from "./geocode-vendor";

/**
 * A maintenance task that can be triggered manually from the Trigger.dev dashboard.
 * It loops through all vendors and triggers the geocoding/slug discovery task for them.
 */
export const backfillAllVendors = task({
	id: "backfill-all-vendors",
	run: async () => {
		console.log("----------------------------------------------------------");
		console.log("STARTING BULK VENDOR BACKFILL");
		console.log("----------------------------------------------------------");
		console.log("🔍 Querying database for all vendors...");

		const vendors = await db.select().from(users).where(eq(users.role, "vendor"));

		console.log(`✅ Database Fetch Complete: Found ${vendors.length} vendors.`);

		let triggeredCount = 0;
		for (const vendor of vendors) {
			const brand = vendor.brandName || vendor.brand || "Unknown Brand";
			console.log(`[${triggeredCount + 1}/${vendors.length}] 🚀 Queuing: ${brand} (ID: ${vendor.id})`);
			
			try {
				await geocodeVendorAddress.trigger({ userId: vendor.id });
				triggeredCount++;
			} catch (err) {
				console.error(`❌ Failed to queue ${brand}:`, err);
			}
		}

		console.log("----------------------------------------------------------");
		console.log(`COMPLETED: ${triggeredCount} tasks triggered successfully.`);
		console.log("----------------------------------------------------------");

		return {
			success: true,
			vendorsFound: vendors.length,
			tasksTriggered: triggeredCount,
		};
	},
});
