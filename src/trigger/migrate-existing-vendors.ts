import { task } from "@trigger.dev/sdk";
import { db } from "../db";
import { users } from "../db/schema";
import { and, isNotNull, isNull, eq } from "drizzle-orm";

const PAYLOAD_API_BASE = process.env.PAYLOAD_API_URL || 'https://payload-saleor-payload.vercel.app/api';
const PAYLOAD_API_KEY = process.env.PAYLOAD_API_KEY || '';

// Clean up standard URL to ensure it has /api
const getPayloadUrl = (endpoint: string) => {
    const base = PAYLOAD_API_BASE.endsWith('/') ? PAYLOAD_API_BASE.slice(0, -1) : PAYLOAD_API_BASE;
    // If base doesn't end with /api, add it
    const normalizedBase = base.toLowerCase().endsWith('/api') ? base : `${base}/api`;
    return `${normalizedBase}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
};

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
    if (!PAYLOAD_API_BASE || !PAYLOAD_API_KEY) {
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

        const url = `${getPayloadUrl('brand-page')}?locale=en`;
        console.log(`Sending request to PayloadCMS: ${url}`);
        console.log('Payload Body:', JSON.stringify(payloadBody, null, 2));
        console.log('Using Headers:', {
            'Content-Type': 'application/json',
            'x-payload-api-key': PAYLOAD_API_KEY ? `${PAYLOAD_API_KEY.substring(0, 4)}...` : 'MISSING'
        });

        const res = await fetch(url, {
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
            
            try {
                const errorJson = JSON.parse(errorText);
                if (errorJson.errors) {
                    console.error('Validation Errors:', JSON.stringify(errorJson.errors, null, 2));
                }
            } catch (e) {
                // Not JSON, that's fine
            }
            return null;
        }

        const result = await res.json();
        return result.doc?.id || null;
    } catch (e) {
        console.error('Failed to create PayloadCMS brand page:', e);
        return null;
    }
}

/**
 * One-time migration task to create PayloadCMS brand pages for existing vendors.
 * Run this once after deploying the brand page feature.
 */
export const migrateExistingVendorsTask = task({
    id: "migrate-existing-vendors",
    run: async () => {
        console.log('Starting migration of existing vendors...');

        // Find all users with saleorPageSlug but no payloadBrandPageId
        const vendors = await db.select()
            .from(users)
            .where(and(
                isNotNull(users.saleorPageSlug),
                isNull(users.payloadBrandPageId)
            ));

        console.log(`Found ${vendors.length} vendors to migrate`);

        let migrated = 0;
        let failed = 0;

        for (const vendor of vendors) {
            try {
                if (!vendor.saleorPageSlug) continue;

                console.log(`Migrating vendor ${vendor.id}: ${vendor.brandName || vendor.brand}`);

                const payloadId = await createPayloadBrandPage({
                    vendorId: vendor.id,
                    saleorPageSlug: vendor.saleorPageSlug,
                    brandName: vendor.brandName || vendor.brand,
                });

                if (payloadId) {
                    await db.update(users)
                        .set({ payloadBrandPageId: payloadId })
                        .where(eq(users.id, vendor.id));
                    
                    console.log(`Successfully migrated vendor ${vendor.id}, payloadBrandPageId: ${payloadId}`);
                    migrated++;
                } else {
                    console.error(`Failed to create PayloadCMS page for vendor ${vendor.id}`);
                    failed++;
                }
            } catch (e) {
                console.error(`Error migrating vendor ${vendor.id}:`, e);
                failed++;
            }
        }

        console.log(`Migration complete: ${migrated} migrated, ${failed} failed`);
        return { migrated, failed, total: vendors.length };
    },
});
