import { task } from "@trigger.dev/sdk";
import { db } from "../db";
import { users } from "../db/schema";
import { geocodeAddress } from "../lib/geocoding";
import { eq } from "drizzle-orm";

const SALEOR_API_URL = process.env.SALEOR_API_URL || process.env.NEXT_PUBLIC_SALEOR_API_URL || 'https://api.salp.shop/graphql/';

async function discoverSlug(brandName: string) {
	console.log(`[DiscoverSlug] Searching for brand: "${brandName}"...`);
	if (!brandName) return null;
    const query = `
        query FindBrandPage($name: String!) {
            pages(first: 100) {
                edges {
                    node {
                        slug
                        title
                    }
                }
            }
        }
    `;
    
    try {
        const res = await fetch(SALEOR_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, variables: { name: brandName } })
        });
        const json = await res.json();
		console.log(`[DiscoverSlug] Raw Saleor Response for "${brandName}":`, JSON.stringify(json, null, 2));
		
		if (json.errors) {
			console.error(`[DiscoverSlug] GraphQL Errors:`, JSON.stringify(json.errors, null, 2));
		}

		const pages = json.data?.pages?.edges || [];
		console.log(`[DiscoverSlug] Total pages found in Saleor: ${pages.length}`);
		
        // Log all titles for debugging
        pages.forEach((p: any) => console.log(`   - Existing Page: "${p.node.title}" (slug: ${p.node.slug})`));

		// Find exact title match or fallback to first search result
		const match = pages.find((e: any) => e.node.title.toLowerCase() === brandName.toLowerCase());
		const slug = match?.node?.slug;

		if (slug) {
			console.log(`[DiscoverSlug] SUCCESS: Matched "${brandName}" to slug "${slug}"`);
		} else {
			console.log(`[DiscoverSlug] FAILURE: Could not find exact match for "${brandName}" in the list above.`);
		}
		return slug;
	} catch (e) {
		console.error(`[DiscoverSlug] CRITICAL ERROR:`, e);
		return null;
	}
}

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

    // 2. Discover Slug if missing
    let discoveredSlug = user.saleorPageSlug;
    if (!discoveredSlug) {
        console.log(`Attempting to discover slug for brand: ${user.brandName || user.brand}`);
        discoveredSlug = await discoverSlug(user.brandName || user.brand);
        if (discoveredSlug) {
            console.log(`Discovered slug: ${discoveredSlug}`);
        }
    }

    // 3. Prepare address for geocoding
    const address = {
      street: user.street || (user.warehouseAddress as any)?.street || "",
      city: user.city || (user.warehouseAddress as any)?.city || "",
      postalCode: user.postalCode || (user.warehouseAddress as any)?.zip || "",
      country: user.countryCode || (user.warehouseAddress as any)?.country || "",
    };

    if (!address.city || !address.country) {
        // Even if geocoding fails, we might have discovered the slug
        if (discoveredSlug && discoveredSlug !== user.saleorPageSlug) {
            await db.update(users).set({ saleorPageSlug: discoveredSlug }).where(eq(users.id, payload.userId));
        }
        console.warn(`Insufficient address data for user ${payload.userId}.`);
        return { success: !!discoveredSlug, error: "Insufficient address data" };
    }

    // 4. Geocode
    console.log(`[Geocode] Attempting resolution for: ${address.city}, ${address.country}`);
    const result = await geocodeAddress(address);

    if (result) {
      console.log(`[Geocode] SUCCESS: ${result.latitude}, ${result.longitude}`);
      
      // 5. Update coordinates and slug in DB
      const updatePayload = {
        latitude: result.latitude,
        longitude: result.longitude,
        geocodedAt: new Date(),
        saleorPageSlug: discoveredSlug,
        // Backfill structured columns if they were missing but used for geocoding
        street: user.street || address.street,
        city: user.city || address.city,
        postalCode: user.postalCode || address.postalCode,
        countryCode: user.countryCode || address.country
      };

      console.log("----------------------------------------------------------");
      console.log(`[DB-UPDATE] Payload for User ID ${payload.userId}:`);
      console.log(JSON.stringify(updatePayload, null, 2));
      console.log("----------------------------------------------------------");

      const updateResult = await db.update(users)
        .set(updatePayload)
        .where(eq(users.id, payload.userId))
        .returning();

      console.log(`✅ [DB-UPDATE] SUCCESS: Updated ${updateResult[0]?.brandName || updateResult[0]?.brand || user.brand}`);

      return { 
        success: true, 
        latitude: result.latitude, 
        longitude: result.longitude,
        slug: discoveredSlug,
        updatedRecord: updateResult[0]
      };
    }

    // Update slug even if geocoding fails
    if (discoveredSlug && discoveredSlug !== user.saleorPageSlug) {
        await db.update(users).set({ saleorPageSlug: discoveredSlug }).where(eq(users.id, payload.userId));
    }

    console.error(`Geocoding failed for user ${payload.userId}.`);
    return { success: !!discoveredSlug, error: "Geocoding failed" };
  },
});
