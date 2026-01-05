import {
  __name,
  init_esm
} from "./chunk-CEGEFIIW.mjs";

// src/lib/encryption.ts
init_esm();
import crypto from "crypto";
var ALGORITHM = "aes-256-gcm";
function decrypt(encryptedText) {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || secret.length !== 64) {
    throw new Error("ENCRYPTION_SECRET must be a 64-character hex string (32 bytes).");
  }
  const parts = encryptedText.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted text format. Expected iv:authTag:encryptedData");
  }
  const [ivBase64, authTagBase64, encryptedBase64] = parts;
  const key = Buffer.from(secret, "hex");
  const iv = Buffer.from(ivBase64, "base64");
  const authTag = Buffer.from(authTagBase64, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encryptedBase64, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
__name(decrypt, "decrypt");

export {
  decrypt
};
//# sourceMappingURL=chunk-HVB7L227.mjs.map
