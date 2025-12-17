import 'dotenv/config';
import { db } from './index';
import { users } from './schema';

async function main() {
    try {
        console.log("Testing Database Connection...");
        // Just try to fetch one user or count users to verify access
        const result = await db.select().from(users).limit(1);
        console.log("Connection Successful! Users found:", result.length);
        console.log("Sample User:", result[0]);
    } catch (error) {
        console.error("Connection Failed:", error);
    }
}

main();
