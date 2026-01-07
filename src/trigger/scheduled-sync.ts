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

    // 1. Sync Products (example: first 50)
    const productRes = await saleorFetch(`
      query GetIncompleteProducts {
        products(first: 50) {
          edges {
            node {
              id
              translations { language { code } }
              privateMetadata { key value }
            }
          }
        }
      }
    `);

    for (const edge of productRes.data?.products?.edges || []) {
      const node = edge.node;
      const hasHash = node.privateMetadata.some((m: any) => m.key === "translation_hash_v1");
      const isMissingTranslations = node.translations.length < 15;
      
      if (!hasHash || isMissingTranslations) {
        await translateProduct.trigger({ productId: node.id });
      }
    }

    // 2. Sync Categories
    const categoryRes = await saleorFetch(`
      query GetCategories {
        categories(first: 50) {
          edges {
            node {
              id
              privateMetadata { key value }
            }
          }
        }
      }
    `);

    for (const edge of categoryRes.data?.categories?.edges || []) {
       await translateCategory.trigger({ categoryId: edge.node.id });
    }

    // Repeat for Collections and Pages...
    const collectionRes = await saleorFetch(`query{ collections(first:50){ edges{node{id}} } }`);
    for (const edge of collectionRes.data?.collections?.edges || []) {
       await translateCollection.trigger({ collectionId: edge.node.id });
    }
    
    const pageRes = await saleorFetch(`query{ pages(first:50){ edges{node{id}} } }`);
    for (const edge of pageRes.data?.pages?.edges || []) {
       await translatePage.trigger({ pageId: edge.node.id });
    }

    // 3. Sync Attributes
    const { translateAttribute } = await import("./translate-attribute");
    const attrRes = await saleorFetch(`query{ attributes(first:100){ edges{node{id}} } }`);
    for (const edge of attrRes.data?.attributes?.edges || []) {
       await translateAttribute.trigger({ attributeId: edge.node.id });
    }

    return { status: "Sync tasks queued" };
  }
});
