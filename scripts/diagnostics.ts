import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

// --- CONFIGURATION ---
// ✏️ EDIT THESE TO MATCH THE PRODUCT YOU ARE DEBUGGING
const TEST_PRODUCT_NAME = "The Minimal Snowboard";
const TEST_BRAND_NAME = "SaleorDevelopmentStore";

const SALEOR_URL = process.env.SALEOR_API_URL!;
const SALEOR_HEADERS = { 
    'Content-Type': 'application/json', 
    'Authorization': process.env.SALEOR_TOKEN! 
};

// We will fetch these dynamically or use from env
const EXPECTED_PAGE_TYPE_ID = process.env.SALEOR_BRAND_MODEL_TYPE_ID!;

// --- HELPER ---
async function saleorFetch(query: string, variables: any = {}) {
    const res = await fetch(SALEOR_URL, {
        method: 'POST',
        headers: SALEOR_HEADERS,
        body: JSON.stringify({ query, variables })
    });
    return await res.json();
}

async function runDiagnostic() {
    console.log(`\n🕵️  STARTING REPLACEMENT FIX`);
    console.log(`    Product: "${TEST_PRODUCT_NAME}"`);
    console.log("--------------------------------------------------");

    // ---------------------------------------------------------
    // STEP 1: INSPECT PRODUCT & GET TYPE ID
    // ---------------------------------------------------------
    console.log("\n[1/6] Inspecting Product...");
    const prodQuery = `
    query Prod($search: String!) {
        products(filter: { search: $search }, first: 1) {
            edges { 
                node { 
                    id 
                    name 
                    productType { 
                        id 
                        name 
                    }
                } 
            }
        }
    }`;
    const prodData = await saleorFetch(prodQuery, { search: TEST_PRODUCT_NAME });
    const prodNode = prodData.data?.products?.edges?.[0]?.node;

    if (!prodNode) {
        console.error("❌ CRITICAL: Product not found.");
        return;
    }
    const productTypeId = prodNode.productType.id;
    console.log(`   ✅ Product Found: "${prodNode.name}"`);
    console.log(`      Product Type ID: ${productTypeId}`);

    // ---------------------------------------------------------
    // STEP 2: CREATE TEMP PAGE
    // ---------------------------------------------------------
    console.log("\n[2/6] Creating TEMPORARY Brand Page...");
    const createPageQuery = `
    mutation CreatePage($type: ID!) {
        pageCreate(input: { title: "DIAGNOSTIC_TEST_BRAND", pageType: $type, isPublished: true, content: "{}" }) {
            page { id title pageType { id name } }
            errors { field message }
        }
    }`;
    
    const createData = await saleorFetch(createPageQuery, { type: EXPECTED_PAGE_TYPE_ID });
    const tempPage = createData.data?.pageCreate?.page;
    
    if (!tempPage) {
        console.error("❌ FAILED TO CREATE TEMP PAGE:");
        console.error(JSON.stringify(createData.data?.pageCreate?.errors));
        return;
    }
    console.log(`   ✅ Created Temp Page: "${tempPage.title}" (${tempPage.id})`);

    // ---------------------------------------------------------
    // STEP 3: CREATE NEW "CORRECT" ATTRIBUTE
    // ---------------------------------------------------------
    console.log("\n[3/6] 🛠️  CREATING REPLACEMENT ATTRIBUTE...");
    // Random suffix to avoid slug collisions
    const suffix = Math.floor(Math.random() * 1000); 
    const newAttrName = `Brand (Fixed ${suffix})`;
    const newAttrSlug = `brand-fixed-${suffix}`;

    const createAttrQuery = `
    mutation CreateAttr($name: String!, $slug: String!) {
        attributeCreate(input: {
            name: $name,
            slug: $slug,
            inputType: REFERENCE,
            entityType: PAGE,
            type: PRODUCT_TYPE,
            valueRequired: false
        }) {
            attribute { id name slug }
            errors { field message }
        }
    }`;

    const createAttrData = await saleorFetch(createAttrQuery, { name: newAttrName, slug: newAttrSlug });
    const newAttr = createAttrData.data?.attributeCreate?.attribute;

    if (!newAttr) {
        console.error("❌ FAILED TO CREATE ATTRIBUTE:");
        console.error(JSON.stringify(createAttrData.data?.attributeCreate?.errors));
        return;
    }
    console.log(`   ✅ Created New Attribute: "${newAttr.name}"`);
    console.log(`      ID: ${newAttr.id}`);

    // ---------------------------------------------------------
    // STEP 4: ASSIGN ATTRIBUTE TO PRODUCT TYPE
    // ---------------------------------------------------------
    console.log("\n[4/6] Assigning New Attribute to Product Type...");
    
    // UPDATED: Changed 'productTypeAttributeAssign' to 'productAttributeAssign'
    const assignQuery = `
    mutation Assign($pt: ID!, $attr: ID!) {
        productAttributeAssign(productTypeId: $pt, operations: [{ id: $attr, type: PRODUCT }]) {
            productType { 
                id 
                productAttributes { id name }
                variantAttributes { id name }
            }
            errors { field message }
        }
    }`;

    const assignData = await saleorFetch(assignQuery, { pt: productTypeId, attr: newAttr.id });
    
    // Check for top level errors (like mutation name not found)
    if (assignData.errors) {
        console.error("❌ CRITICAL API ERROR (Step 4):");
        console.error(JSON.stringify(assignData.errors, null, 2));
        return;
    }

    if (assignData.data?.productAttributeAssign?.errors?.length > 0) {
        console.error("❌ ASSIGNMENT FAILED:");
        console.error(JSON.stringify(assignData.data.productAttributeAssign.errors));
        return;
    }

    // Check immediate response to see if it stuck
    const immediateProdAttrs = assignData.data?.productAttributeAssign?.productType?.productAttributes || [];
    const immediateVarAttrs = assignData.data?.productAttributeAssign?.productType?.variantAttributes || [];
    
    if (immediateProdAttrs.some((a:any) => a.id === newAttr.id)) {
        console.log(`   ✅ API reports success. Attribute is in 'productAttributes'.`);
    } else if (immediateVarAttrs.some((a:any) => a.id === newAttr.id)) {
        console.log(`   ⚠️ API reports success, but Attribute ended up in 'variantAttributes' instead.`);
    } else {
         console.warn(`   ⚠️ API reports success, but Attribute is MISSING from immediate response list.`);
         console.warn(`   Response Dump:`, JSON.stringify(assignData));
    }

    // ---------------------------------------------------------
    // STEP 4.5: VERIFY ASSIGNMENT PROPAGATION
    // ---------------------------------------------------------
    console.log("\n[4.5/6] Verifying Attribute Assignment...");
    
    // Simple delay to allow for DB propagation
    await new Promise(r => setTimeout(r, 2000));

    const verifyQuery = `
    query Verify($id: ID!) {
        productType(id: $id) {
            productAttributes { id name }
            variantAttributes { id name }
        }
    }`;
    const verifyData = await saleorFetch(verifyQuery, { id: productTypeId });
    const pAttributes = verifyData.data?.productType?.productAttributes || [];
    const vAttributes = verifyData.data?.productType?.variantAttributes || [];
    
    const isAssignedProd = pAttributes.some((a:any) => a.id === newAttr.id);
    const isAssignedVar = vAttributes.some((a:any) => a.id === newAttr.id);

    if (isAssignedVar) {
         console.log("   ⚠️ Attribute verified, but it is a VARIANT Attribute, not Product Attribute.");
         // proceed anyway to see if it works
    } else if (!isAssignedProd) {
        console.error("❌ ASSIGNMENT VERIFICATION FAILED.");
        console.error("   The attribute was assigned but does not appear on the Product Type yet.");
        console.error("   Current Product Attributes:", JSON.stringify(pAttributes.map((a:any) => a.name)));
        console.error("   Current Variant Attributes:", JSON.stringify(vAttributes.map((a:any) => a.name)));
        return;
    } else {
        console.log("   ✅ Attribute confirmed on Product Type.");
    }

    // ---------------------------------------------------------
    // STEP 5: TEST ASSIGNMENT
    // ---------------------------------------------------------
    console.log("\n[5/6] Testing Assignment with New Attribute...");
    
    const payload = {
        id: prodNode.id,
        input: {
            attributes: [{
                id: newAttr.id,
                references: [tempPage.id]
            }]
        }
    };
    
    const updateQuery = `
    mutation UpdateProductBrand($id: ID!, $input: ProductInput!) {
        productUpdate(id: $id, input: $input) {
            product { 
                id
                attributes { 
                    attribute { id } 
                    values { id name reference } 
                } 
            }
            errors { field message }
        }
    }`;

    const updateData = await saleorFetch(updateQuery, payload);
    const result = updateData.data?.productUpdate;
    
    const assignedAttr = result?.product?.attributes?.find((a: any) => a.attribute.id === newAttr.id);

    if (assignedAttr && assignedAttr.values.length > 0) {
        console.log(`   ✅✅✅ SUCCESS!`);
        console.log(`   The new attribute works perfectly. The issue was the old attribute configuration.`);
        console.log(`\n   👉 ACTION REQUIRED:`);
        console.log(`   1. Open your .env file.`);
        console.log(`   2. Replace SALEOR_BRAND_ATTRIBUTE_ID with this new ID:`);
        console.log(`      ${newAttr.id}`);
        console.log(`   3. Run your main importer script.`);
    } else {
        console.log(`   ❌ STILL FAILING even with new attribute.`);
        console.log(JSON.stringify(result));
    }

    // ---------------------------------------------------------
    // STEP 6: CLEANUP TEMP PAGE
    // ---------------------------------------------------------
    console.log("\n[6/6] Cleaning up Temp Page...");
    const deleteQuery = `mutation Del($id: ID!) { pageDelete(id: $id) { errors { field } } }`;
    await saleorFetch(deleteQuery, { id: tempPage.id });
    console.log(`   ✅ Cleanup done.`);
    
    console.log("\n--------------------------------------------------");
}

runDiagnostic();