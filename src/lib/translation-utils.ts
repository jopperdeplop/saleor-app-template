
export const TARGET_LANGUAGES = [
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
] as const;

export type TargetLanguageCode = (typeof TARGET_LANGUAGES)[number]["code"];

/**
 * Gemini 2.0 Flash Lite Translation Helper
 */
export async function translateText(
    text: string, 
    targetLanguage: string, 
    apiKey: string, 
    options: { isJson?: boolean; context?: string } = {}
): Promise<string> {
    if (!text || text === "{}" || text === '{"time":0,"blocks":[],"version":"2.25.0"}') return text;

    const { isJson = false, context = "" } = options;

    const prompt = isJson 
        ? `You are a professional e-commerce translator. 
           Translate the following EditorJS JSON content into ${targetLanguage}. 
           Keep the JSON structure identical, only translate the text values inside the blocks. 
           Do not translate HTML tags or technical keys. 
           Context: ${context}
           Return ONLY the translated JSON.
           
           Content: ${text}`
        : `Translate the following e-commerce text into ${targetLanguage}. 
           Keep brand names and technical terms in their original form if commonly used in ${targetLanguage}.
           Context: ${context}
           Return ONLY the final translated string.
           
           Content: ${text}`;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Gemini API Error (${response.status}): ${errText}`);
        }

        const data = await response.json();
        let translated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

        if (!translated) {
            console.warn(`⚠️ Gemini returned empty translation for ${targetLanguage}`);
            return text;
        }

        // Clean up markdown code blocks if Gemini wrapped them
        return translated.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim();
    } catch (e) {
        console.error(`❌ Translation error for ${targetLanguage}:`, e);
        return text;
    }
}

/**
 * Shared GraphQL fragments for private metadata
 */
export const PRIVATE_METADATA_FRAGMENT = `
  fragment PrivateMetadataFragment on ObjectWithMetadata {
    privateMetadata {
      key
      value
    }
  }
`;

/**
 * Extracts a specific key from private metadata array
 */
export function getMetadataValue(metadata: Array<{ key: string; value: string }>, key: string): string | null {
  return metadata.find(m => m.key === key)?.value || null;
}
