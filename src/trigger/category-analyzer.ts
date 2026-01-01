import { task } from "@trigger.dev/sdk";
import { suggestCategoriesForBatch, optimizeHierarchy, generateCategorySEO } from "@/lib/google-ai";
import { saleorClient } from "@/lib/saleor-client";
import { gql } from "urql";

// --- CONFIG ---
const DRY_RUN_DEFAULT = true;

// --- TYPES ---
type AnalysisPayload = {
  batchSize?: number;
  dryRun?: boolean;
};

// --- QUERIES ---
const GET_PRODUCTS_QUERY = gql`
  query GetProductsForAnalysis($first: Int!, $after: String) {
    products(first: $first, after: $after) {
      pageInfo { hasNextPage endCursor }
      edges {
        node {
          id
          name
          description
          category { name }
          attributes { attribute { name } values { name } }
        }
      }
    }
  }
`;

const GET_CATEGORIES_QUERY = gql`
  query GetAllCategories {
    categories(first: 100) {
      edges { node { id name parent { id name } } }
    }
  }
`;

const CREATE_CATEGORY_MUTATION = gql`
  mutation CreateCategory($name: String!, $parent: ID, $seoTitle: String, $seoDesc: String, $desc: JSONString) {
    categoryCreate(
      input: {
        name: $name,
        seo: { title: $seoTitle, description: $seoDesc },
        description: $desc
      }
      parent: $parent
    ) {
      category { id }
      errors { field message }
    }
  }
`;

const UPDATE_PRODUCT_CATEGORY_MUTATION = gql`
  mutation UpdateProductCategory($id: ID!, $category: ID!) {
    productUpdate(id: $id, input: { category: $category }) {
      errors { field message }
    }
  }
`;

// NOTE: standard categoryUpdate does not support reparenting. 
// We are disabling this for now to prevent errors.
const UPDATE_CATEGORY_PARENT_MUTATION = gql`
  mutation UpdateCategoryParent($id: ID!, $parent: ID!) {
    categoryUpdate(id: $id, input: { }) {
       errors { field message }
    }
  }
`;

// --- JOBS ---

/**
 * JOB 1: Analyze Product Clusters
 * - Batches products
 * - groups them via AI
 * - moves them to new/existing leaf categories
 */
export const analyzeProductClusters = task({
  id: "analyze-product-clusters",
  run: async (payload: AnalysisPayload) => {
    const batchSize = payload.batchSize || 50;
    
    // Live by default, as requested. Pass { dryRun: true } to simulate.
    const isDryRun = payload.dryRun === true;
    console.log(`🚀 Starting Product Cluster Analysis [LIVE: ${!isDryRun}]`);

    // 1. Fetch ALL Existing Categories (Pagination)
    let allCategories: any[] = [];
    let hasNextPage = true;
    let endCursor = null;

    console.log("   🔄 Fetching full category tree...");
    while (hasNextPage) {
      const catRes: any = await saleorClient.query(GET_CATEGORIES_QUERY, { first: 100, after: endCursor }).toPromise();
      if (catRes.error) throw new Error(catRes.error.message);
      
      const edges = catRes.data?.categories?.edges || [];
      allCategories.push(...edges.map((e: any) => e.node));
      
      hasNextPage = catRes.data?.categories?.pageInfo?.hasNextPage;
      endCursor = catRes.data?.categories?.pageInfo?.endCursor;
    }
    console.log(`   ✅ Loaded ${allCategories.length} categories.`);
    
    // Map of Lowercase Name -> ID
    const existingCategories = allCategories.map((c: any) => c.name);
    const existingCategoryMap = new Map<string, string>(); 
    allCategories.forEach((c: any) => existingCategoryMap.set(c.name.toLowerCase(), c.id));

    // 2. Fetch Products
    // For this version we process the first batch found. 
    // In a full production version we might loop through pages.
    const pRes = await saleorClient.query(GET_PRODUCTS_QUERY, { first: batchSize }).toPromise();
    const products = pRes.data?.products?.edges?.map((e: any) => e.node) || [];
    
    if (products.length === 0) {
      console.log("No products found.");
      return;
    }

    // 3. AI Analysis
    // We send a simplified version of the product data to the AI to save tokens.
    const simplifiedProducts = products.map((p: any) => ({
      id: p.id,
      name: p.name,
      description: p.description ? JSON.stringify(p.description) : ""
    }));

    console.log(`🤖 Sending ${products.length} products to Google AI...`);
    // This function (in google-ai.ts) handles the prompt engineering and synonym checking logic.
    const clusters = await suggestCategoriesForBatch(simplifiedProducts, existingCategories);

    // 4. Execute Decisions



    for (const [pathStr, productIds] of Object.entries(clusters)) {
      console.log(`   📂 Cluster found: "${pathStr}" with ${productIds.length} items.`);
      
      const parts = pathStr.split(" > ");
      let currentParentId: string | null = null;
      let finalCategoryId: string | null = null;

      // Traverse/Create the path
      for (const partName of parts) {
         // Find category matching name AND parent
         // Root category: parent is null. Subcategory: parent.id === currentParentId
         let foundCat = allCategories.find((c: any) => 
           c.name.toLowerCase() === partName.toLowerCase() && 
           (currentParentId ? c.parent?.id === currentParentId : !c.parent)
         );

         if (foundCat) {
           currentParentId = foundCat.id;
         } else {
           // Create it
           if (isDryRun) {
             console.log(`      [DRY RUN] Would CREATE category "${partName}" under parent ${currentParentId || "ROOT"}`);
             currentParentId = "dry-run-id-" + partName;
           } else {
             // Generate SEO only if it's a new leaf or meaningful node?
             // For simplicity, we generate basic SEO for every new node.
             const meta = await generateCategorySEO(partName, []); 
             
             const createRes = await saleorClient.mutation(CREATE_CATEGORY_MUTATION, {
               name: partName,
               parent: currentParentId, // Link to previous node
               seoTitle: meta.seoTitle,
               seoDesc: meta.seoDescription,
               desc: JSON.stringify({ time: Date.now(), blocks: [{ type: "paragraph", data: { text: meta.description } }] }) 
             }).toPromise();

             if (createRes.error || createRes.data?.categoryCreate?.errors?.length > 0) {
               console.error(`      ❌ Failed to create category "${partName}"`, createRes.error || createRes.data?.categoryCreate?.errors);
               // If we fail to create a parent, we can't create children or assign products correctly.
               currentParentId = null; 
               break; 
             }

             const newCat = createRes.data?.categoryCreate?.category;
             if (newCat?.id) {
               console.log(`      ✅ Created category "${partName}" (${newCat.id}) under ${currentParentId || "ROOT"}`);
               currentParentId = newCat.id;
               // Add to local cache so next iteration finds it
               allCategories.push({ id: newCat.id, name: partName, parent: currentParentId ? { id: currentParentId } : null });
             }
           }
         }
      }

      finalCategoryId = currentParentId;

      // Move Products to the Final Leaf Category
      if (finalCategoryId || isDryRun) {
        for (const prodId of productIds) {
          const prod = products.find((p: any) => p.id === prodId);
          // Skip if already in that category?
          // We can check local cache if we had full product info, but basic check:
          if (prod?.category?.name?.toLowerCase() === parts[parts.length - 1].toLowerCase()) continue;

          if (isDryRun) {
            console.log(`      [DRY RUN] Would move product "${prod?.name}" -> "${pathStr}"`);
          } else {
             if (finalCategoryId && !finalCategoryId.startsWith("dry-run")) {
                await saleorClient.mutation(UPDATE_PRODUCT_CATEGORY_MUTATION, {
                  id: prodId,
                  category: finalCategoryId
                }).toPromise();
             }
          }
        }
      }
    }
  }
});

/**
 * JOB 2: Optimize Hierarchy
 * - looks at all categories
 * - structures them into parents
 * - enriches SEO
 */
export const optimizeCategoryHierarchy = task({
  id: "optimize-category-hierarchy",
  run: async (payload: AnalysisPayload) => {
    const isDryRun = payload.dryRun === true;
    console.log(`🚀 Starting Hierarchy Optimization [LIVE: ${!isDryRun}]`);

    // 1. Fetch All Categories
    const catRes = await saleorClient.query(GET_CATEGORIES_QUERY, {}).toPromise();
    const categories = catRes.data?.categories?.edges?.map((e: any) => e.node) || [];
    const categoryNames = categories.map((c: any) => c.name);
    
    // 2. AI Re-Organization
    console.log(`🤖 Analyzing ${categories.length} categories...`);
    const hierarchy = await optimizeHierarchy(categoryNames);

    // 3. Execution
    for (const [parentName, childrenNames] of Object.entries(hierarchy)) {
      
      // Find or Create Parent
      let parentCategory = categories.find((c: any) => c.name.toLowerCase() === parentName.toLowerCase());
      
      if (!parentCategory) {
         if (isDryRun) {
           console.log(`   [DRY RUN] Would CREATE Parent Category "${parentName}"`);
           parentCategory = { id: "dry-run-parent", name: parentName };
         } else {
           // Create Parent
           const meta = await generateCategorySEO(parentName, []);
           const createRes = await saleorClient.mutation(CREATE_CATEGORY_MUTATION, {
             name: parentName,
             seoTitle: meta.seoTitle,
             seoDesc: meta.seoDescription,
             desc: JSON.stringify({ time: Date.now(), blocks: [{ type: "paragraph", data: { text: meta.description } }] }) 
           }).toPromise();
           
           if (createRes.data?.categoryCreate?.category) {
             parentCategory = { ...createRes.data.categoryCreate.category, name: parentName };
             console.log(`   ✅ Created Parent "${parentName}"`);
           }
         }
      }

      // Reparent Children
      for (const childName of childrenNames) {
        const childCat = categories.find((c: any) => c.name.toLowerCase() === childName.toLowerCase());
        
        if (!childCat) continue;
        if (childCat.parent?.id === parentCategory?.id) continue; // Already correct

        // Cycle Detection:
        // Do not move if the parent we are moving TO is actually the current category itself.
        if (parentCategory.id === childCat.id) continue; 

        if (isDryRun) {
          console.log(`   [DRY RUN] Would move "${childName}" under "${parentName}"`);
        } else {
             // Reparenting is not supported in standard Saleor API v3.x via categoryUpdate
             // await saleorClient.mutation(UPDATE_CATEGORY_PARENT_MUTATION, {
             //   id: childCat.id,
             //   parent: parentCategory.id
             // }).toPromise();
             console.log(`   ⚠️ Skipping move of "${childName}" -> "${parentName}" (Reparenting not supported in layout)`);
        }
      }
    }
  }
});
