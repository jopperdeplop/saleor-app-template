import {
  require_urql,
  saleorClient
} from "../../../../../chunk-DLK7GY2S.mjs";
import "../../../../../chunk-L34HRTRG.mjs";
import {
  task
} from "../../../../../chunk-ENJ6DR3G.mjs";
import "../../../../../chunk-DEKBIM76.mjs";
import {
  __name,
  __toESM,
  init_esm
} from "../../../../../chunk-CEGEFIIW.mjs";

// src/trigger/category-cleanup.ts
init_esm();
var import_urql = __toESM(require_urql(), 1);
var GET_ALL_CATEGORIES_WITH_COUNTS = import_urql.gql`
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
var DELETE_CATEGORY_MUTATION = import_urql.gql`
  mutation DeleteCategory($id: ID!) {
    categoryDelete(id: $id) {
      errors { field message }
    }
  }
`;
var cleanupEmptyCategories = task({
  id: "cleanup-empty-categories",
  run: /* @__PURE__ */ __name(async (payload) => {
    const isDryRun = payload.dryRun === true;
    console.log(`🧹 Starting Empty Category Cleanup [LIVE: ${!isDryRun}]`);
    const res = await saleorClient.query(GET_ALL_CATEGORIES_WITH_COUNTS, {}).toPromise();
    if (res.error) throw new Error(res.error.message);
    const categories = res.data?.categories?.edges?.map((e) => e.node) || [];
    let deletedCount = 0;
    for (const cat of categories) {
      const childCount = cat.children?.totalCount || 0;
      const productCount = cat.products?.totalCount || 0;
      if (childCount === 0 && productCount === 0) {
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
  }, "run")
});
export {
  cleanupEmptyCategories
};
//# sourceMappingURL=category-cleanup.mjs.map
