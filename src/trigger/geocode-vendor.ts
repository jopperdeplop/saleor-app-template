import { task } from "@trigger.dev/sdk";
import { db } from "../db";
import { users } from "../db/schema";
import { geocodeAddress } from "../lib/geocoding";
import { eq } from "drizzle-orm";

const SALEOR_API_URL = process.env.SALEOR_API_URL || process.env.NEXT_PUBLIC_SALEOR_API_URL || 'https://api.salp.shop/graphql/';

/**
 * Discovers the Saleor page slug for a brand by searching all pages.
 */
async function discoverSlug(brandName: string): Promise<string | null> {
	if (!brandName) return null;
    
    const query = `
        query FindBrandPage {
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
            body: JSON.stringify({ query })
        });
        const json = await res.json();
		
		const pages = json.data?.pages?.edges || [];
		const match = pages.find((e: any) => e.node.title.toLowerCase() === brandName.toLowerCase());
		
		return match?.node?.slug || null;
	} catch (e) {
		console.error(`Failed to discover slug for ${brandName}:`, e);
		return null;
	}
}

/**
 * Geocodes a vendor's address and updates their database record with coordinates.
 * Also attempts to discover and link the vendor's Saleor page slug.
 */
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
        return { success: false, error: "User not found" };
    }

    // 2. Discover Slug if missing
    let discoveredSlug = user.saleorPageSlug;
    if (!discoveredSlug) {
        discoveredSlug = await discoverSlug(user.brandName || user.brand);
    }

    // 3. Prepare address for geocoding
    const address = {
      street: user.street || "",
      city: user.city || "",
      postalCode: user.postalCode || "",
      country: user.countryCode || "",
    };

    if (!address.city || !address.country) {
        // Update slug even if geocoding can't proceed
        if (discoveredSlug && discoveredSlug !== user.saleorPageSlug) {
            await db.update(users).set({ saleorPageSlug: discoveredSlug }).where(eq(users.id, payload.userId));
        }
        return { success: !!discoveredSlug, error: "Insufficient address data" };
    }

    // 4. Geocode
    const result = await geocodeAddress(address);

    if (result) {
      // 5. Update coordinates and slug in DB
      const updatePayload = {
        latitude: result.latitude,
        longitude: result.longitude,
        geocodedAt: new Date(),
        saleorPageSlug: discoveredSlug,
        street: user.street || address.street,
        city: user.city || address.city,
        postalCode: user.postalCode || address.postalCode,
        countryCode: user.countryCode || address.country
      };

      await db.update(users)
        .set(updatePayload)
        .where(eq(users.id, payload.userId));

      return { 
        success: true, 
        latitude: result.latitude, 
        longitude: result.longitude,
        slug: discoveredSlug
      };
    }

    // Update slug even if geocoding fails
    if (discoveredSlug && discoveredSlug !== user.saleorPageSlug) {
        await db.update(users).set({ saleorPageSlug: discoveredSlug }).where(eq(users.id, payload.userId));
    }

    return { success: !!discoveredSlug, error: "Geocoding failed" };
  },
});
