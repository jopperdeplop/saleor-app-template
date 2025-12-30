import { APL, AuthData } from "@saleor/app-sdk/APL";
import { db } from "@/db";
import { saleorAuth } from "@/db/schema";
import { eq } from "drizzle-orm";

export class DrizzleAPL implements APL {
  async get(saleorApiUrl: string): Promise<AuthData | undefined> {
    console.log(`🔍 [APL Query] Searching for: ${saleorApiUrl}`);
    const [result] = await db
      .select()
      .from(saleorAuth)
      .where(eq(saleorAuth.saleorApiUrl, saleorApiUrl))
      .limit(1);

    if (!result) {
      console.warn(`❌ [APL Query] TOKEN NOT FOUND in database for: ${saleorApiUrl}`);
      return undefined;
    }

    console.log(`✅ [APL Query] Token found for: ${saleorApiUrl}`);
    return {
      saleorApiUrl: result.saleorApiUrl,
      token: result.token,
      appId: result.appId,
      jwks: result.jwks || undefined,
    };
  }

  async set(authData: AuthData): Promise<void> {
    await db
      .insert(saleorAuth)
      .values({
        saleorApiUrl: authData.saleorApiUrl,
        token: authData.token,
        appId: authData.appId,
        jwks: authData.jwks,
      })
      .onConflictDoUpdate({
        target: saleorAuth.saleorApiUrl,
        set: {
          token: authData.token,
          appId: authData.appId,
          jwks: authData.jwks,
        },
      });
  }

  async delete(saleorApiUrl: string): Promise<void> {
    await db.delete(saleorAuth).where(eq(saleorAuth.saleorApiUrl, saleorApiUrl));
  }

  async getAll(): Promise<AuthData[]> {
    const results = await db.select().from(saleorAuth);
    return results.map((r) => ({
      saleorApiUrl: r.saleorApiUrl,
      token: r.token,
      appId: r.appId,
      jwks: r.jwks || undefined,
    }));
  }

  async isReady(): Promise<any> {
    return { ready: true as const };
  }

  async isConfigured(): Promise<any> {
    return { configured: true as const };
  }
}
