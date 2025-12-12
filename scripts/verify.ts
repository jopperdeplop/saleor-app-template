import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

// --- CONFIGURATION ---
// We use the NEW Attribute ID from your successful diagnostic run
// You should also update this in your .env file
const NEW_BRAND_ATTRIBUTE_ID = "QXR0cmlidXRlOjQ0MQ==";

const TEST_BRAND_NAME = "Integration Test Brand";
const TEST_PRODUCT_NAME = "Integration Test Product";

const SALEOR_URL = process.env.SALEOR_API_URL!;
const SALEOR_HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': process.env.SALEOR_TOKEN!
};
const BRAND_MODEL_TYPE_ID = process.env.SALEOR_BRAND_MODEL_TYPE_ID!;
const PRODUCT_TYPE_ID = process.env.SALEOR_PRODUCT_TYPE_ID!;

async function saleorFetch(query: string, variables: any = {}): Promise<any> {
    const res = await fetch(SALEOR_URL, {
        method: 'POST',
        headers: SALEOR_HEADERS,
        body: JSON.stringify({ query, variables })
    });
    const json: any = await res.json();
    if (json.errors) {
        console.error("❌ API ERROR:", JSON.stringify(json.errors, null, 2));
        throw new Error("API Error");
    }
    return json;
}

async function runIntegrationTest() {
    console.log("🧪 STARTING INTEGRATION TEST");
    console.log("----------------------------------------");

    // 1. Create/Get Brand Page
    console.log(`\n[1/4] Preparing Brand Page: "${TEST_BRAND_NAME}"...`);
    const findPageQuery = `query Find($search: String!) { pages(filter: {search: $search}, first: 1) { edges { node { id } } } }`;
    let pageData = await saleorFetch(findPageQuery, { search: TEST_BRAND_NAME });
    let pageId = pageData.data.pages.edges[0]?.node?.id;

    if (!pageId) {
        const createPageQuery = `
        mutation CreatePage($type: ID!, $title: String!) {
            pageCreate(input: { title: $title, pageType: $type, isPublished: true, content: "{}" }) {
                page { id }
                errors { field message }
            }
        }`;
        const createData = await saleorFetch(createPageQuery, { type: BRAND_MODEL_TYPE_ID, title: TEST_BRAND_NAME });
        pageId = createData.data.pageCreate.page.id;
        console.log(`   ✅ Created New Brand Page: ${pageId}`);
    } else {
        console.log(`   ✅ Found Existing Brand Page: ${pageId}`);
    }

    // 2. Create/Get Product
    console.log(`\n[2/4] Preparing Product: "${TEST_PRODUCT_NAME}"...`);
    const findProdQuery = `query Find($search: String!) { products(filter: {search: $search}, first: 1) { edges { node { id } } } }`;
    let prodData = await saleorFetch(findProdQuery, { search: TEST_PRODUCT_NAME });
    let prodId = prodData.data.products.edges[0]?.node?.id;

    if (!prodId) {
        const createProdQuery = `
        mutation CreateProd($type: ID!, $name: String!) {
            productCreate(input: { name: $name, productType: $type }) {
                product { id }
                errors { field message }
            }
        }`;
        const createData = await saleorFetch(createProdQuery, { type: PRODUCT_TYPE_ID, name: TEST_PRODUCT_NAME });
        prodId = createData.data.productCreate.product.id;
        console.log(`   ✅ Created New Product: ${prodId}`);
    } else {
        console.log(`   ✅ Found Existing Product: ${prodId}`);
    }

    // 3. Perform Assignment (The Real Test)
    console.log(`\n[3/4] Linking Brand to Product using New Attribute...`);
    console.log(`   Attribute ID: ${NEW_BRAND_ATTRIBUTE_ID}`);
    console.log(`   Page ID:      ${pageId}`);

    const updateQuery = `
    mutation UpdateProduct($id: ID!, $input: ProductInput!) {
        productUpdate(id: $id, input: $input) {
            product {
                id
                attributes {
                    attribute { id }
                    values { name reference }
                }
            }
            errors { field message }
        }
    }`;

    const payload = {
        id: prodId,
        input: {
            attributes: [{
                id: NEW_BRAND_ATTRIBUTE_ID,
                references: [pageId] // Plural 'references' + Array
            }]
        }
    };

    const updateData = await saleorFetch(updateQuery, payload);
    const result = updateData.data.productUpdate;

    if (result.errors.length > 0) {
        console.error(`   ❌ LINK FAILED:`, JSON.stringify(result.errors));
        return;
    }

    // 4. Verification
    console.log(`\n[4/4] Verifying Connection...`);
    const attr = result.product.attributes.find((a: any) => a.attribute.id === NEW_BRAND_ATTRIBUTE_ID);

    if (attr && attr.values.length > 0) {
        console.log(`   ✅✅✅ SUCCESS! Connection Established.`);
        console.log(`   Product Attribute Value: "${attr.values[0].name}"`);
        console.log(`   Referenced Page ID:      "${attr.values[0].reference}"`);
        console.log(`\n   You are ready to run your main 'importer.ts' script.`);
    } else {
        console.error(`   ❌ SILENT FAILURE. Attribute is empty.`);
    }
}

runIntegrationTest();