import { defineConfig } from "drizzle-kit";

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL'];

// Add production-specific required variables
if (process.env.NODE_ENV === 'production') {
  requiredEnvVars.push(
    'SESSION_SECRET',
    'WEBHOOK_KEY_SECRET',
    'COMPANIES_HOUSE_API_KEY',
    'GOCARDLESS_ACCESS_TOKEN',
    'GOCARDLESS_ENVIRONMENT',
    'RESEND_API_KEY',
    'RESEND_FROM_EMAIL'
  );
}

const missing = requiredEnvVars.filter(key => !process.env[key]);
if (missing.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missing.join(', ')}\n` +
    `Please ensure all required secrets are set in your environment.`
  );
}

// Validate DATABASE_URL format
if (!process.env.DATABASE_URL.startsWith('postgres://') && 
    !process.env.DATABASE_URL.startsWith('postgresql://')) {
  throw new Error('DATABASE_URL must be a valid PostgreSQL connection string');
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
