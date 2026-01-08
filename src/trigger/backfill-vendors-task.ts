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
		console.log("🔍 Fetching all vendors for production backfill...");

		const vendors = await db.select().from(users).where(eq(users.role, "vendor"));

		console.log(`Found ${vendors.length} vendors to process.`);

		let triggeredCount = 0;
		for (const vendor of vendors) {
			console.log(`🚀 Triggering geocoding for: ${vendor.brandName || vendor.brand} (ID: ${vendor.id})`);
			
            // We use trigger to run them in parallel/background
			await geocodeVendorAddress.trigger({ userId: vendor.id });
			triggeredCount++;
		}

		return {
			success: true,
			vendorsProcessed: vendors.length,
			tasksTriggered: triggeredCount,
		};
	},
});
