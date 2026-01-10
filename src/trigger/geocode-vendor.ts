import { task } from "@trigger.dev/sdk";
import { db } from "../db";
import { users } from "../db/schema";
import { geocodeAddress } from "../lib/geocoding";
import { eq } from "drizzle-orm";

const SALEOR_API_URL = process.env.SALEOR_API_URL || process.env.NEXT_PUBLIC_SALEOR_API_URL || 'https://api.salp.shop/graphql/';
const BRAND_MODEL_TYPE_ID = process.env.SALEOR_BRAND_MODEL_TYPE_ID;
let SALEOR_TOKEN = (process.env.SALEOR_APP_TOKEN || process.env.SALEOR_TOKEN || "").trim();
if (SALEOR_TOKEN && !SALEOR_TOKEN.startsWith('Bearer ')) {
    SALEOR_TOKEN = `Bearer ${SALEOR_TOKEN}`;
}

const PAYLOAD_API_URL = process.env.PAYLOAD_API_URL || 'https://payload-saleor-payload.vercel.app/api';
const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY || '';

if (PAYLOAD_API_KEY) {
    console.log(`PAYLOAD_API_KEY detected: ${PAYLOAD_API_KEY.substring(0, 4)}...${PAYLOAD_API_KEY.substring(PAYLOAD_API_KEY.length - 4)}`);
} else {
    console.warn('PAYLOAD_API_KEY is MISSING in environment variables');
}

/**
 * Creates a brand page in PayloadCMS and returns its ID.
 */
async function createPayloadBrandPage(data: {
    vendorId: number;
    saleorPageSlug: string;
    brandName: string;
}): Promise<string | null> {
    if (!PAYLOAD_API_URL || !PAYLOAD_API_KEY) {
        console.warn('Missing PayloadCMS configuration');
        return null;
    }
    
    try {
        const payloadBody = {
            vendorId: String(data.vendorId),
            saleorPageSlug: data.saleorPageSlug,
            brandName: data.brandName,
            layout: [
                {
                    blockType: 'brand-hero',
                    tagline: `Welcome to ${data.brandName}`,
                },
                {
                    blockType: 'brand-about',
                    heading: 'About Us',
                    story: 'Welcome to our brand page. We are excited to share our story with you.',
                },
            ],
        };

        console.log(`Sending request to PayloadCMS: ${PAYLOAD_API_URL}/brand-page?locale=en`);
        console.log('Payload Body:', JSON.stringify(payloadBody, null, 2));

        const res = await fetch(`${PAYLOAD_API_URL}/brand-page?locale=en`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-payload-api-key': PAYLOAD_API_KEY,
            },
            body: JSON.stringify(payloadBody),
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.error(`PayloadCMS Error Status: ${res.status} ${res.statusText}`);
            console.error('PayloadCMS Error Body:', errorText);
            return null;
        }

        const result = await res.json();
        console.log(`Created PayloadCMS brand page: ${result.doc?.id}`);
        return result.doc?.id || null;
    } catch (e) {
        console.error('Failed to create PayloadCMS brand page:', e);
        return null;
    }
}

/**
 * Ensures a Brand Page exists in Saleor and returns its slug.
 * If not found, creates a new one.
 */
async function getOrCreateBrandPageSlug(brandName: string): Promise<string | null> {
    if (!brandName || !SALEOR_TOKEN || !BRAND_MODEL_TYPE_ID) {
        console.warn('Missing requirements for Brand Page creation:', { brandName, hasToken: !!SALEOR_TOKEN, hasTypeId: !!BRAND_MODEL_TYPE_ID });
        return null;
    }

    const saleorFetch = async (query: string, variables: any = {}) => {
        const res = await fetch(SALEOR_API_URL, {
            method: 'POST',
            headers: { 
                'Authorization': SALEOR_TOKEN, 
                'Content-Type': 'application/json' 
            },
            body: JSON.stringify({ query, variables })
        });
        return await res.json();
    };

    try {
        // 1. Check for existing page
        const findRes = await saleorFetch(`
            query FindBrandPage($search: String!) {
                pages(filter: { search: $search }, first: 10) {
                    edges {
                        node {
                            slug
                            title
                            isPublished
                        }
                    }
                }
            }
        `, { search: brandName });

        const existing = findRes.data?.pages?.edges?.find((e: any) => e.node.title.toLowerCase() === brandName.toLowerCase())?.node;

        if (existing) {
            console.log(`Found existing Brand Page: ${existing.slug}`);
            return existing.slug;
        }

        // 2. Create new page if not found
        console.log(`Creating new Brand Page for: ${brandName}`);
        const createRes = await saleorFetch(`
            mutation CreateBrandPage($input: PageCreateInput!) {
                pageCreate(input: $input) {
                    page {
                        id
                        slug
                    }
                    errors {
                        field
                        message
                    }
                }
            }
        `, {
            input: {
                title: brandName,
                pageType: BRAND_MODEL_TYPE_ID,
                isPublished: true,
                content: JSON.stringify({
                    time: Date.now(),
                    blocks: [{ type: "paragraph", data: { text: `Welcome to the official ${brandName} brand page.` } }],
                    version: "2.25.0"
                })
            }
        });

        const newPage = createRes.data?.pageCreate?.page;
        if (newPage?.slug) {
            console.log(`Successfully created Brand Page: ${newPage.slug}`);
            return newPage.slug;
        }

        if (createRes.data?.pageCreate?.errors?.length > 0) {
            console.error('Saleor errors creating brand page:', createRes.data.pageCreate.errors);
        }

        return null;
    } catch (e) {
        console.error(`Failed to get/create brand page for ${brandName}:`, e);
        return null;
    }
}

/**
 * Geocodes a vendor's address and updates their database record with coordinates.
 * Also automates the creation of their Saleor brand page, PayloadCMS brand page, and links them.
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

    // 2. Ensure Saleor Brand Page exists and get its slug
    let linkedSlug = user.saleorPageSlug;
    if (!linkedSlug) {
        linkedSlug = await getOrCreateBrandPageSlug(user.brandName || user.brand);
    }

    // 3. Ensure PayloadCMS Brand Page exists
    let payloadBrandPageId = user.payloadBrandPageId;
    if (!payloadBrandPageId && linkedSlug) {
        payloadBrandPageId = await createPayloadBrandPage({
            vendorId: user.id,
            saleorPageSlug: linkedSlug,
            brandName: user.brandName || user.brand,
        });
    }

    // 4. Prepare address for geocoding
    const address = {
      street: user.street || "",
      city: user.city || "",
      postalCode: user.postalCode || "",
      country: user.countryCode || "",
    };

    if (!address.city || !address.country) {
        // Update slugs even if geocoding can't proceed
        if (linkedSlug !== user.saleorPageSlug || payloadBrandPageId !== user.payloadBrandPageId) {
            await db.update(users).set({ 
                saleorPageSlug: linkedSlug,
                payloadBrandPageId: payloadBrandPageId,
            }).where(eq(users.id, payload.userId));
        }
        return { success: !!linkedSlug, error: "Insufficient address data", slug: linkedSlug, payloadBrandPageId };
    }

    // 5. Geocode
    const result = await geocodeAddress(address);

    if (result) {
      // 6. Update coordinates and slugs in DB
      const updatePayload = {
        latitude: result.latitude,
        longitude: result.longitude,
        geocodedAt: new Date(),
        saleorPageSlug: linkedSlug,
        payloadBrandPageId: payloadBrandPageId,
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
        slug: linkedSlug,
        payloadBrandPageId
      };
    }

    // Update slugs even if geocoding fails
    if (linkedSlug !== user.saleorPageSlug || payloadBrandPageId !== user.payloadBrandPageId) {
        await db.update(users).set({ 
            saleorPageSlug: linkedSlug,
            payloadBrandPageId: payloadBrandPageId,
        }).where(eq(users.id, payload.userId));
    }

    return { success: !!linkedSlug, error: "Geocoding failed", slug: linkedSlug, payloadBrandPageId };
  },
});
