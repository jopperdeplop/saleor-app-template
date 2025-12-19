
import { task } from "@trigger.dev/sdk";
import { db } from "../db";
import { integrations, users } from "../db/schema";
import { eq } from "drizzle-orm";

// --- VERSIONING ---
const SYNC_VERSION = "LIGHTSPEED-SYNC-V1";

// --- CONFIGURATION FROM ENV ---
const PRODUCT_TYPE_ID = process.env.SALEOR_PRODUCT_TYPE_ID;
const CATEGORY_ID = process.env.SALEOR_CATEGORY_ID;

// --- HELPERS ---

function textToEditorJs(text: string) {
    const cleanText = text ? text.replace(/\n/g, "<br>") : "";
    return JSON.stringify({
        time: Date.now(),
        blocks: [{ type: "paragraph", data: { text: cleanText } }],
        version: "2.25.0"
    });
}

// --- TASK DEFINITION ---

export const lightspeedProductSync = task({
    id: "lightspeed-product-sync",
    run: async (payload: { integrationId: number }) => {
        console.log(`🚀 [${SYNC_VERSION}] Execution Start. Integration: ${payload.integrationId}`);

        // --- 1. SETUP & AUTH ---
        const integrationData = await db.select({
            id: integrations.id,
            accessToken: integrations.accessToken,
            storeUrl: integrations.storeUrl,
            provider: integrations.provider,
            brandName: users.brand
        })
            .from(integrations)
            .innerJoin(users, eq(integrations.userId, users.id))
            .where(eq(integrations.id, payload.integrationId))
            .limit(1);

        const integration = integrationData[0];
        if (!integration) throw new Error("Integration not found");
        if (integration.provider !== "lightspeed") {
            console.warn(`⚠️ skipping: Not Lightspeed`);
            return;
        }

        const domainPrefix = integration.storeUrl; // We stored domain prefix here
        const apiUrl = process.env.SALEOR_API_URL;
        let saleorToken = (process.env.SALEOR_APP_TOKEN || process.env.SALEOR_TOKEN || "").trim();

        if (saleorToken) {
            saleorToken = `Bearer ${saleorToken.replace(/^bearer\s+/i, "")}`;
        }

        if (!apiUrl || !saleorToken) throw new Error("Missing SALEOR_API_URL or SALEOR_TOKEN");

        const saleorHeaders = {
            'Authorization': saleorToken,
            'Content-Type': 'application/json'
        };

        const saleorFetch = async (query: string, variables: any = {}) => {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: saleorHeaders,
                body: JSON.stringify({ query, variables })
            });
            const json: any = await res.json();
            if (json.errors) {
                console.error("Saleor API Errors:", JSON.stringify(json.errors, null, 2));
            }
            return json;
        };

        // --- 2. FETCH DATA FROM LIGHTSPEED ---

        console.log(`Fetching products from Lightspeed: ${domainPrefix}`);
        const lsProductRes = await fetch(`https://${domainPrefix}.retail.lightspeed.app/api/2.0/products`, {
            headers: {
                'Authorization': `Bearer ${integration.accessToken}`
            }
        });

        if (!lsProductRes.ok) {
            const errBody = await lsProductRes.text();
            throw new Error(`Lightspeed API Error (${lsProductRes.status}): ${errBody}`);
        }

        const lsProductData = await lsProductRes.json();
        const products = lsProductData.data || [];
        console.log(`Found ${products.length} products in Lightspeed.`);

        // --- 3. SYNC TO SALEOR ---

        for (const p of products) {
            console.log(`Syncing product: ${p.name} (${p.id})`);

            const predictableSlug = `ls-${p.id}`; // Persistent slug for matching

            // Check if product exists
            const checkQuery = `
                query CheckProduct($slug: String!) {
                    product(slug: $slug) {
                        id
                    }
                }
            `;
            const checkRes = await saleorFetch(checkQuery, { slug: predictableSlug });
            let saleorProductId = checkRes.data?.product?.id;

            if (saleorProductId) {
                console.log(`Updating existing product: ${saleorProductId}`);
                // Update logic (simplified for now)
            } else {
                console.log(`Creating new product in Saleor...`);
                const createMutation = `
                    mutation CreateProduct($input: ProductCreateInput!) {
                        productCreate(input: $input) {
                            product {
                                id
                            }
                            errors {
                                field
                                message
                            }
                        }
                    }
                `;

                const createInput = {
                    name: p.name,
                    slug: predictableSlug,
                    productType: PRODUCT_TYPE_ID,
                    category: CATEGORY_ID,
                    description: textToEditorJs(p.description || ""),
                    // Add attributes like Brand if needed
                };

                const createRes = await saleorFetch(createMutation, { input: createInput });
                saleorProductId = createRes.data?.productCreate?.product?.id;

                if (!saleorProductId) {
                    console.error(`Failed to create product ${p.name}:`, createRes.data?.productCreate?.errors);
                    continue;
                }
            }

            // Variants Logic
            // Lightspeed products can have variants. For now, we assume simple products or handle variants if present.
            // p.variants usually contains variant details in X-Series 2.0
            const variants = p.variants || [{ id: p.id, sku: p.sku, price: p.price }];

            for (const v of variants) {
                // Similar logic to create/update variants in Saleor
                // Using SKU for matching
            }
        }

        return { success: true, count: products.length };
    },
});
