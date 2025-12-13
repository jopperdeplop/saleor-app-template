import { Shippo } from "shippo";
import * as fs from 'fs';

const SHIPPO_TOKEN = process.env.SHIPPO_API_TOKEN;

if (!SHIPPO_TOKEN) {
    console.warn("⚠️ SHIPPO_API_TOKEN is missing from .env. Label generation will fail.");
}

export const shippoClient = new Shippo({
    apiKeyHeader: SHIPPO_TOKEN,
});

/**
 * Fetch rates for a potential shipment.
 * Used by the Webhook to show options at Checkout.
 * Used by the Trigger Task to re-quote before buying.
 */
export async function getShippingRates({
    addressFrom,
    addressTo,
    parcels,
    customsDeclaration
}: {
    addressFrom: any;
    addressTo: any;
    parcels: any[];
    customsDeclaration?: any;
}) {
    try {
        console.log(`📦 [Shippo] Fetching rates...`);
        const shipment = await shippoClient.shipments.create({
            addressFrom: addressFrom,
            addressTo: addressTo,
            parcels: parcels,
            customsDeclaration: customsDeclaration,
            async: false
        });

        if (!shipment.rates || shipment.rates.length === 0) {
            console.warn("   ⚠️ No rates found via Shippo.", shipment.messages);
            return [];
        }

        // Return the rates sorted by price
        return shipment.rates.sort((a: any, b: any) => parseFloat(a.amount) - parseFloat(b.amount));
    } catch (error) {
        console.error("   ❌ Shippo Rate Error:", error);
        throw error;
    }
}

/**
 * Purchases a label using a specific Rate Metadata (object_id).
 * used by the Trigger Task.
 */
export async function purchaseLabel(rateObjectId: string) {
    console.log(`💰 [Shippo] Purchasing label for Rate ID: ${rateObjectId}`);
    const transaction = await shippoClient.transactions.create({
        rate: rateObjectId,
        labelFileType: "PDF",
        async: false
    });

    if (transaction.status === "SUCCESS") {
        console.log(`   ✅ Label Generated: ${transaction.labelUrl}`);
        return {
            trackingNumber: transaction.trackingNumber,
            trackingUrl: transaction.trackingUrlProvider,
            labelUrl: transaction.labelUrl,
            carrier: transaction.rate as string // In some SDK versions this might need a fetch, but 'rate' is the ID. 
            // Note: transaction object might not have provider name directly if not expanded. 
            // For now we assume the caller knows the carrier or we accept what we have.
        };
    } else {
        console.error("   ❌ Label Transaction Failed:", transaction.messages);
        throw new Error(`Transaction Failed: ${JSON.stringify(transaction.messages)}`);
    }
}

/**
 * Legacy wrapper to maintain backward compatibility if needed, 
 * or just a helper to do "Buy Cheapest" in one go.
 */
export async function createLabelForOrder({
    addressFrom,
    addressTo,
    parcels,
    orderId,
    customsDeclaration,
    shippingMethodName // OPTIONAL: Try to match this specific method
}: {
    addressFrom: any;
    addressTo: any;
    parcels: any[];
    orderId: string;
    customsDeclaration?: any;
    shippingMethodName?: string;
}) {
    const rates = await getShippingRates({ addressFrom, addressTo, parcels, customsDeclaration });

    if (rates.length === 0) {
        throw new Error("No shipping rates found.");
    }

    let selectedRate = rates[0]; // Default to cheapest

    if (shippingMethodName) {
        // Try to find the rate that matches the user's selection
        // We match by checking if the rate's constructed name is part of the selection or vice versa
        // ideally exact match: `${rate.provider} ${rate.servicelevel.name}`
        const match = rates.find((rate: any) => {
            const rateName = `${rate.provider} ${rate.servicelevel?.name || ""}`.trim();
            return shippingMethodName.includes(rateName) || rateName === shippingMethodName;
        });

        if (match) {
            console.log(`   ✅ Matched selected rate: ${match.provider} - ${match.amount} ${match.currency}`);
            selectedRate = match;
        } else {
            console.warn(`   ⚠️ Could not match shipping method '${shippingMethodName}'. Defaulting to cheapest: ${selectedRate.provider}`);
        }
    }

    console.log(`   💰 Buying Label for ${orderId}: ${selectedRate.provider} - ${selectedRate.amount} ${selectedRate.currency}`);

    // FIX: Ensure we use the correct ID property (objectId vs object_id)
    // Shippo SDK types declare `objectId`, but runtime might vary or previous issues suggested ambiguity.
    const rateAny = selectedRate as any;
    const rateId = rateAny.objectId || rateAny.object_id;
    const result = await purchaseLabel(rateId);
    return {
        ...result,
        carrier: selectedRate.provider
    };
}
