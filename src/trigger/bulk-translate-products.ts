import { task } from "@trigger.dev/sdk";

// --- CONFIGURATION ---
const TARGET_LANGUAGES = [
    { code: "NL", name: "Dutch" },
    { code: "DE", name: "German" },
    { code: "FR", name: "French" },
    { code: "IT", name: "Italian" },
    { code: "ES", name: "Spanish" },
    { code: "PT", name: "Portuguese" },
    { code: "FI", name: "Finnish" },
    { code: "ET", name: "Estonian" },
    { code: "LV", name: "Latvian" },
    { code: "LT", name: "Lithuanian" },
    { code: "SK", name: "Slovak" },
    { code: "SL", name: "Slovenian" },
    { code: "EL", name: "Greek" },
    { code: "HR", name: "Croatian" },
    { code: "MT", name: "Maltese" },
];

export const bulkTranslateProducts = task({
    id: "bulk-translate-products",
    run: async (payload: { productIds: string[] }) => {
        const { productIds } = payload;
        if (!productIds || productIds.length === 0) {
            console.log("⚠️ No product IDs provided for bulk translation.");
            return;
        }

        console.log(`🚀 Starting bulk translation for ${productIds.length} products...`);

        const apiUrl = process.env.SALEOR_API_URL;
        const geminiKey = process.env.GOOGLE_API_KEY;
        let saleorToken = (process.env.SALEOR_APP_TOKEN || process.env.SALEOR_TOKEN || "").trim();

        if (!apiUrl || !saleorToken || !geminiKey) {
            throw new Error("Missing SALEOR_API_URL, SALEOR_TOKEN, or GOOGLE_API_KEY");
        }

        saleorToken = `Bearer ${saleorToken.replace(/^bearer\s+/i, "")}`;

        const saleorFetch = async (query: string, variables: any = {}) => {
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': saleorToken,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query, variables })
            });
            return await res.json();
        };

        // Verify Auth
        try {
            const shopRes = await saleorFetch(`query { shop { name } }`);
            if (!shopRes.data?.shop) {
                 console.error("❌ Authentication check failed. Shop query returned null.", JSON.stringify(shopRes));
            } else {
                 console.log(`✅ Connected to Saleor Shop: ${shopRes.data.shop.name}`);
            }
        } catch (e) {
             console.error("❌ Error connecting to Saleor:", e);
        }

        // Build Translation Alias Query Part
        const translationAliases = TARGET_LANGUAGES.map(lang => 
            `t_${lang.code}: translation(languageCode: ${lang.code}) { name description }`
        ).join("\n");

        // Process products with concurrency limit
        const CONCURRENCY = 5;
        let processed = 0;
        let failed = 0;

        for (let i = 0; i < productIds.length; i += CONCURRENCY) {
            const batch = productIds.slice(i, i + CONCURRENCY);
            await Promise.all(batch.map(async (productId) => {
                try {
                    // Try getting product
                    let productRes = await saleorFetch(`
                        query GetProduct($id: ID!) {
                            product(id: $id) {
                                id
                                name
                                description
                                ${translationAliases}
                            }
                        }
                    `, { id: productId });

                    let product = productRes.data?.product;
                    
                    // Fallback to Node query if Product query fails
                    if (!product) {
                        // console.warn(`⚠️ product(id: "${productId}") returned null. Trying node(id)...`);
                        const nodeRes = await saleorFetch(`
                            query GetNode($id: ID!) {
                                node(id: $id) {
                                    ... on Product {
                                        id
                                        name
                                        description
                                        ${translationAliases}
                                    }
                                }
                            }
                        `, { id: productId });
                        product = nodeRes.data?.node;
                    }

                    if (!product) {
                        console.error(`❌ Product NOT FOUND for ID: ${productId}. Skipping.`);
                        console.error("Debug Response:", JSON.stringify(productRes));
                        failed++;
                        return;
                    }

                    console.log(`🌍 Translating: ${product.name} (${product.id})`);

                    for (const lang of TARGET_LANGUAGES) {
                        console.log(`   ✍️ Translating to ${lang.name}...`);
                        const translatedName = await translateText(product.name, lang.name, geminiKey);
                        const translatedDescription = await translateText(product.description || "", lang.name, geminiKey, true);

                        const updateRes = await saleorFetch(`
                            mutation UpdateTranslation($id: ID!, $language: LanguageCodeEnum!, $input: TranslationInput!) {
                                productTranslate(id: $id, languageCode: $language, input: $input) {
                                    errors { field message }
                                }
                            }
                        `, {
                            id: product.id,
                            language: lang.code,
                            input: { name: translatedName, description: translatedDescription }
                        });

                        if (updateRes.data?.productTranslate?.errors?.length > 0) {
                            console.error(`   ❌ Failed to update ${lang.name}:`, updateRes.data.productTranslate.errors);
                        }
                    }
                    processed++;

                } catch (e) {
                    console.error(`❌ Error processing ${productId}:`, e);
                    failed++;
                }
            }));
        }
        
        console.log(`✅ Bulk translation finished. Processed: ${processed}, Failed: ${failed}`);
    }
});

async function translateText(text: string, targetLanguage: string, apiKey: string, isJson: boolean = false): Promise<string> {
    if (!text || text === "{}" || text === '{"time":0,"blocks":[],"version":"2.25.0"}') return text;

    const prompt = isJson 
        ? `You are a professional e-commerce translator. Translate the following EditorJS JSON content into ${targetLanguage}. Keep the JSON structure identical, only translate the text values inside the blocks. Do not translate HTML tags or technical keys. Return ONLY the translated JSON.\n\nContent: ${text}`
        : `Translate the following product name into ${targetLanguage}. If the name contains terms that are commonly used in ${targetLanguage} (like "Snowboard" in Dutch) or proper brand names, keep them in their original form. Return ONLY the final translated string.\n\nContent: ${text}`;

    try {
        // Updated to Gemini 2.0 Flash Lite as requested
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`❌ Gemini API Error (${response.status}):`, errText);
            return text;
        }

        const data = await response.json();
        const translatedContent = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!translatedContent) {
            console.warn(`⚠️ Gemini returned empty translation for ${targetLanguage}. Response:`, JSON.stringify(data));
            return text;
        }

        // Clean up markdown code blocks if Gemini wrapped them
        return translatedContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } catch (e) {
        console.error(`❌ Translation error for ${targetLanguage}:`, e);
        return text;
    }
}

function getContentSignature(text: string): string {
    if (!text) return "";
    try {
        const obj = JSON.parse(text);
        if (obj.blocks && Array.isArray(obj.blocks)) {
             return obj.blocks.map((b: any) => b.data?.text || "").join("").trim();
        }
        return text;
    } catch (e) {
        return text;
    }
}
