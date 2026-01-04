import { task } from "@trigger.dev/sdk";
import { saleorClient } from "@/lib/saleor-client";
import { gql } from "urql";

export const PUBLISH_ALL_PRODUCTS_MUTATION = gql`
  mutation ProductChannelListingUpdate($id: ID!, $input: ProductChannelListingUpdateInput!) {
    productChannelListingUpdate(id: $id, input: $input) {
      errors {
        field
        message
      }
    }
  }
`;

export const GET_ALL_PRODUCTS_AND_CHANNELS = gql`
  query GetAllProducts($after: String) {
    channels {
      id
      slug
    }
    products(first: 100, after: $after) {
      pageInfo {
        hasNextPage
        endCursor
      }
      edges {
        node {
          id
          name
          channelListings {
            channel {
              id
            }
            isPublished
          }
        }
      }
    }
  }
`;

export const publishAllProducts = task({
  id: "publish-all-products",
  run: async (payload: { dryRun?: boolean }) => {
    const isDryRun = payload.dryRun === true;
    console.log(`🚀 Starting Global Product Publish [LIVE: ${!isDryRun}]`);

    // 1. Get All Channels
    // We need to know which channels exist to publish to them.
    // The query fetches channels along with products, but we only need channels once.
    let channels: any[] = [];
    
    let hasNextPage = true;
    let endCursor = null;
    let totalProcessed = 0;

    while (hasNextPage) {
      console.log(`   🔄 Fetching batch of products...`);
      const res: any = await saleorClient
        .query(GET_ALL_PRODUCTS_AND_CHANNELS, { after: endCursor })
        .toPromise();

      if (res.error) throw new Error(res.error.message);

      if (channels.length === 0) {
        channels = res.data.channels;
        console.log(`   Found ${channels.length} channels: ${channels.map((c: any) => c.slug).join(", ")}`);
      }

      const products = res.data.products.edges.map((e: any) => e.node);
      hasNextPage = res.data.products.pageInfo.hasNextPage;
      endCursor = res.data.products.pageInfo.endCursor;

      // 2. Process Batch
      for (const product of products) {
        // Construct the update input: enable for ALL system channels
        const updateChannelsInput = channels.map((ch: any) => ({
          channelId: ch.id,
          isPublished: true,
          isAvailableForPurchase: true,
          visibleInListings: true,
          // Set available date to specific time in past to ensure immediate availability
          availableForPurchaseAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() 
        }));

        if (isDryRun) {
          console.log(`   [DRY RUN] Would publish "${product.name}" (${product.id}) to ${channels.length} channels.`);
        } else {
          const updateRes = await saleorClient
            .mutation(PUBLISH_ALL_PRODUCTS_MUTATION, {
              id: product.id,
              input: { updateChannels: updateChannelsInput },
            })
            .toPromise();

          if (updateRes.error || updateRes.data?.productChannelListingUpdate?.errors?.length > 0) {
            console.error(
              `   ❌ Failed to publish "${product.name}"`,
              updateRes.error || updateRes.data?.productChannelListingUpdate?.errors
            );
          } else {
            console.log(`   ✅ Published "${product.name}"`);
          }
        }
      }
      totalProcessed += products.length;
    }

    console.log(`🏁 Complete. Processed ${totalProcessed} products.`);
  },
});
