import { task } from "@trigger.dev/sdk";
import { db } from "../db";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";

// --- CONFIGURATION ---
const COUNTRY_TO_CHANNEL: Record<string, string> = {
    "AT": "austria", "BE": "belgium", "HR": "croatia", "CY": "cyprus",
    "EE": "estonia", "FI": "finland", "FR": "france", "DE": "germany",
    "GR": "greece", "IE": "ireland", "IT": "italy", "LV": "latvia",
    "LT": "lithuania", "LU": "luxembourg", "MT": "malta", "NL": "netherlands",
    "PT": "portugal", "SK": "slovakia", "SI": "slovenia", "ES": "spain"
};

export const autoAssignProductChannels = task({
    id: "auto-assign-product-channels",
    run: async (payload: { productId: string, brand: string }) => {
        const apiUrl = process.env.SALEOR_API_URL;
        let saleorToken = (process.env.SALEOR_APP_TOKEN || process.env.SALEOR_TOKEN || "").trim();

        if (!apiUrl || !saleorToken) throw new Error("Missing SALEOR_API_URL or SALEOR_TOKEN");
        
        saleorToken = `Bearer ${saleorToken.replace(/^bearer\s+/i, "")}`;

        const saleorFetch = async (query: string, variables: any = {}) => {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Authorization': saleorToken, 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables })
            });
            return await res.json();
        };

        console.log(`🚀 Auto-assigning channels for Product: ${payload.productId} (Brand: ${payload.brand})`);

        // 1. Get Brand Settings
        const userData = await db.select().from(users).where(eq(users.brand, payload.brand)).limit(1);
        const user = userData[0];
        if (!user) {
            console.warn(`⚠️ Brand settings not found for: ${payload.brand}. Skipping auto-assignment.`);
            return;
        }

        // OPT-OUT LOGIC: Default to all 20 countries if none selected for brand
        let targetCountries = (user.shippingCountries as string[]) || [];
        if (targetCountries.length === 0) {
            targetCountries = Object.keys(COUNTRY_TO_CHANNEL);
        }

        // 2. Get All Channels in Saleor
        const channelsRes = await saleorFetch(`query { channels { id slug isActive } }`);
        const allChannels = (channelsRes.data?.channels || []).filter((c: any) => c.isActive);
        const channelSlugToId = new Map(allChannels.map((c: any) => [c.slug, c.id]));

        const targetChannelSlugs = targetCountries.map(c => COUNTRY_TO_CHANNEL[c]).filter(Boolean);
        const targetChannelIds = targetChannelSlugs.map(slug => channelSlugToId.get(slug)).filter(Boolean) as string[];

        if (targetChannelIds.length === 0) {
            console.warn(`⚠️ No valid channels found for countries: ${targetCountries.join(", ")}`);
            return;
        }

        // 3. Assign Product to Channels
        const updateChannels = targetChannelIds.map(id => ({
            channelId: id,
            isPublished: true,
            isAvailableForPurchase: true,
            visibleInListings: true
        }));

        console.log(`📦 Assigning to ${targetChannelIds.length} channels...`);
        const result = await saleorFetch(`
            mutation UpdateProductChannels($id: ID!, $input: ProductChannelListingUpdateInput!) {
                productChannelListingUpdate(id: $id, input: $input) {
                    errors { field message }
                }
            }
        `, {
            id: payload.productId,
            input: {
                updateChannels: updateChannels
            }
        });

        if (result.data?.productChannelListingUpdate?.errors?.length > 0) {
            console.error(`❌ Failed to assign channels:`, JSON.stringify(result.data.productChannelListingUpdate.errors));
        } else {
            console.log(`✅ Successfully assigned channels.`);
        }
    }
});
