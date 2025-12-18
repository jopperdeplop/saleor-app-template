# Shippo Automation Logic Reference

This file contains the legacy Shippo automation logic that was used to automatically generate shipping labels and sync fulfillment status across Saleor and Shopify. 

## Core Task Logic (Trigger.dev)

```typescript
// --- ADDRESS MAPPING ---
function mapSaleorAddressToShippo(addr: any) {
    return {
        name: `${addr.firstName} ${addr.lastName}`.trim() || addr.companyName || "Recipient",
        company: addr.companyName,
        street1: addr.streetAddress1,
        street2: addr.streetAddress2,
        city: addr.city,
        state: addr.countryArea,
        zip: addr.postalCode,
        country: addr.country.code,
        phone: addr.phone || "0000000000",
        email: "logistics@partner.shop"
    };
}

const DEFAULT_WAREHOUSE_ADDR = {
    name: "Platform Warehouse",
    street1: "Market St 123",
    city: "San Francisco",
    state: "CA",
    zip: "94105",
    country: "US",
    phone: "4155551234",
    email: "logistics@partner.shop"
};

// --- WAREHOUSE LOOKUP ---
async function getVendorWarehouse(client: any, vendor: string) {
    const res = await client.query(WAREHOUSE_QUERY, { search: vendor }).toPromise();
    return res.data?.warehouses?.edges?.[0]?.node;
}

// --- FULFILLMENT SYNC (SHOPIFY) ---
async function pushFulfillmentToShopify(integration: any, shopifyOrderId: string, labelData: any) {
    // 1. Fetch Location (Mandatory for Shopify)
    const locationId = await getShopifyLocationId(integration);
    
    // 2. Update Note with Label URL
    await updateShopifyOrderNote(integration, shopifyOrderId, 
        `📦 PLATFORM SHIPPING LABEL: ${labelData.labelUrl}\n\nTracking: ${labelData.trackingNumber}`
    );

    // 3. Create Fulfillment
    const payload = {
        fulfillment: {
            location_id: locationId,
            tracking_number: labelData.trackingNumber,
            tracking_urls: [labelData.trackingUrl || labelData.labelUrl],
            notify_customer: false
        }
    };
    
    await fetch(`https://${integration.storeUrl}/admin/api/2024-04/orders/${shopifyOrderId}/fulfillments.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'X-Shopify-Access-Token': integration.accessToken },
        body: JSON.stringify(payload)
    });
}
```

## Integration Flow (The "Shippo Block")

```typescript
// 1. Check if label already exists (Smart Recovery)
const existingLabelMeta = order.metadata?.find((m: any) => m.key === `label_${slugify(vendor)}`);
let labelData = null;

if (existingLabelMeta) {
    labelData = JSON.parse(existingLabelMeta.value);
}

// 2. If no label, perform purchase
if (!labelData) {
    const warehouse = await getVendorWarehouse(client, vendor);
    const addressFrom = warehouse?.address ? mapSaleorAddressToShippo(warehouse.address) : DEFAULT_WAREHOUSE_ADDR;
    const addressTo = mapSaleorAddressToShippo(order.shippingAddress);

    // 3. Customs Declaration (International)
    let customsDeclaration = undefined;
    if (addressFrom.country !== addressTo.country) {
        const customsItems = lines.map((line: any) => ({
            description: line.variant?.product?.name || line.productName || "Apparel",
            quantity: line.quantity,
            netWeight: line.variant?.weight?.value?.toString() || "1",
            massUnit: "kg",
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

    // 4. Purchase Label
    labelData = await createLabelForOrder({
        orderId: order.number,
        addressFrom,
        addressTo,
        parcels: [{ length: "25", width: "25", height: "25", distanceUnit: "cm", weight: "1", massUnit: "kg" }],
        customsDeclaration,
        shippingMethodName: order.shippingMethod?.name
    });

    // 5. Save Metadata
    await client.mutation(UPDATE_ORDER_METADATA, {
        id: order.id,
        input: [{ key: `label_${slugify(vendor)}`, value: JSON.stringify(labelData) }]
    }).toPromise();
}

// 6. Platform Sync
if (labelData) {
    // Saleor Fulfillment
    await client.mutation(FULFILLMENT_CREATE, {
        input: {
            order: order.id,
            lines: lines.map(l => ({ orderLineId: l.id, stocks: [{ quantity: l.quantity, warehouse: warehouse.id }] })),
            trackingNumber: labelData.trackingNumber,
            notifyCustomer: true
        }
    }).toPromise();

    // Shopify Note/Fulfillment
    await pushFulfillmentToShopify(integration, shopifyOrderId, labelData);
}
```
