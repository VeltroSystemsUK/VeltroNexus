/**
 * Webhook API Key Hashing Utilities
 * 
 * SECURITY: API keys are never stored in plaintext. Instead, we store HMAC-SHA256
 * hashes. This prevents key exposure even if the database is compromised.
 * 
 * SECURITY: Key verification uses crypto.timingSafeEqual() to prevent timing attacks
 * that could leak information about the correct key through response time analysis.
 */
import crypto from 'crypto';

const WEBHOOK_KEY_LENGTH = 32;

let cachedSecret: string | null = null;

/**
 * Get the HMAC secret for hashing API keys.
 * SECURITY: In production, a strong secret is required to prevent hash brute-forcing.
 */
function getHashSecret(): string {
  if (cachedSecret) {
    return cachedSecret;
  }
  
  const secret = process.env.WEBHOOK_KEY_SECRET;
  const isProduction = process.env.NODE_ENV === 'production';
  
  if (!secret || secret.length < 32) {
    if (isProduction) {
      throw new Error('WEBHOOK_KEY_SECRET must be set to a 32+ character secret in production');
    }
    console.warn('WEBHOOK_KEY_SECRET not set or too short. Using fallback for development only.');
    cachedSecret = 'flowloan-webhook-key-secret-fallback-do-not-use-in-production';
  } else {
    cachedSecret = secret;
  }
  
  return cachedSecret;
}

export function generateWebhookApiKey(): string {
  return crypto.randomBytes(WEBHOOK_KEY_LENGTH).toString('base64url');
}

export function hashWebhookApiKey(apiKey: string): string {
  const hmac = crypto.createHmac('sha256', getHashSecret());
  hmac.update(apiKey);
  return hmac.digest('hex');
}

export function getApiKeySuffix(apiKey: string): string {
  return apiKey.slice(-4);
}

/**
 * Verify an API key against a stored hash.
 * 
 * SECURITY: Uses crypto.timingSafeEqual() to compare hashes in constant time.
 * This prevents timing attacks where an attacker could measure response times
 * to determine how many characters of the key are correct, gradually revealing
 * the full key through statistical analysis of timing differences.
 */
export function verifyWebhookApiKey(providedKey: string, storedHash: string): boolean {
  const computedHash = hashWebhookApiKey(providedKey);
  try {
    // SECURITY: timingSafeEqual prevents timing side-channel attacks
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(storedHash, 'hex')
    );
  } catch {
    // Return false for any error (e.g., invalid hex, length mismatch)
    return false;
  }
}
