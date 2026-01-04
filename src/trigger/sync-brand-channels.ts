import { task } from "@trigger.dev/sdk";
import { db } from "../db";
import { users, productOverrides } from "../db/schema";
import { eq } from "drizzle-orm";

// --- CONFIGURATION ---
const COUNTRY_TO_CHANNEL: Record<string, string> = {
    "AT": "austria", "BE": "belgium", "HR": "croatia", "CY": "cyprus",
    "EE": "estonia", "FI": "finland", "FR": "france", "DE": "germany",
    "GR": "greece", "IE": "ireland", "IT": "italy", "LV": "latvia",
    "LT": "lithuania", "LU": "luxembourg", "MT": "malta", "NL": "netherlands",
    "PT": "portugal", "SK": "slovakia", "SI": "slovenia", "ES": "spain"
};

export const syncBrandChannels = task({
    id: "sync-brand-channels",
    run: async (payload: { brandName: string }) => {
        const apiUrl = process.env.SALEOR_API_URL;
        let saleorToken = (process.env.SALEOR_APP_TOKEN || process.env.SALEOR_TOKEN || "").trim();

        if (!apiUrl || !saleorToken) throw new Error("Missing SALEOR_API_URL or SALEOR_TOKEN");
        
        saleorToken = `Bearer ${saleorToken.replace(/^bearer\s+/i, "")}`;

        const saleorFetch = async (query: string, variables: any = {}): Promise<any> => {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Authorization': saleorToken, 'Content-Type': 'application/json' },
                body: JSON.stringify({ query, variables })
            });
            return await res.json();
        };

        // 1. Get Brand Settings
        const userData = await db.select().from(users).where(eq(users.brand, payload.brandName)).limit(1);
        const user = userData[0];
        if (!user) throw new Error(`Brand settings not found for: ${payload.brandName}`);

        const globalCountries = (user.shippingCountries as string[]) || [];
        console.log(`🔄 Syncing channels for ${payload.brandName}. Global countries: ${globalCountries.join(", ")}`);

        // 2. Get All Channels in Saleor
        const channelsRes = await saleorFetch(`query { channels { id slug isActive } }`);
        const allChannels = (channelsRes.data?.channels || []).filter((c: any) => c.isActive);
        const channelSlugToId = new Map(allChannels.map((c: any) => [c.slug, c.id]));

        // 3. Fetch Brand Products from Saleor (Paginated)
        let hasNextPage = true;
        let endCursor: string | null = null;
        let totalCount = 0;

        // Pre-resolve Brand Page ID (since Attribute Filter expects ID for References)
        const brandSlug = payload.brandName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        console.log(`🔎 Resolving Brand Page for slug: "${brandSlug}"...`);
        
        const pageRes = await saleorFetch(`query GetPage($s: String!) { page(slug: $s) { id } }`, { s: brandSlug });
        const brandPageId = pageRes.data?.page?.id;

        if (!brandPageId) {
             console.warn(`⚠️ Brand page not found for slug: ${brandSlug}. Cannot filter products.`);
             return; // Exit if we can't identify the brand page
        }
        console.log(`✅ Found Brand Page ID: ${brandPageId}`);

        while (hasNextPage) {
            const productsRes = await saleorFetch(`
                query GetProducts($brandVal: String!, $after: String) {
                    products(filter: { attributes: [{ slug: "brand", values: [$brandVal] }] }, first: 50, after: $after) {
                        pageInfo { hasNextPage endCursor }
                        edges {
                            node {
                                id
                                name
                                channelListings {
                                    channel { id slug }
                                }
                            }
                        }
                    }
                }
            `, { brandVal: brandSlug, after: endCursor });

            const products = productsRes.data?.products?.edges || [];
            if (products.length === 0 && totalCount === 0) {
                 console.log(`⚠️ No products found for brand ID: ${brandPageId}. Raw response:`, JSON.stringify(productsRes));
            }

            hasNextPage = productsRes.data?.products?.pageInfo.hasNextPage;
            endCursor = productsRes.data?.products?.pageInfo.endCursor;

            for (const pEdge of products) {
                const p = pEdge.node;
                totalCount++;

                // 4. Determine target countries (check for overrides)
                const override = await db.select().from(productOverrides).where(eq(productOverrides.productId, p.id)).limit(1);
                
                // OPT-OUT LOGIC: If no countries selected globally/override, default to ALL 20 Eurozone countries
                let targetCountries = override[0] ? (override[0].shippingCountries as string[]) : globalCountries;
                if (!targetCountries || targetCountries.length === 0) {
                    targetCountries = Object.keys(COUNTRY_TO_CHANNEL);
                }
                
                const targetChannelSlugs = targetCountries.map(c => COUNTRY_TO_CHANNEL[c]).filter(Boolean);
                const targetChannelIds = targetChannelSlugs.map(slug => channelSlugToId.get(slug)).filter(Boolean) as string[];

                const currentChannelIds = p.channelListings.map((l: any) => l.channel.id as string);
                
                const toAdd = targetChannelIds.filter((id: string) => !currentChannelIds.includes(id));
                const toRemove = currentChannelIds.filter((id: string) => !targetChannelIds.includes(id));

                if (toAdd.length > 0 || toRemove.length > 0) {
                    console.log(`   📦 Updating ${p.name}: +${toAdd.length} / -${toRemove.length} channels`);
                    
                    const updateChannels = toAdd.map(id => ({
                        channelId: id,
                        isPublished: true,
                        isAvailableForPurchase: true,
                        visibleInListings: true
                    }));

                    await saleorFetch(`
                        mutation UpdateProductChannels($id: ID!, $input: ProductChannelListingUpdateInput!) {
                            productChannelListingUpdate(id: $id, input: $input) {
                                errors { field message }
                            }
                        }
                    `, {
                        id: p.id,
                        input: {
                            updateChannels: updateChannels,
                            removeChannels: toRemove
                        }
                    });
                }
            }
        }

        console.log(`✅ Finished syncing ${totalCount} products for ${payload.brandName}`);
    }
});
