import crypto from 'crypto';

/**
 * Normalizes translatable content into a stable string for hashing.
 * Handles plain text and EditorJS JSON structure.
 */
export function normalizeContent(content: string | null | undefined): string {
  if (!content) return "";
  
  // Check if it's potentially EditorJS JSON
  if (content.startsWith('{') && content.endsWith('}')) {
    try {
      const parsed = JSON.parse(content);
      if (parsed.blocks && Array.isArray(parsed.blocks)) {
        // Extract only the text/visible data from blocks to ignore metadata/version changes
        return parsed.blocks
          .map((block: any) => {
            const data = block.data || {};
            // Combine all text-like fields found in standard EditorJS blocks
            return (data.text || data.content || data.items?.join(" ") || data.caption || "").trim();
          })
          .join("|");
      }
    } catch (e) {
      // Not valid JSON or not EditorJS, treat as plain text
    }
  }
  
  return content.trim();
}

/**
 * Generates a SHA-256 hash for the given fields.
 */
export function generateContentHash(fields: Record<string, string | null | undefined>): string {
  const normalizedString = Object.entries(fields)
    .sort(([a], [b]) => a.localeCompare(b)) // Ensure stable order
    .map(([key, value]) => `${key}:${normalizeContent(value)}`)
    .join("::");
    
  return crypto.createHash('sha256').update(normalizedString).digest('hex');
}
