import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard for GCM
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypts text using AES-256-GCM.
 * Output format: iv:authTag:encryptedData (Base64)
 */
export function encrypt(text: string): string {
    const secret = process.env.ENCRYPTION_SECRET;
    if (!secret || secret.length !== 64) {
        throw new Error('ENCRYPTION_SECRET must be a 64-character hex string (32 bytes).');
    }

    const key = Buffer.from(secret, 'hex');
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag().toString('base64');

    return `${iv.toString('base64')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts text using AES-256-GCM.
 * Input format: iv:authTag:encryptedData (Base64)
 */
export function decrypt(encryptedText: string): string {
    const secret = process.env.ENCRYPTION_SECRET;
    if (!secret || secret.length !== 64) {
        throw new Error('ENCRYPTION_SECRET must be a 64-character hex string (32 bytes).');
    }

    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted text format. Expected iv:authTag:encryptedData');
    }

    const [ivBase64, authTagBase64, encryptedBase64] = parts;
    const key = Buffer.from(secret, 'hex');
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedBase64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
}
