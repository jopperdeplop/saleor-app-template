import dotenv from 'dotenv';
dotenv.config();
import fetch from 'node-fetch';

const SALEOR_URL = process.env.SALEOR_API_URL!;
const rawToken = process.env.SALEOR_TOKEN!;
const SALEOR_TOKEN = rawToken.replace(/^Bearer\s+/i, "");

async function checkPermissions() {
    console.log("🔍 Checking Token Permissions...");

    if (!SALEOR_URL || !SALEOR_TOKEN) {
        console.error("❌ Missing .env variables.");
        return;
    }

    // Query to see who we are and what permissions we have
    const query = `
    query WhoAmI {
        me {
            id
            email
            userPermissions { code }
        }
        app {
            id
            name
            permissions { code }
        }
    }`;

    try {
        const res = await fetch(SALEOR_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SALEOR_TOKEN}`
            },
            body: JSON.stringify({ query })
        });

        const json: any = await res.json();

        if (json.errors) {
            console.error("❌ API Error:", JSON.stringify(json.errors, null, 2));
            return;
        }

        const app = json.data?.app;
        const user = json.data?.me;

        if (app) {
            console.log(`✅ Authenticated as APP: "${app.name}" (${app.id})`);
            console.log("   📜 Permissions:", app.permissions.map((p: any) => p.code).join(", "));
        } else if (user) {
            console.log(`✅ Authenticated as USER: "${user.email}" (${user.id})`);
            const perms = [...(user.permissions || []), ...(user.userPermissions || [])];
            console.log("   📜 Permissions:", perms.map((p: any) => p.code).join(", "));
        } else {
            console.warn("⚠️  Authenticated but could not identify User or App profile. (Are you using a valid token type?)");
            console.log("   Data:", JSON.stringify(json.data));
        }

    } catch (e) {
        console.error("❌ Network Error:", e);
    }
}

checkPermissions();
