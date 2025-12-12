import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const orderId = process.argv[2];

    if (!orderId) {
        console.error("Usage: npx tsx scripts/test-automation.ts <ORDER_ID>");
        console.error("Example: npx tsx scripts/test-automation.ts 79");
        return;
    }

    console.log(`🧪 Testing Automation for Order: ${orderId}`);
    try {
        // Dynamic import ensures dotenv.config() runs BEFORE order-automation.ts is evaluated
        // @ts-ignore
        const { processOrder } = await import('../src/lib/order-automation');

        await processOrder(orderId);
        console.log("✅ Process Completed Successfully.");
    } catch (e) {
        console.error("❌ Process Failed:", e);
    }
}

main();

