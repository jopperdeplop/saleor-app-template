import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = process.env.GOOGLE_API_KEY;

if (!API_KEY && process.env.NODE_ENV !== "test") {
  console.warn("⚠️ GOOGLE_API_KEY is not set. AI features will fail.");
}

const genAI = new GoogleGenerativeAI(API_KEY || "");
// using model from shopify-product-lifecycle.ts as requested
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-09-2025" });

export interface CategorySuggestion {
  categoryName: string;
  isNew: boolean;
  reasoning: string;
  confidence: number;
}

export interface SEOMetadata {
  seoTitle: string;
  seoDescription: string;
  description: string; // HTML Rich Text
}

export interface HierarchyProposal {
  parent: string | null;
  children: string[];
  reason: string;
}

/**
 * CLUSTERING: Groups products into logical categories.
 * Handles Synonym Guard by providing existing categories as context.
 */
export async function suggestCategoriesForBatch(
  products: { id: string; name: string; description: string }[],
  existingCategories: string[]
): Promise<Record<string, string[]>> {
  // Return map of "Category Name" -> ["ProductID"]
  if (!API_KEY) return {};

  const prompt = `
    You are an Expert E-commerce Merchandiser.
    Goal: Group these products into logical categories.

    CONTEXT - EXISTING CATEGORIES:
    ${JSON.stringify(existingCategories.slice(0, 500))} 
    (Use these EXACT names if the product fits. Do not create synonyms like "Snowboards" if "Snowboard" exists.)

    PRODUCTS TO GROUP:
    ${JSON.stringify(products.map(p => ({ id: p.id, name: p.name, desc: p.description.slice(0, 100) })))}

    INSTRUCTIONS:
    1. Organize products into specific hierarchical paths (e.g., "Winter Sports > Snowboarding > Gear", "Winter Sports > Maintenance > Ski Wax").
    2. BE SPECIFIC: Avoid generic categories like "Accessories" or "Equipment" if a more specific one (like "Ski Wax" or "Bindings") applies.
    3. CHECK CONTEXT: If a specific category like "Ski Wax" already exists in the provided list, USE IT (or nested under a parent).
    4. CONSISTENCY: Ensure similar products (e.g. all waxes) go to the EXACT same path.
    5. Return ONLY valid JSON: { "Category Path": ["product_id_1"] }
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanText = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("AI Clustering Failed:", e);
    return {};
  }
}

/**
 * HIERARCHY: Organizes flat categories into a tree.
 */
export async function optimizeHierarchy(
  categories: string[]
): Promise<Record<string, string[]>> {
  // Return map of "Parent" -> ["Child", "Child"]
  if (!API_KEY) return {};

  const prompt = `
    You are an Information Architect.
    Goal: Organize these e-commerce categories into a logical Parent/Child hierarchy.

    CATEGORIES:
    ${JSON.stringify(categories)}

    INSTRUCTIONS:
    1. Group related items into a strong directory structure (e.g., "Snowboards", "Ski Wax" -> "Winter Sports").
    2. Create NEW common Parent Categories if logic dictates (e.g., create "Winter Sports" for isolated winter items).
    3. Return JSON: { "Parent Name": ["Child Name", "Child Name"] }
    4. Focus on aggregating meaningful clusters (e.g. don't leave "Ski Wax" as a root category if "Winter Sports" can exist).
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanText = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("AI Hierarchy Optimization Failed:", e);
    return {};
  }
}

/**
 * SEO: Generates rich content based on ACTUAL product data.
 */
export async function generateCategorySEO(
  categoryName: string,
  topProducts: { brand: string; name: string; features: string[] }[]
): Promise<SEOMetadata> {
  if (!API_KEY) return { seoTitle: "", seoDescription: "", description: "" };

  const brands = Array.from(new Set(topProducts.map(p => p.brand).filter(Boolean))).join(", ");
  const features = Array.from(new Set(topProducts.flatMap(p => p.features).filter(Boolean).slice(0, 10))).join(", ");

  const prompt = `
    Act as an SEO Specialist.
    Category: "${categoryName}"
    
    REAL INVENTORY DATA:
    - Top Brands: ${brands || "Various Premium Brands"}
    - Key Features: ${features || "High Quality, Durable"}
    - Sample Products: ${topProducts.slice(0, 3).map(p => p.name).join(", ")}

    TASK:
    1. Write a **SEO Title** (Max 60 chars). Target "Buy [Category] Online".
    2. Write a **SEO Meta Description** (Max 160 chars). Natural, catchy, includes key brands/features.
    3. Write a **Category Description** (HTML, H1, Paragraphs). 
       - Must start with H1.
       - Include long-tail keywords (e.g. "Shop the best ${brands} ${categoryName}").
       - Mention specific features found in the inventory.
       - Use simple, convincing retail language.

    Return JSON: { "seoTitle": "...", "seoDescription": "...", "description": "..." }
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const cleanText = text.replace(/```json|```/g, "").trim();
    return JSON.parse(cleanText);
  } catch (e) {
    console.error("AI SEO Generation Failed:", e);
    return {
      seoTitle: `${categoryName} - Buy Online`,
      seoDescription: `Shop the best ${categoryName} at our store. Top brands and great prices.`,
      description: `<h1>${categoryName}</h1><p>Explore our collection of ${categoryName}.</p>`
    };
  }
}
