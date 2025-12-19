import crypto from 'crypto';

const WEBHOOK_KEY_LENGTH = 32;

let cachedSecret: string | null = null;

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
