/**
 * Environment Variable Validation
 * 
 * This module validates all required environment variables at application startup
 * to ensure the application has all necessary configuration before running.
 */

interface EnvConfig {
  // Database
  DATABASE_URL: string;
  
  // Authentication & Security
  SESSION_SECRET: string;
  WEBHOOK_KEY_SECRET: string;
  
  // External APIs
  COMPANIES_HOUSE_API_KEY: string;
  GOCARDLESS_ACCESS_TOKEN: string;
  GOCARDLESS_ENVIRONMENT: 'sandbox' | 'live';
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  
  // Optional - Redis for rate limiting
  REDIS_URL?: string;
  
  // Optional - Rate limit overrides
  RATE_LIMIT_WEBHOOK?: string;
  RATE_LIMIT_WEBHOOK_WINDOW_MS?: string;
  RATE_LIMIT_PDF_PARSE?: string;
  RATE_LIMIT_PDF_PARSE_WINDOW_MS?: string;
  RATE_LIMIT_AI?: string;
  RATE_LIMIT_AI_WINDOW_MS?: string;
  RATE_LIMIT_AUTH?: string;
  RATE_LIMIT_AUTH_WINDOW_MS?: string;
  RATE_LIMIT_UPLOAD?: string;
  RATE_LIMIT_UPLOAD_WINDOW_MS?: string;
  
  // Optional - CORS
  ALLOWED_ORIGINS?: string;
}

/**
 * Parse and validate a rate limit value
 */
function parseRateLimit(
  envVar: string, 
  defaultValue: number, 
  min = 1, 
  max = 1000
): number {
  const value = parseInt(process.env[envVar] || String(defaultValue));
  
  if (isNaN(value) || value < min || value > max) {
    console.warn(
      `⚠️  Invalid ${envVar}=${process.env[envVar]}, using default ${defaultValue} ` +
      `(valid range: ${min}-${max})`
    );
    return defaultValue;
  }
  
  return value;
}

/**
 * Validate environment variables and return typed configuration
 */
export function validateEnvironment(): EnvConfig {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  // Required in all environments
  const alwaysRequired = ['DATABASE_URL'];
  
  // Required in production only
  const productionRequired = [
    'SESSION_SECRET',
    'WEBHOOK_KEY_SECRET',
    'COMPANIES_HOUSE_API_KEY',
    'GOCARDLESS_ACCESS_TOKEN',
    'GOCARDLESS_ENVIRONMENT',
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL'
  ];

  // Check always required
  for (const key of alwaysRequired) {
    if (!process.env[key]) {
      errors.push(`${key} is required`);
    }
  }

  // Check production required
  if (isProduction) {
    for (const key of productionRequired) {
      if (!process.env[key]) {
        errors.push(`${key} is required in production`);
      }
    }
  }

  // Validate DATABASE_URL format
  if (process.env.DATABASE_URL) {
    if (!process.env.DATABASE_URL.startsWith('postgres://') && 
        !process.env.DATABASE_URL.startsWith('postgresql://')) {
      errors.push('DATABASE_URL must be a valid PostgreSQL connection string (postgres:// or postgresql://)');
    }
  }

  // Validate SESSION_SECRET strength
  if (process.env.SESSION_SECRET) {
    if (process.env.SESSION_SECRET.length < 32) {
      errors.push('SESSION_SECRET must be at least 32 characters long for security');
    }
    if (!/^[a-zA-Z0-9]+$/.test(process.env.SESSION_SECRET)) {
      warnings.push('SESSION_SECRET should contain only alphanumeric characters');
    }
  }

  // Validate WEBHOOK_KEY_SECRET strength
  if (process.env.WEBHOOK_KEY_SECRET) {
    if (process.env.WEBHOOK_KEY_SECRET.length < 32) {
      errors.push('WEBHOOK_KEY_SECRET must be at least 32 characters long for security');
    }
  } else if (isProduction) {
    errors.push('WEBHOOK_KEY_SECRET is required in production');
  }

  // Validate GoCardless environment
  if (process.env.GOCARDLESS_ENVIRONMENT) {
    if (!['sandbox', 'live'].includes(process.env.GOCARDLESS_ENVIRONMENT)) {
      errors.push('GOCARDLESS_ENVIRONMENT must be either "sandbox" or "live"');
    }
  }

  // Validate email format
  if (process.env.RESEND_FROM_EMAIL) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(process.env.RESEND_FROM_EMAIL)) {
      errors.push('RESEND_FROM_EMAIL must be a valid email address');
    }
  }

  // Warn about Redis in production
  if (isProduction && !process.env.REDIS_URL) {
    warnings.push(
      'REDIS_URL not set - falling back to in-memory rate limiting. ' +
      'This is not suitable for multi-instance production deployments.'
    );
  }

  // Validate rate limit overrides
  const rateLimitConfig = {
    webhook: parseRateLimit('RATE_LIMIT_WEBHOOK', 60, 1, 1000),
    webhookWindow: parseRateLimit('RATE_LIMIT_WEBHOOK_WINDOW_MS', 60000, 1000, 3600000),
    pdfParse: parseRateLimit('RATE_LIMIT_PDF_PARSE', 30, 1, 500),
    pdfParseWindow: parseRateLimit('RATE_LIMIT_PDF_PARSE_WINDOW_MS', 60000, 1000, 3600000),
    ai: parseRateLimit('RATE_LIMIT_AI', 20, 1, 200),
    aiWindow: parseRateLimit('RATE_LIMIT_AI_WINDOW_MS', 60000, 1000, 3600000),
    auth: parseRateLimit('RATE_LIMIT_AUTH', 10, 1, 100),
    authWindow: parseRateLimit('RATE_LIMIT_AUTH_WINDOW_MS', 60000, 1000, 3600000),
    upload: parseRateLimit('RATE_LIMIT_UPLOAD', 30, 1, 500),
    uploadWindow: parseRateLimit('RATE_LIMIT_UPLOAD_WINDOW_MS', 60000, 1000, 3600000),
  };

  // Print warnings
  if (warnings.length > 0) {
    console.warn('\n⚠️  Environment Warnings:');
    warnings.forEach(warning => console.warn(`   - ${warning}`));
    console.warn('');
  }

  // Throw if there are errors
  if (errors.length > 0) {
    console.error('\n❌ Environment Validation Failed:');
    errors.forEach(error => console.error(`   - ${error}`));
    console.error('\nPlease fix the above issues and restart the application.\n');
    throw new Error('Environment validation failed');
  }

  // Success message
  console.log('✅ Environment validation passed');
  if (isProduction) {
    console.log('🔒 Running in PRODUCTION mode');
  } else {
    console.log('🔧 Running in DEVELOPMENT mode');
  }

  // Log rate limit configuration
  console.log('\n📊 Rate Limit Configuration:');
  console.log(`   - Webhook: ${rateLimitConfig.webhook}/min`);
  console.log(`   - PDF Parse: ${rateLimitConfig.pdfParse}/min`);
  console.log(`   - AI: ${rateLimitConfig.ai}/min`);
  console.log(`   - Auth: ${rateLimitConfig.auth}/min`);
  console.log(`   - Upload: ${rateLimitConfig.upload}/min`);
  console.log('');

  return process.env as EnvConfig;
}

/**
 * Get rate limit configuration with validated values
 */
export function getRateLimitConfig() {
  return {
    webhook: parseRateLimit('RATE_LIMIT_WEBHOOK', 60, 1, 1000),
    webhookWindow: parseRateLimit('RATE_LIMIT_WEBHOOK_WINDOW_MS', 60000, 1000, 3600000),
    pdfParse: parseRateLimit('RATE_LIMIT_PDF_PARSE', 30, 1, 500),
    pdfParseWindow: parseRateLimit('RATE_LIMIT_PDF_PARSE_WINDOW_MS', 60000, 1000, 3600000),
    ai: parseRateLimit('RATE_LIMIT_AI', 20, 1, 200),
    aiWindow: parseRateLimit('RATE_LIMIT_AI_WINDOW_MS', 60000, 1000, 3600000),
    auth: parseRateLimit('RATE_LIMIT_AUTH', 10, 1, 100),
    authWindow: parseRateLimit('RATE_LIMIT_AUTH_WINDOW_MS', 60000, 1000, 3600000),
    upload: parseRateLimit('RATE_LIMIT_UPLOAD', 30, 1, 500),
    uploadWindow: parseRateLimit('RATE_LIMIT_UPLOAD_WINDOW_MS', 60000, 1000, 3600000),
  };
}
