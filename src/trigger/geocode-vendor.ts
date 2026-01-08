import { task } from "@trigger.dev/sdk";
import { db } from "../db";
import { users } from "../db/schema";
import { geocodeAddress } from "../lib/geocoding";
import { eq } from "drizzle-orm";

export const geocodeVendorAddress = task({
  id: "geocode-vendor-address",
  run: async (payload: { userId: number }) => {
    // 1. Fetch vendor data
    const userResult = await db.select()
        .from(users)
        .where(eq(users.id, payload.userId))
        .limit(1);
    
    const user = userResult[0];

    if (!user) {
        console.error(`User with ID ${payload.userId} not found.`);
        return { success: false, error: "User not found" };
    }

    // 2. Prepare address for geocoding
    const address = {
      street: user.street || (user.warehouseAddress as any)?.street || "",
      city: user.city || (user.warehouseAddress as any)?.city || "",
      postalCode: user.postalCode || (user.warehouseAddress as any)?.zip || "",
      country: user.countryCode || (user.warehouseAddress as any)?.country || "",
    };

    if (!address.city || !address.country) {
        console.warn(`Insufficient address data for user ${payload.userId}.`);
        return { success: false, error: "Insufficient address data" };
    }

    // 3. Geocode (The logic in geocodeAddress already handles the 1s delay policy via retries)
    console.log(`Geocoding address for user ${payload.userId}: ${address.city}, ${address.country}`);
    const result = await geocodeAddress(address);

    if (result) {
      console.log(`Successfully geocoded: ${result.latitude}, ${result.longitude}`);
      
      // 4. Update coordinates in DB
      await db.update(users)
        .set({
          latitude: result.latitude,
          longitude: result.longitude,
          geocodedAt: new Date(),
          // Backfill structured columns if they were missing but used for geocoding
          street: user.street || address.street,
          city: user.city || address.city,
          postalCode: user.postalCode || address.postalCode,
          countryCode: user.countryCode || address.country
        })
        .where(eq(users.id, payload.userId));

      return { 
        success: true, 
        latitude: result.latitude, 
        longitude: result.longitude 
      };
    }

    console.error(`Geocoding failed for user ${payload.userId}.`);
    return { success: false, error: "Geocoding failed" };
  },
});
