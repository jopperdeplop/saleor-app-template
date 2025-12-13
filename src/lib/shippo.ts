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
    customsDeclaration
}: {
    addressFrom: any;
    addressTo: any;
    parcels: any[];
    orderId: string;
    customsDeclaration?: any;
}) {
    const rates = await getShippingRates({ addressFrom, addressTo, parcels, customsDeclaration });
    
    if (rates.length === 0) {
        throw new Error("No shipping rates found.");
    }

    const bestRate = rates[0]; // Cheapest
    console.log(`   💰 Best Rate for ${orderId}: ${bestRate.provider} - ${bestRate.amount} ${bestRate.currency}`);

    const result = await purchaseLabel(bestRate.objectId);
    return {
        ...result,
        carrier: bestRate.provider
    };
}
