import { NextApiRequest, NextApiResponse } from "next";
import { translatePayloadHomepage } from "@/trigger/translate-payload-homepage";

/**
 * Webhook handler for PayloadCMS Homepage updates.
 * This triggers the AI translation task automatically.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Optional: Add a simple secret check if you want to secure this endpoint
  // const secret = req.headers["x-payload-secret"];
  // if (secret !== process.env.PAYLOAD_WEBHOOK_SECRET) { ... }

  if (!req.body) {
    return res.status(400).json({ error: "No body received" });
  }

  const { collection, operation } = req.body;

  // Only trigger for Homepage updates
  if (collection === "homepage" && (operation === "update" || operation === "create")) {
    console.log("🚀 Payload Homepage updated, triggering translation task...");
    
    try {
      // Trigger the task without a payload since it doesn't require one
      console.log("   --- Webhook Payload Detail ---");
      console.log(`   Collection: ${collection}`);
      console.log(`   Operation: ${operation}`);
      console.log("   -----------------------------");

      await translatePayloadHomepage.trigger();
      return res.status(200).json({ message: "Translation task triggered" });
    } catch (error: any) {
      console.error("Failed to trigger translation:", error);
      return res.status(500).json({ error: "Failed to trigger translation", details: error.message });
    }
  }

  return res.status(200).json({ message: "No action needed" });
}
