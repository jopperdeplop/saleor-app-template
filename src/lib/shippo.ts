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
 * Creates a shipment and retrieves rates.
 * Returns the best rate (cheapest) by default, or you can enhance logic to pick based on speed.
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
    try {
        console.log(`📦 [Shippo] Creating shipment for Order ${orderId}...`);

        // 1. Create Shipment
        const shipment = await shippoClient.shipments.create({
            addressFrom: addressFrom,
            addressTo: addressTo,
            parcels: parcels,
            customsDeclaration: customsDeclaration,
            async: false
        });

        // 2. Get Rates
        const rates = shipment.rates;
        if (!rates || rates.length === 0) {
            const errorMsg = "   ❌ No Rates Found. Shipment Messages: " + JSON.stringify(shipment.messages, null, 2);
            console.log(errorMsg);
            try { fs.appendFileSync('debug_log.txt', errorMsg + '\n'); } catch (e) { }
            throw new Error("No shipping rates found.");
        }

        // 3. Selection Logic (Cheapest)
        // Sort by amount
        const sortedRates = rates.sort((a: any, b: any) => parseFloat(a.amount) - parseFloat(b.amount));
        const bestRate = sortedRates[0];

        console.log(`   💰 Best Rate: ${bestRate.provider} - ${bestRate.amount} ${bestRate.currency}`);

        // 4. Purchase Label
        const transaction = await shippoClient.transactions.create({
            rate: bestRate.objectId,
            labelFileType: "PDF",
            async: false
        });

        if (transaction.status === "SUCCESS") {
            console.log(`   ✅ Label Generated: ${transaction.labelUrl}`);
            return {
                trackingNumber: transaction.trackingNumber,
                trackingUrl: transaction.trackingUrlProvider,
                labelUrl: transaction.labelUrl,
                carrier: bestRate.provider
            };
        } else {
            console.error("   ❌ Label Transaction Failed:", transaction.messages);
            return null;
        }

    } catch (error) {
        console.error("   ❌ Shippo Error:", error);
        throw error;
    }
}
