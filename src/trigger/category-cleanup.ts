import { task } from "@trigger.dev/sdk";
import { saleorClient } from "@/lib/saleor-client";
import { gql } from "urql";

// --- QUERIES ---

const GET_ALL_CATEGORIES_WITH_COUNTS = gql`
  query GetCategoriesForCleanup {
    categories(first: 100) {
      edges { 
        node { 
          id 
          name 
          children(first: 1) { totalCount }
          products(first: 1) { totalCount }
        } 
      }
    }
  }
`;

const DELETE_CATEGORY_MUTATION = gql`
  mutation DeleteCategory($id: ID!) {
    categoryDelete(id: $id) {
      errors { field message }
    }
  }
`;

// --- JOB ---

export const cleanupEmptyCategories = task({
  id: "cleanup-empty-categories",
  run: async (payload: { dryRun?: boolean }) => {
    // Live by default
    const isDryRun = payload.dryRun === true;
    
    console.log(`🧹 Starting Empty Category Cleanup [LIVE: ${!isDryRun}]`);

    const res = await saleorClient.query(GET_ALL_CATEGORIES_WITH_COUNTS, {}).toPromise();
    if (res.error) throw new Error(res.error.message);

    const categories = res.data?.categories?.edges?.map((e: any) => e.node) || [];

    let deletedCount = 0;

    for (const cat of categories) {
      const childCount = cat.children?.totalCount || 0;
      const productCount = cat.products?.totalCount || 0;

      // RULE: Only delete if 0 children AND 0 products
      if (childCount === 0 && productCount === 0) {
        
        // EXCEPTION: Check allowlist or age if possible (not implemented here without modification time in schema)
        // For now, strict empty check is safe enough for "Cleanup".
        
        if (isDryRun) {
           console.log(`   [DRY RUN] Would DELETE empty category: "${cat.name}" (${cat.id})`);
        } else {
           const del = await saleorClient.mutation(DELETE_CATEGORY_MUTATION, { id: cat.id }).toPromise();
           if (del.error || del.data?.categoryDelete?.errors?.length > 0) {
             console.error(`   ❌ Failed to delete "${cat.name}"`, del.error || del.data?.categoryDelete?.errors);
           } else {
             console.log(`   🗑️ DELETED "${cat.name}"`);
             deletedCount++;
           }
        }
      }
    }

    console.log(`✅ Cleanup Complete. Deleted: ${deletedCount}`);
  }
});
