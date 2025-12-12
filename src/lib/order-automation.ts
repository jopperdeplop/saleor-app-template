import { createClient, cacheExchange, fetchExchange } from "urql";
import { createLabelForOrder } from "./shippo";
import fetch from "node-fetch";
import * as fs from 'fs';

function logDebug(msg: string, obj?: any) {
    const text = obj ? `${msg} ${JSON.stringify(obj)}` : msg;
    // console.log(text); // Disable console to avoid noise in terminal capture
    fs.appendFileSync('debug_log.txt', text + '\n');
}

const SALEOR_API_URL = process.env.SALEOR_API_URL!;
const rawToken = process.env.SALEOR_TOKEN!;
const SALEOR_TOKEN = rawToken.replace(/^Bearer\s+/i, "");

const client = createClient({
    url: SALEOR_API_URL,
    fetch: fetch as any,
    exchanges: [cacheExchange, fetchExchange],
    fetchOptions: () => ({
        headers: {
            Authorization: `Bearer ${SALEOR_TOKEN}`,
        },
    }),
});

// --- QUERIES ---

const ORDER_QUERY = `
query GetOrderDetails($id: ID!) {
  order(id: $id) {
    id
    number
    userEmail
    shippingAddress {
      firstName lastName companyName streetAddress1 streetAddress2
      city postalCode country { code } countryArea phone
    }
    lines {
      id
      productName
      quantity
      variant {
        id
        sku
        weight { value unit }
        product {
          attributes {
            attribute { slug }
            values { name }
          }
        }
      }
    }
  }
}
`;

const WAREHOUSE_QUERY = `
query FindWarehouse($search: String!) {
  warehouses(filter: { search: $search }, first: 1) {
    edges {
      node {
        id
        name
        address {
          firstName lastName companyName streetAddress1 streetAddress2
          city postalCode country { code } countryArea phone
        }
      }
    }
  }
}
`;

const FULFILLMENT_CREATE = `
mutation FulfillmentCreate($input: FulfillmentCreateInput!) {
  orderFulfill(input: $input) {
    fulfillment { id status trackingNumber }
    errors { field message }
  }
}
`;

const UPDATE_ORDER_METADATA = `
mutation UpdateOrderMeta($id: ID!, $input: [MetadataInput!]!) {
  updateMetadata(id: $id, input: $input) {
    errors { field message }
  }
}
`;

const SEARCH_QUERY = `
query GetOrdersByNumber($number: String!) {
  orders(filter: { search: $number }, first: 1) {
    edges { node { id number } }
  }
}
`;

// --- TYPES ---
interface OrderLine {
    id: string;
    variant: {
        product: {
            attributes: Array<{
                attribute: { slug: string };
                values: Array<{ name: string }>;
            }>;
        };
        weight?: { value: number; unit: string };
    };
    quantity: number;
}

// --- LOGIC ---

export async function processOrder(orderIdentifier: string) {
    logDebug(`🔄 Processing Order Identifier: ${orderIdentifier}`);

    let orderId = orderIdentifier;

    // Resolve "79" -> "T3JkZXI..."
    if (!orderId.startsWith("T") && !orderId.includes("=")) {
        logDebug(`   ℹ️  Looking up ID for Order #${orderId}...`);
        const { data, error } = await client.query(SEARCH_QUERY, { number: orderId }).toPromise();
        if (error) logDebug("   ❌ Search Error:", error);

        const found = data?.orders?.edges?.[0]?.node;
        if (found) {
            logDebug(`   ✅ Found ID: ${found.id} (Order #${found.number})`);
            orderId = found.id;
        } else {
            logDebug(`   ⚠️  Could not find order #${orderId}. Trying as ID anyway.`);
        }
    }

    // 1. Fetch Order
    const { data, error } = await client.query(ORDER_QUERY, { id: orderId }).toPromise();
    if (error) {
        logDebug(`   ❌ Failed to fetch order:`, error);
        throw new Error(`Failed to fetch order: ${error.message}`);
    }
    const order = data?.order;
    if (!order) {
        logDebug("   ❌ Order not found in Saleor.");
        throw new Error("Order not found");
    }

    if (!order.shippingAddress) {
        logDebug("   ⚠️ Order has no shipping address. Skipping shipping label.");
        return;
    }

    // 2. Group items by Vendor (Brand)
    const vendorMap = new Map<string, OrderLine[]>();

    for (const line of order.lines) {
        // Safe access
        if (!line.variant) {
            logDebug(`   ⚠️ Line ${line.productName} has no variant. Skipping.`);
            continue;
        }
        const vendor = getVendorFromLine(line);
        if (!vendorMap.has(vendor)) {
            vendorMap.set(vendor, []);
        }
        vendorMap.get(vendor)!.push(line);
    }

    logDebug(`   Found ${vendorMap.size} unique vendors.`);

    interface LabelResult {
        vendor: string;
        trackingNumber: string;
        trackingUrl: string;
        labelUrl: string;
        carrier: string;
    }
    const generatedLabels: LabelResult[] = [];

    // 3. Process each Vendor Group
    for (const [vendor, lines] of vendorMap) {
        logDebug(`   🏭 Processing Vendor: ${vendor}`);

        // A. Find Warehouse
        const warehouseNode = await getVendorWarehouse(vendor);
        const warehouseAddress = warehouseNode?.address ? mapSaleorAddressToShippo(warehouseNode.address) : null;

        const addressFrom = warehouseAddress || {
            name: "Main Warehouse",
            street1: "123 Default St",
            city: "San Francisco",
            state: "CA",
            zip: "94105",
            country: "US"
        };
        logDebug("      📦 Address From:", addressFrom);

        // B. Prepare Shippo Payload
        const addressTo = mapSaleorAddressToShippo(order.shippingAddress);
        if (!addressTo) {
            logDebug("      ⚠️ Could not map shipping address.");
            continue;
        }
        const parcels = lines.map((line: any) => ({
            length: "25", width: "25", height: "25", distanceUnit: "cm",
            weight: line.variant?.weight?.value?.toString() || "1",
            massUnit: (line.variant?.weight?.unit?.toLowerCase() || "kg")
        }));

        // C. Prepare Customs (if International)
        let customsDeclaration = undefined;
        if (addressFrom.country !== addressTo.country) {
            logDebug("      🌍 International Shipment detected. Generating Customs Declaration...");

            const customsItems = lines.map((line: any) => ({
                description: line.variant?.product?.name || "Apparel", // Specific description required
                quantity: line.quantity,
                netWeight: line.variant?.weight?.value?.toString() || "1",
                massUnit: (line.variant?.weight?.unit?.toLowerCase() || "kg"),
                valueAmount: "10.00", // Default value if missing
                valueCurrency: "USD",
                originCountry: "US"
            }));

            // Shippo V2 SDK expects camelCase
            customsDeclaration = {
                contentsType: "MERCHANDISE",
                nonDeliveryOption: "RETURN",
                certify: true,
                certifySigner: "Fulfillment Manager",
                incoterm: "DDU",
                eelPfc: "NOEEI_30_37_a", // Valid exemption code
                items: customsItems
            };
        }

        // D. Generate Label
        let labelData = null;
        try {
            labelData = await createLabelForOrder({
                orderId: order.number,
                addressFrom,
                addressTo: addressTo!,
                parcels,
                customsDeclaration
            });

            if (labelData) {
                generatedLabels.push({
                    vendor,
                    trackingNumber: labelData.trackingNumber || "",
                    trackingUrl: labelData.trackingUrl || "",
                    labelUrl: labelData.labelUrl || "",
                    carrier: labelData.carrier
                });
            }
        } catch (e: any) {
            logDebug(`      ❌ Failed to generate label for ${vendor}:`, e.message || e);
        }

        // D. Create Fulfillment
        if (labelData && warehouseNode) {
            logDebug(`      🚚 Creating Fulfillment for ${vendor}...`);

            const linesInput = lines.map(l => ({
                orderLineId: l.id,
                stocks: [{ quantity: l.quantity, warehouse: warehouseNode.id }]
            }));

            const fulfillInput = {
                order: order.id,
                lines: linesInput,
                trackingNumber: labelData.trackingNumber,
                notifyCustomer: true
            };

            const res = await client.mutation(FULFILLMENT_CREATE, { input: fulfillInput }).toPromise();
            if (res.data?.orderFulfill?.errors?.length > 0) {
                logDebug("      ❌ Fulfillment Error:", res.data.orderFulfill.errors);
            } else {
                logDebug(`      ✅ Fulfillment Created! Tracking: ${labelData.trackingNumber}`);
            }
        } else {
            logDebug(`      ⚠️  Skipping Fulfillment (Missing Label or Warehouse)`);
        }
    }

    // 4. Save Results to Order Metadata
    if (generatedLabels.length > 0) {
        logDebug("   💾 Saving Labels to Order Metadata...");
        const metaInput = generatedLabels.map((l, i) => ({
            key: `shippo_label_${i}_${l.vendor.replace(/\s+/g, '_')}`,
            value: JSON.stringify(l)
        }));

        metaInput.push({
            key: "shippo_label_url",
            value: generatedLabels[0]?.labelUrl || ""
        });

        const res = await client.mutation(UPDATE_ORDER_METADATA, {
            id: order.id,
            input: metaInput
        }).toPromise();

        if (res.error) logDebug("   ❌ Metadata Update Error:", res.error);
        if (res.data?.updateMetadata?.errors?.length > 0) logDebug("   ❌ Metadata Logic Error:", res.data.updateMetadata.errors);

        logDebug("   ✅ Order Metadata Updated.");
    } else {
        logDebug("   ⚠️ No labels generated, skipping metadata update.");
    }
}

// --- HELPERS ---

function getVendorFromLine(line: OrderLine): string {
    if (!line.variant?.product?.attributes) return "Unknown";
    const brandAttr = line.variant.product.attributes.find(
        a => a.attribute.slug === "brand"
    );
    return brandAttr?.values[0]?.name || "Unknown";
}

async function getVendorWarehouse(vendorName: string) {
    if (vendorName === "Unknown") return null;

    // 1. Try explicit "Vendor Warehouse" first
    let res = await client.query(WAREHOUSE_QUERY, { search: `${vendorName} Warehouse` }).toPromise();
    let node = res.data?.warehouses?.edges?.[0]?.node;

    if (!node) {
        // 2. Try just Vendor Name
        res = await client.query(WAREHOUSE_QUERY, { search: vendorName }).toPromise();
        node = res.data?.warehouses?.edges?.[0]?.node;
    }

    return node;
}

function mapSaleorAddressToShippo(addr: any) {
    if (!addr) return null;
    return {
        name: `${addr.firstName} ${addr.lastName}`.trim() || addr.companyName,
        company: addr.companyName,
        street1: addr.streetAddress1,
        street2: addr.streetAddress2,
        city: addr.city,
        state: addr.countryArea,
        zip: addr.postalCode,
        country: addr.country.code,
        phone: addr.phone,
        email: "logistics@example.com"
    };
}
