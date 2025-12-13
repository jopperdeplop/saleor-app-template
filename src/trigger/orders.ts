import { task } from "@trigger.dev/sdk/v3";
import { makeSaleorClient, ORDER_QUERY, WAREHOUSE_QUERY, FULFILLMENT_CREATE, UPDATE_ORDER_METADATA, SEARCH_QUERY } from "../lib/saleor-client";
import { getShippingRates, purchaseLabel, createLabelForOrder } from "../lib/shippo";
import { logDebug, OrderLine } from "../lib/utils";
import { apl } from "../saleor-app";

export const generateShippingLabel = task({
    id: "generate-shipping-label",
    run: async (payload: { orderId: string }) => {
        const orderIdentifier = payload.orderId;
        logDebug(`🔄 [Trigger] Processing Order Identifier: ${orderIdentifier}`);

        // --- AUTHENTICATION ---
        const apiUrl = process.env.SALEOR_API_URL;
        if (!apiUrl) throw new Error("SALEOR_API_URL env var is missing in Trigger.dev");

        // Use the App's token from Upstash (Redis)
        const authData = await apl.get(apiUrl);
        if (!authData || !authData.token) {
            throw new Error(`Could not find Auth Token for ${apiUrl}. Ensure the App is installed and KV env vars are set.`);
        }
        logDebug(`🔐 Authenticated as App for ${apiUrl}`);

        const client = makeSaleorClient(apiUrl, authData.token);

        // --- LOGIC PORTED FROM order-automation.ts ---

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
        const { data: orderData, error: orderError } = await client.query(ORDER_QUERY, { id: orderId }).toPromise();
        if (orderError) {
            logDebug(`   ❌ Failed to fetch order:`, orderError);
            throw new Error(`Failed to fetch order: ${orderError.message}`);
        }
        const order = orderData?.order;
        if (!order) {
            throw new Error("Order not found");
        }

        if (!order.shippingAddress) {
            logDebug("   ⚠️ Order has no shipping address. Skipping.");
            return { success: false, reason: "No shipping address" };
        }

        // 2. Group items by Vendor (Brand)
        const vendorMap = new Map<string, OrderLine[]>();
        for (const line of order.lines) {
            if (!line.variant) continue;
            const vendor = getVendorFromLine(line);
            if (!vendorMap.has(vendor)) vendorMap.set(vendor, []);
            vendorMap.get(vendor)!.push(line);
        }

        const generatedLabels: any[] = [];

        // 3. Process Vendors
        for (const [vendor, lines] of vendorMap) {
            logDebug(`   🏭 Processing Vendor: ${vendor}`);

            // A. Find Warehouse
            const warehouseNode = await getVendorWarehouse(client, vendor);
            const warehouseAddress = warehouseNode?.address ? mapSaleorAddressToShippo(warehouseNode.address) : null;

            // Default US Warehouse for testing if not found (per previous instructions)
            const addressFrom = warehouseAddress || {
                name: "Main Warehouse",
                street1: "215 Clayton st",
                city: "San Francisco",
                state: "CA",
                zip: "94117",
                country: "US"
            };

            // B. Prepare Payload
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

            // C. Customs
            let customsDeclaration = undefined;
            if (addressFrom.country !== addressTo.country) {
                const customsItems = lines.map((line: any) => ({
                    description: line.variant?.product?.name || "Apparel",
                    quantity: line.quantity,
                    netWeight: line.variant?.weight?.value?.toString() || "1",
                    massUnit: (line.variant?.weight?.unit?.toLowerCase() || "kg"),
                    valueAmount: "10.00",
                    valueCurrency: "USD",
                    originCountry: "US"
                }));

                customsDeclaration = {
                    contentsType: "MERCHANDISE",
                    nonDeliveryOption: "RETURN",
                    certify: true,
                    certifySigner: "Fulfillment Manager",
                    incoterm: "DDU",
                    eelPfc: "NOEEI_30_37_a",
                    items: customsItems
                };
            }

            // D. Fetch Rates & Purchase Label
            logDebug(`      📦 Generating Label for Order ${orderId}...`);

            // Declare labelData in scope
            let labelData: any = null;

            try {
                labelData = await createLabelForOrder({
                    orderId: order.number,
                    addressFrom,
                    addressTo,
                    parcels,
                    customsDeclaration,
                    shippingMethodName: order.shippingMethod?.name // Pass the user's selection
                });
            } catch (err: any) {
                logDebug(`      ❌ Shippo Error:`, err.message);
            }

            if (labelData && warehouseNode) {
                // E. Fulfillment
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
                await client.mutation(FULFILLMENT_CREATE, { input: fulfillInput }).toPromise();

                generatedLabels.push({
                    vendor,
                    trackingNumber: labelData.trackingNumber,
                    labelUrl: labelData.labelUrl,
                    carrier: labelData.carrier
                });
            }
        }

        // 4. Update Metadata
        if (generatedLabels.length > 0) {
            const metaInput = generatedLabels.map((l, i) => ({
                key: `shippo_label_${i}_${l.vendor.replace(/\s+/g, '_')}`,
                value: JSON.stringify(l)
            }));
            metaInput.push({ key: "shippo_label_url", value: generatedLabels[0].labelUrl });

            await client.mutation(UPDATE_ORDER_METADATA, { id: order.id, input: metaInput }).toPromise();
            logDebug("   ✅ Trigger Job Complete: Metadata Updated.");
        }

        return { success: true, labels: generatedLabels };
    },
});

// --- LOCALLY SCOPED HELPERS (Copied over) ---

function getVendorFromLine(line: OrderLine): string {
    if (!line.variant?.product?.attributes) return "Unknown";
    const brandAttr = line.variant.product.attributes.find(
        a => a.attribute.slug === "brand"
    );
    return brandAttr?.values[0]?.name || "Unknown";
}

async function getVendorWarehouse(client: any, vendorName: string) {
    if (vendorName === "Unknown") return null;
    let res = await client.query(WAREHOUSE_QUERY, { search: `${vendorName} Warehouse` }).toPromise();
    let node = res.data?.warehouses?.edges?.[0]?.node;
    if (!node) {
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
