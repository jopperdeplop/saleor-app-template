import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import {
  ProductVariantDeletedDocument,
  ProductVariantDeletedPayloadFragment,
} from "@/generated/graphql";
import { saleorApp } from "@/saleor-app";

/**
 * Webhook that listens for product variant deletions and removes them from Payload CMS.
 */
export const productVariantDeletedWebhook = new SaleorAsyncWebhook<ProductVariantDeletedPayloadFragment>({
  name: "Product Variant Deleted",
  webhookPath: "api/webhooks/product-variant-deleted",
  event: "PRODUCT_VARIANT_DELETED",
  apl: saleorApp.apl,
  query: ProductVariantDeletedDocument,
});

export default productVariantDeletedWebhook.createHandler(async (req, res, ctx) => {
  const { payload } = ctx;
  const variant = payload.productVariant;

  if (!variant) {
    return res.status(200).json({ skipped: true, reason: "No variant data" });
  }

  console.log(`🗑️ [Saleor Webhook] Deleting Variant: ${variant.sku} (${variant.id})`);

  try {
    const payloadApiUrl = process.env.NEXT_PUBLIC_PAYLOAD_API_URL;
    const payloadApiKey = process.env.PAYLOAD_API_KEY;
    const payloadCollection = "product-variants";

    if (!payloadApiUrl) {
      console.error("❌ Missing NEXT_PUBLIC_PAYLOAD_API_URL env var");
      return res.status(500).json({ error: "Configuration error" });
    }

    // Strategy: Search for existing variant by variantId to get Payload's internal ID
    const searchUrl = `${payloadApiUrl}/${payloadCollection}?where[variantId][equals]=${variant.id}&depth=0`;

    
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (payloadApiKey) {
      headers["Authorization"] = `users API-Key ${payloadApiKey}`;
    }

    const searchRes = await fetch(searchUrl, { headers });
    const searchJson = await searchRes.json();

    if (searchJson.docs && searchJson.docs.length > 0) {
      const existingId = searchJson.docs[0].id;
      console.log(`   🧨 Deleting Payload record: ${existingId}`);
      
      const deleteRes = await fetch(`${payloadApiUrl}/${payloadCollection}/${existingId}`, {
        method: "DELETE",
        headers,
      });

      if (!deleteRes.ok) {
        const errorText = await deleteRes.text();
        console.error(`   ❌ Payload Delete Error: ${errorText}`);
        return res.status(500).json({ error: "Delete failed" });
      }

      console.log("   ✅ Deletion Successful");
    } else {
      console.log("   🤷 No matching record found in Payload to delete");
    }

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
