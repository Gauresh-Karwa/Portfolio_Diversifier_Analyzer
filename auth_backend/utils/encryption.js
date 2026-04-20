const crypto = require('crypto');
require('dotenv').config();

const ALGORITHM = 'aes-256-gcm';
const keyHex = process.env.ENCRYPTION_KEY;
if (!keyHex || keyHex.length !== 64) {
    console.error("CRITICAL: Invalid ENCRYPTION_KEY length. Must be 64 hex characters (32 bytes).");
}

// Fallback to zeros strictly to prevent crash if env is missing, but warns heavily.
const KEY = Buffer.from(keyHex || '0'.repeat(64), 'hex');

function encryptData(text) {
    if (!text) return "";
    try {
        // Create a random 12-byte initialization vector (nonce) per NIST for GCM
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
        
        let encrypted = cipher.update(text, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        // Generate an HMAC authentication tag
        const authTag = cipher.getAuthTag().toString('hex');
        
        // Return format: iv:authTag:encryptedPayload
        return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch (e) {
        console.error("Encryption error:", e);
        return "";
    }
}

function decryptData(encryptedString) {
    if (!encryptedString || !encryptedString.includes(':')) return "";
    try {
        const [ivHex, authTagHex, encryptedHex] = encryptedString.split(':');
        
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        
        const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
        decipher.setAuthTag(authTag);
        
        let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        
        return decrypted;
    } catch (e) {
        console.error("Decryption error (Corrupted Database Record or Wrong Key):", e);
        return null;
    }
}

module.exports = {
    encryptData,
    decryptData
};
