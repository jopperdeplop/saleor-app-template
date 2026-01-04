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

export const translateProduct = task({
    id: "translate-product",
    run: async (payload: { productId: string }) => {
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

        // 1. Fetch Product Data
        const productRes = await saleorFetch(`
            query GetProduct($id: ID!) {
                product(id: $id) {
                    id
                    name
                    description
                    translations {
                        language {
                            code
                        }
                    }
                }
            }
        `, { id: payload.productId });

        const product = productRes.data?.product;
        if (!product) {
            console.error("❌ Product lookup failed. Query:", JSON.stringify({ query: "GetProduct", variables: { id: payload.productId } }));
            console.error("❌ Response:", JSON.stringify(productRes));
            throw new Error(`Product not found for ID: ${payload.productId}`);
        }

        console.log(`🌍 Translating Product: ${product.name} (${product.id})`);

        const existingTranslations = new Set(product.translations.map((t: any) => t.language.code.toUpperCase()));

        // 2. Translate to each language
        for (const lang of TARGET_LANGUAGES) {
            if (existingTranslations.has(lang.code)) {
                console.log(`⏩ Skipping ${lang.name} (already translated)`);
                continue;
            }

            console.log(`✍️ Translating to ${lang.name}...`);

            const translatedName = await translateText(product.name, lang.name, geminiKey);
            const translatedDescription = await translateText(product.description || "", lang.name, geminiKey, true);

            // 3. Update Saleor Translation
            const updateRes = await saleorFetch(`
                mutation UpdateTranslation($id: ID!, $language: LanguageCodeEnum!, $input: TranslationInput!) {
                    productTranslate(id: $id, languageCode: $language, input: $input) {
                        errors { field message }
                    }
                }
            `, {
                id: product.id,
                language: lang.code,
                input: {
                    name: translatedName,
                    description: translatedDescription
                }
            });

            if (updateRes.data?.productTranslate?.errors?.length > 0) {
                console.error(`❌ Failed to update ${lang.name} translation:`, updateRes.data.productTranslate.errors);
            } else {
                console.log(`✅ ${lang.name} translation updated.`);
            }
        }

        console.log(`✅ All translations processed for ${product.name}`);
    }
});

async function translateText(text: string, targetLanguage: string, apiKey: string, isJson: boolean = false): Promise<string> {
    if (!text || text === "{}" || text === '{"time":0,"blocks":[],"version":"2.25.0"}') return text;

    const prompt = isJson 
        ? `You are a professional e-commerce translator. Translate the following EditorJS JSON content into ${targetLanguage}. Keep the JSON structure identical, only translate the text values inside the blocks. Do not translate HTML tags or technical keys. Return ONLY the translated JSON.\n\nContent: ${text}`
        : `Translate the following product name into ${targetLanguage}. Return ONLY the translated string.\n\nContent: ${text}`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();
        const translatedContent = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!translatedContent) {
            console.warn(`⚠️ Gemini returned empty translation for ${targetLanguage}`);
            return text;
        }

        // Clean up markdown code blocks if Gemini wrapped them
        return translatedContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } catch (e) {
        console.error(`❌ Translation error for ${targetLanguage}:`, e);
        return text;
    }
}
