import { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';
import fetch from 'node-fetch';
import { GoogleGenerativeAI } from "@google/generative-ai";

export const config = { api: { bodyParser: false } };

// --- HELPERS ---

async function getRawBody(req: NextApiRequest): Promise<Buffer> {
    const chunks = [];
    for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    return Buffer.concat(chunks);
}

function textToEditorJs(text: string) {
    const cleanText = text ? text.replace(/\n/g, "<br>") : "";
    return JSON.stringify({
        time: Date.now(),
        blocks: [{ type: "paragraph", data: { text: cleanText } }],
        version: "2.25.0"
    });
}

function slugify(text: string | null | undefined) {
    if (!text) return '';
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-');
}

function calculateContentHash(p: any) {
    const imageString = p.images?.map((img: any) => img.src).join('') || '';
    const content = (p.title || '') + (p.body_html || '') + imageString;
    return crypto.createHash('md5').update(content).digest('hex');
}

// --- AI GENERATION ---

async function generateSalpContent(shopifyProduct: any) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn("   ⚠️ No GEMINI_API_KEY found. Skipping AI generation.");
        return null;
    }

    const images = shopifyProduct.images || [];
    if (images.length === 0) {
        console.warn("   ⚠️ No images found for AI analysis. Skipping.");
        return null;
    }

    console.log(`   🧠 AI Analyzing "${shopifyProduct.title}"...`);

    try {
        const imageParts = [];
        for (const img of images.slice(0, 3)) {
            const imgRes = await fetch(img.src);
            const imgBuffer = await imgRes.arrayBuffer();
            imageParts.push({
                inlineData: {
                    data: Buffer.from(imgBuffer).toString("base64"),
                    mimeType: "image/jpeg",
                },
            });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-09-2025" });

        const prompt = `
        You are the Curator for 'Salp', a European design store.
        Role: Transform generic supplier data into 'Slow Life' editorial content.
        TONE: Industrial, functional, clean. Avoid marketing fluff. Use "robust", "tactile".
        
        TASK:
        1. Analyze the provided images and product specs.
        2. Write a 2-paragraph description.
        3. Generate SEO Title & Description.
        
        STRICT RULE: Do not hallucinate. Output only JSON.
        JSON OUTPUT FORMAT:
        {
          "description": "string (2 paragraphs, double newline)",
          "seo_title": "string",
          "seo_description": "string"
        }`;

        const result = await model.generateContent([
            prompt,
            ...imageParts,
            `RAW TITLE: ${shopifyProduct.title}\nRAW DESC: ${shopifyProduct.body_html || ''}`
        ]);

        const response = await result.response;
        const text = response.text();
        const jsonString = text.replace(/```json\n?|```/g, "").trim();
        const data = JSON.parse(jsonString);

        console.log(`   ✅ AI Generated Description`);
        return data;

    } catch (error) {
        console.error("   ❌ AI Generation Failed:", error);
        return null;
    }
}

// --- SALEOR INTERACTIONS ---

async function getSaleorChannels() {
    const query = `{ channels { id slug currencyCode isActive } }`;
    const res = await fetch(process.env.SALEOR_API_URL!, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': process.env.SALEOR_TOKEN!
        },
        body: JSON.stringify({ query })
    });
    const json: any = await res.json();
    return json.data?.channels || [];
}

async function getSaleorProductDetails(slug: string) {
    const query = `
      query($slug: String!) {
        product(slug: $slug) {
          id
          name
          description
          media { id url }
          metadata { key value }
        }
      }
    `;
    const res = await fetch(process.env.SALEOR_API_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': process.env.SALEOR_TOKEN! },
        body: JSON.stringify({ query, variables: { slug } })
    });
    const json: any = await res.json();
    return json.data?.product || null;
}

async function findSaleorProductByShopifyId(shopifyId: number) {
    const searchString = String(shopifyId);
    const metaQuery = `
      query($shopifyId: String!) {
        products(filter: { metadata: { key: "shopify_id", value: $shopifyId } }, first: 1) {
          edges { node { id } }
        }
      }
    `;
    try {
        const metaRes = await fetch(process.env.SALEOR_API_URL!, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': process.env.SALEOR_TOKEN! },
            body: JSON.stringify({ query: metaQuery, variables: { shopifyId: searchString } })
        });
        const metaJson: any = await metaRes.json();
        const metaId = metaJson.data?.products?.edges?.[0]?.node?.id;
        if (metaId) return metaId;
    } catch (e) { /* ignore */ }

    const searchQuery = `
      query($search: String!) {
        products(filter: { search: $search }, first: 5) {
          edges { node { id, slug } }
        }
      }
    `;
    const res = await fetch(process.env.SALEOR_API_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': process.env.SALEOR_TOKEN! },
        body: JSON.stringify({ query: searchQuery, variables: { search: searchString } })
    });
    const json: any = await res.json();
    const edges = json.data?.products?.edges || [];
    const match = edges.find((e: any) => e.node.slug.endsWith(`-${shopifyId}`));
    return match ? match.node.id : null;
}

async function deleteSaleorProduct(id: string) {
    console.log(`   🗑️  Deleting Saleor Product: ${id}`);
    const query = `
      mutation ProductDelete($id: ID!) {
        productDelete(id: $id) { errors { field message } }
      }
    `;
    await fetch(process.env.SALEOR_API_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': process.env.SALEOR_TOKEN! },
        body: JSON.stringify({ query, variables: { id } })
    });
}

async function updateProductMetadata(id: string, metadata: { key: string, value: string }[]) {
    const query = `
    mutation UpdateMeta($id: ID!, $input: [MetadataInput!]!) {
        updateMetadata(id: $id, input: $input) {
            errors { field message }
        }
    }`;
    await fetch(process.env.SALEOR_API_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': process.env.SALEOR_TOKEN! },
        body: JSON.stringify({
            query,
            variables: { id, input: metadata }
        })
    });
}

// MAIN SYNC LOGIC
async function syncProductToSaleor(shopifyPayload: any) {
    const channels = await getSaleorChannels();
    const p = shopifyPayload;
    const deterministicSlug = `${slugify(p.title)}-${p.id}`;
    const shopifyIdStr = String(p.id);
    const incomingHash = calculateContentHash(p);

    console.log(`   🔄 Processing "${p.title}"...`);

    // 1. Fetch Existing Saleor Data
    const existingProduct = await getSaleorProductDetails(deterministicSlug);
    let productId = existingProduct?.id;
    let isNewProduct = !productId;
    let skipHeavySync = false; // New flag to handle race conditions

    // 2. Check Hash to avoid redundant AI/Content Updates
    let shouldUpdateContent = false;

    if (isNewProduct) {
        console.log(`   ✨ New Product Detected.`);
        shouldUpdateContent = true;
    } else {
        const storedHash = existingProduct.metadata?.find((m: any) => m.key === "content_hash")?.value;

        if (storedHash === incomingHash) {
            console.log(`   ✅ Content matches (Hash: ${incomingHash.substring(0, 6)}). Skipping AI & Content Update.`);
            shouldUpdateContent = false;
        } else {
            console.log(`   📝 Content changed (Hash mismatch). Triggering AI & Content Update.`);
            shouldUpdateContent = true;
        }
    }

    // 3. Prepare Data
    let finalName = p.title;
    let finalDescription = textToEditorJs(p.body_html || p.title);
    let finalSeo = { title: p.title, description: "" };

    if (shouldUpdateContent) {
        // Only run AI if we are about to Create or Update Content
        const aiContent = await generateSalpContent(p);
        if (aiContent) {
            finalDescription = textToEditorJs(aiContent.description);
            finalSeo = {
                title: aiContent.seo_title,
                description: aiContent.seo_description
            };
        }
    }

    const metadataToSave = [
        { key: "shopify_id", value: shopifyIdStr },
        { key: "content_hash", value: incomingHash }
    ];

    // 4. Create or Update Container
    if (isNewProduct) {
        const createQuery = `
        mutation CreateProduct($input: ProductCreateInput!) {
            productCreate(input: $input) {
                product { id }
                errors { field message }
            }
        }`;
        const createVars = {
            input: {
                name: finalName,
                slug: deterministicSlug,
                productType: process.env.SALEOR_PRODUCT_TYPE_ID,
                category: process.env.SALEOR_CATEGORY_ID,
                description: finalDescription,
                seo: finalSeo,
                metadata: metadataToSave
            }
        };

        const createRes = await fetch(process.env.SALEOR_API_URL!, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': process.env.SALEOR_TOKEN! },
            body: JSON.stringify({ query: createQuery, variables: createVars })
        });
        const createJson: any = await createRes.json();
        const createErrors = createJson.data?.productCreate?.errors || [];

        if (createJson.data?.productCreate?.product?.id) {
            productId = createJson.data.productCreate.product.id;
        } else {
            // RACE CONDITION HANDLING
            const isSlugError = createErrors.some((e: any) => e.field === 'slug');

            if (isSlugError) {
                console.log("   ⚠️ Race Condition Detected: Product created by another process. Skipping heavy sync.");
                // Fetch ID to allow variant sync, but skip everything else
                const winner = await getSaleorProductDetails(deterministicSlug);
                productId = winner?.id;
                skipHeavySync = true; // STOP here for this process
            } else {
                console.error("   ❌ Create Failed:", JSON.stringify(createErrors));
                return;
            }
        }

    } else if (shouldUpdateContent) {
        console.log(`   ✏️  Applying Content Updates to Saleor...`);
        await updateProductMetadata(productId, metadataToSave);

        const updateQuery = `
        mutation UpdateProduct($id: ID!, $input: ProductInput!) {
            productUpdate(id: $id, input: $input) {
                errors { field message }
            }
        }`;
        await fetch(process.env.SALEOR_API_URL!, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': process.env.SALEOR_TOKEN! },
            body: JSON.stringify({
                query: updateQuery,
                variables: {
                    id: productId,
                    input: {
                        name: finalName,
                        description: finalDescription,
                        seo: finalSeo
                    }
                }
            })
        });
    }

    // 5. MEDIA SYNC (Only if content update required AND we didn't lose a race)
    if (shouldUpdateContent && !skipHeavySync) {
        const shopifyImages = p.images || [];
        const currentMediaCount = existingProduct?.media?.length || 0;

        if (shopifyImages.length > 0) {
            if (currentMediaCount === 0) {
                console.log(`   📸 Uploading ${shopifyImages.length} images...`);
                const mediaQuery = `
                mutation ProductMediaCreate($product: ID!, $image: String!, $alt: String) {
                    productMediaCreate(input: { product: $product, mediaUrl: $image, alt: $alt }) { media { id } }
                }`;
                for (const img of shopifyImages) {
                    if (img.src) {
                        await fetch(process.env.SALEOR_API_URL!, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': process.env.SALEOR_TOKEN! },
                            body: JSON.stringify({
                                query: mediaQuery,
                                variables: { product: productId, image: img.src, alt: img.alt || "" }
                            })
                        });
                    }
                }
            } else {
                console.log(`   ⏭️  Media exists. Skipping upload.`);
            }
        }
    }

    // 6. PUBLISH (Only if New or Content Changed AND no race lost)
    if (shouldUpdateContent && !skipHeavySync) {
        const dateStr = new Date().toISOString().split('T')[0];
        const listingUpdateVars = {
            product: productId,
            input: {
                updateChannels: channels.map((ch: any) => ({
                    channelId: ch.id,
                    isPublished: true,
                    publicationDate: dateStr,
                    isAvailableForPurchase: true,
                    visibleInListings: true
                }))
            }
        };
        const listingQuery = `
        mutation UpdateChannelListing($product: ID!, $input: ProductChannelListingUpdateInput!) {
            productChannelListingUpdate(id: $product, input: $input) { errors { field message } }
        }`;
        await fetch(process.env.SALEOR_API_URL!, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': process.env.SALEOR_TOKEN! },
            body: JSON.stringify({ query: listingQuery, variables: listingUpdateVars })
        });
    }

    // 7. VARIANT & STOCK SYNC (ALWAYS RUN if we have an ID)
    if (productId) {
        for (const v of p.variants) {
            await ensureVariantExists(productId, v, channels);
        }
    }
}

async function ensureVariantExists(prodId: string, v: any, channels: any[]) {
    const sku = v.sku || `IMP-${v.id}`;
    const price = parseFloat(v.price);
    let stock = v.inventory_quantity;
    if (stock < 3) stock = 0;

    const createQuery = `
    mutation CreateVariant($input: ProductVariantCreateInput!) {
        productVariantCreate(input: $input) {
            productVariant { id }
            errors { field message }
        }
    }`;

    const vars = {
        input: {
            product: prodId,
            sku: sku,
            attributes: [],
            trackInventory: true,
            stocks: [{
                warehouse: process.env.SALEOR_WAREHOUSE_ID,
                quantity: stock
            }]
        }
    };

    const res = await fetch(process.env.SALEOR_API_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': process.env.SALEOR_TOKEN! },
        body: JSON.stringify({ query: createQuery, variables: vars })
    });
    const json: any = await res.json();

    let variantId = json.data?.productVariantCreate?.productVariant?.id;
    const errors = json.data?.productVariantCreate?.errors || [];

    if (!variantId && errors.some((e: any) => e.field === 'sku')) {
        return;
    }

    if (!variantId) return;

    const priceQuery = `
    mutation UpdateVariantChannelListing($id: ID!, $input: [ProductVariantChannelListingAddInput!]!) {
        productVariantChannelListingUpdate(id: $id, input: $input) { errors { field message } }
    }`;
    const priceVars = {
        id: variantId,
        input: channels.map((ch: any) => ({
            channelId: ch.id,
            price: price,
            costPrice: price
        }))
    };
    await fetch(process.env.SALEOR_API_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': process.env.SALEOR_TOKEN! },
        body: JSON.stringify({ query: priceQuery, variables: priceVars })
    });
    console.log(`      ✅ Variant ${sku} created.`);
}

// --- MAIN HANDLER ---

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    try {
        const rawBody = await getRawBody(req);
        const hmac = req.headers['x-shopify-hmac-sha256'];
        const topic = req.headers['x-shopify-topic'] || 'unknown';
        const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

        if (secret && hmac) {
            const hash = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
            if (hash !== hmac) {
                console.error("❌ Security: Invalid Signature");
                return res.status(401).send('Forbidden');
            }
        }

        const payload = JSON.parse(rawBody.toString());
        console.log(`\n🔔 Webhook Received: ${topic}`);

        switch (topic) {
            case 'products/delete':
                console.log(`   🗑️  Processing Delete for Shopify ID: ${payload.id}`);
                const delId = await findSaleorProductByShopifyId(payload.id);
                if (delId) {
                    await deleteSaleorProduct(delId);
                    console.log("   ✅ Product Deleted from Saleor.");
                } else {
                    console.log("   ⚠️ Product not found in Saleor.");
                }
                break;

            case 'products/create':
            case 'products/update':
                await syncProductToSaleor(payload);
                console.log("✅ Synced to Saleor.");
                break;

            default:
                console.log("ℹ️ Unhandled Topic");
        }

        res.status(200).send('Handled');

    } catch (error) {
        console.error("❌ Error:", error);
        res.status(500).send('Error');
    }
}