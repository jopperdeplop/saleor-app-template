import { SaleorAsyncWebhook } from "@saleor/app-sdk/handlers/next";
import {
  ProductVariantUpdatedDocument,
  ProductVariantUpdatedPayloadFragment,
} from "@/generated/graphql";
import { saleorApp } from "@/saleor-app";

/**
 * Webhook that listens for product variant updates and syncs them to Payload CMS.
 */
export const productVariantUpdatedWebhook = new SaleorAsyncWebhook<ProductVariantUpdatedPayloadFragment>({
  name: "Product Variant Updated",
  webhookPath: "api/webhooks/product-variant-updated",
  event: "PRODUCT_VARIANT_UPDATED",
  apl: saleorApp.apl,
  query: ProductVariantUpdatedDocument,
});

export default productVariantUpdatedWebhook.createHandler(async (req, res, ctx) => {
  const { payload } = ctx;
  const variant = payload.productVariant;

  if (!variant) {
    return res.status(200).json({ skipped: true, reason: "No variant data" });
  }

  console.log(`🔄 [Saleor Webhook] Syncing Variant: ${variant.sku} (${variant.id})`);

  try {
    const payloadApiUrl = process.env.NEXT_PUBLIC_PAYLOAD_API_URL;
    const payloadApiKey = process.env.PAYLOAD_API_KEY; 
    const payloadCollection = "product-variants"; // default slug

    if (!payloadApiUrl) {
      console.error("❌ Missing NEXT_PUBLIC_PAYLOAD_API_URL env var");
      return res.status(500).json({ error: "Configuration error" });
    }

    // Transform Saleor data to Payload schema
    const data = {
      variant_id: variant.id,
      variant_name: variant.name || "",
      product_id: variant.product?.id || "",
      product_name: variant.product?.name || "",
      product_slug: variant.product?.slug || "",
      sku: variant.sku || "",
      channels: variant.channelListings || [],
    };

    // Upsert logic: Use 'create' endpoint. 
    // Ideally, Payload would have an 'upsert' or we check existence first.
    // For MVP, we will try to create. If it conflicts (unique constraint), we should update.
    // However, standard Payload REST create is POST. Update is PATCH ID.
    // We need to know the Payload ID to update.
    
    // Strategy: Search for existing variant by variant_id
    const searchUrl = `${payloadApiUrl}/${payloadCollection}?where[variant_id][equals]=${variant.id}&depth=0`;
    
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (payloadApiKey) {
      headers["Authorization"] = `users API-Key ${payloadApiKey}`;
    }

    const searchRes = await fetch(searchUrl, { headers });
    const searchJson = await searchRes.json();

    let result;
    if (searchJson.docs && searchJson.docs.length > 0) {
      // Update existing
      const existingId = searchJson.docs[0].id;
      console.log(`   📝 Updating existing Payload record: ${existingId}`);
      const updateRes = await fetch(`${payloadApiUrl}/${payloadCollection}/${existingId}`, {
        method: "PATCH",
        headers,
        body: JSON.stringify(data),
      });
      result = await updateRes.json();
    } else {
      // Create new
      console.log(`   ✨ Creating new Payload record`);
      const createRes = await fetch(`${payloadApiUrl}/${payloadCollection}`, {
        method: "POST",
        headers,
        body: JSON.stringify(data),
      });
      result = await createRes.json();
    }

    if (result.errors) {
      console.error("   ❌ Payload Sync Error:", JSON.stringify(result.errors));
      return res.status(500).json({ error: "Sync failed" });
    }

    console.log("   ✅ Sync Successful");
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
