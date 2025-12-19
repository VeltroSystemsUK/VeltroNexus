import crypto from 'crypto';

const WEBHOOK_KEY_LENGTH = 32;

function getHashSecret(): string {
  const secret = process.env.WEBHOOK_KEY_SECRET;
  if (!secret || secret.length < 32) {
    console.warn('WEBHOOK_KEY_SECRET not set or too short, using fallback. Set a 32+ character secret in production.');
    return 'flowloan-webhook-key-secret-fallback-do-not-use-in-production';
  }
  return secret;
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

export function verifyWebhookApiKey(providedKey: string, storedHash: string): boolean {
  const computedHash = hashWebhookApiKey(providedKey);
  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(storedHash, 'hex')
    );
  } catch {
    return false;
  }
}
