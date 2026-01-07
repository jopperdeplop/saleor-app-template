import { schedules } from "@trigger.dev/sdk";
import { translateProduct } from "./translate-product";
import { translateCategory } from "./translate-category";
import { translateCollection } from "./translate-collection";
import { translatePage } from "./translate-page";

export const dailyTranslationSync = schedules.task({
  id: "daily-translation-sync",
  cron: "0 2 * * *", // 2 AM daily
  run: async () => {
    const apiUrl = process.env.SALEOR_API_URL;
    let saleorToken = (process.env.SALEOR_APP_TOKEN || process.env.SALEOR_TOKEN || "").trim();
    if (!apiUrl || !saleorToken) return;

    saleorToken = `Bearer ${saleorToken.replace(/^bearer\s+/i, "")}`;

    const saleorFetch = async (query: string, variables: any = {}) => {
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Authorization': saleorToken, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables })
      });
      return await res.json();
    };

    // Pagination Helper
    async function exampleScan(
      queryName: string, 
      queryBody: string, 
      rootField: string, 
      callback: (node: any) => Promise<void>
    ) {
      let hasNextPage = true;
      let after = null;
      
      console.log(`🔎 Starting scan for ${rootField}...`);

      while (hasNextPage) {
        const query = `
          query ${queryName}($after: String) {
            ${rootField}(first: 50, after: $after) {
              edges { node { ${queryBody} } }
              pageInfo { hasNextPage endCursor }
            }
          }
        `;
        const res = await saleorFetch(query, { after });
        const data = res.data?.[rootField];
        
        if (!data) break;

        for (const edge of data.edges || []) {
           await callback(edge.node);
        }

        hasNextPage = data.pageInfo?.hasNextPage;
        after = data.pageInfo?.endCursor;
      }
      console.log(`✅ Completed scan for ${rootField}.`);
    }

    // 1. Products
    await exampleScan(
      "ScanProducts",
      "id privateMetadata { key value } translations { language { code } }",
      "products",
      async (node) => {
        const hasHash = node.privateMetadata.some((m: any) => m.key === "translation_hash_v1");
        // Always trigger if missing translations, or if hash missing.
        // Even if hash checks out, triggering it allows the child task to verify content integrity.
        // We log 'Queuing' here.
        if (!hasHash || node.translations.length < 15) {
             console.log(`   Queuing Product: ${node.id}`);
             await translateProduct.trigger({ productId: node.id });
        }
      }
    );

    // 2. Categories
    await exampleScan("ScanCategories", "id", "categories", async (node) => {
        await translateCategory.trigger({ categoryId: node.id });
    });

    // 3. Collections
    await exampleScan("ScanCollections", "id", "collections", async (node) => {
        await translateCollection.trigger({ collectionId: node.id });
    });

    // 4. Pages (Models)
    await exampleScan("ScanPages", "id", "pages", async (node) => {
        await translatePage.trigger({ pageId: node.id });
    });

    // 5. Attributes
    const { translateAttribute } = await import("./translate-attribute");
    await exampleScan("ScanAttributes", "id", "attributes", async (node) => {
        await translateAttribute.trigger({ attributeId: node.id });
    });
    
    // 6. Shipping Methods (via Shipping Zones)
    const { translateShippingMethod } = await import("./translate-shipping-method");
    await exampleScan("ScanShippingZones", "shippingMethods { id }", "shippingZones", async (node) => {
        for (const method of node.shippingMethods || []) {
            await translateShippingMethod.trigger({ shippingMethodId: method.id });
        }
    });

    // 7. Menu Items (via Menus)
    const { translateMenuItem } = await import("./translate-menu-item");
    await exampleScan("ScanMenus", "items { id children { id children { id } } }", "menus", async (node) => {
        const traverse = async (items: any[]) => {
            for (const item of items) {
                await translateMenuItem.trigger({ menuItemId: item.id });
                if (item.children) await traverse(item.children);
            }
        };
        if (node.items) await traverse(node.items);
    });

    return { status: "Sync tasks queued" };
  }
});
