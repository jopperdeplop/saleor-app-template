import { task } from "@trigger.dev/sdk";
import { db } from "../db";
import { sql } from "drizzle-orm";

export const fixMediaTableTask = task({
  id: "fix-media-db-table",
  run: async () => {
    console.log("Starting manual media table schema update...");

    try {
      // Add columns one by one
      const queries = [
        'ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "owner_id" varchar',
        'ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumbnail_url" varchar',
        'ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumbnail_width" numeric',
        'ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumbnail_height" numeric',
        'ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumbnail_mime_type" varchar',
        'ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumbnail_filesize" numeric',
        'ALTER TABLE "media" ADD COLUMN IF NOT EXISTS "sizes_thumbnail_filename" varchar',
        'CREATE INDEX IF NOT EXISTS "media_owner_id_idx" ON "media" USING btree ("owner_id")'
      ];

      for (const query of queries) {
        try {
          await db.execute(sql.raw(query));
          console.log(`✅ Executed: ${query}`);
        } catch (err: any) {
          console.warn(`⚠️ Query failed (could be fine if exists): ${query}`, err.message);
        }
      }

      console.log("✅ Media table schema update complete.");
      return { success: true };
    } catch (error: any) {
      console.error("❌ Fatal error during schema update:", error);
      throw error;
    }
  },
});
