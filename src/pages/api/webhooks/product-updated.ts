import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import {
  ProductUpdatedDocument,
  ProductUpdatedPayloadFragment,
} from "@/generated/graphql";
import { saleorApp } from "@/saleor-app";

/**
 * Webhook that listens for product updates and syncs all its variants to Payload CMS.
 */
export const productUpdatedWebhook = new SaleorAsyncWebhook<ProductUpdatedPayloadFragment>({
  name: "Product Updated Sync",
  webhookPath: "api/webhooks/product-updated",
  event: "PRODUCT_UPDATED",
  apl: saleorApp.apl,
  query: ProductUpdatedDocument,
});

export default productUpdatedWebhook.createHandler(async (req, res, ctx) => {
  console.log("📥 [Webhook] Product Updated call received");
  const { payload } = ctx;
  const product = payload.product;

  if (!product || !product.variants) {
    return res.status(200).json({ skipped: true, reason: "No product or variant data" });
  }

  console.log(`🔄 [Saleor Webhook] Syncing Product: ${product.name} (Variants: ${product.variants.length})`);

  try {
    const payloadApiUrl = process.env.NEXT_PUBLIC_PAYLOAD_API_URL;
    const payloadApiKey = process.env.PAYLOAD_API_KEY;
    const payloadCollection = "product-variants";

    if (!payloadApiUrl) {
      console.error("❌ Missing NEXT_PUBLIC_PAYLOAD_API_URL env var");
      return res.status(500).json({ error: "Configuration error" });
    }

    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (payloadApiKey) {
      headers["Authorization"] = `users API-Key ${payloadApiKey}`;
    }

    // Sync each variant
    for (const variant of product.variants) {
      const data = {
        variantId: variant.id,
        variantName: variant.name || "",
        productId: product.id,
        productName: product.name,
        productSlug: product.slug,
        sku: variant.sku || "",
        channels: variant.channelListings || [],
      };

      // Search for existing
      const searchUrl = `${payloadApiUrl}/${payloadCollection}?where[variantId][equals]=${variant.id}&depth=0`;
      const searchRes = await fetch(searchUrl, { headers });
      const searchJson = await searchRes.json();

      if (searchJson.docs && searchJson.docs.length > 0) {
        const existingId = searchJson.docs[0].id;
        await fetch(`${payloadApiUrl}/${payloadCollection}/${existingId}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify(data),
        });
      } else {
        await fetch(`${payloadApiUrl}/${payloadCollection}`, {
          method: "POST",
          headers,
          body: JSON.stringify(data),
        });
      }
    }

    console.log("   ✅ Product variants sync successful");
    return res.status(200).json({ success: true });

  } catch (error) {
    console.error("   ❌ Webhook Handler Error:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

export const config = {
  api: {
    bodyParser: false,
  },
};
