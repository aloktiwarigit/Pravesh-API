import { z } from 'zod';
import { logger } from '../shared/utils/logger';

/**
 * Zod schema for environment variable validation.
 * App fails fast on startup if critical vars are missing.
 */
const envSchema = z.object({
  // Server
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // Database (required)
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required').startsWith('postgresql', 'DATABASE_URL must be a PostgreSQL connection string'),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // Firebase (optional in dev, required in production)
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().email().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  // Razorpay (optional in dev)
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

  // BigQuery (optional)
  BIGQUERY_PROJECT_ID: z.string().optional(),
  BIGQUERY_DATASET: z.string().default('property_legal_agent'),

  // Cache
  CITY_CACHE_TTL_MS: z.coerce.number().int().positive().default(3600000),

  // Dev auth bypass
  DEV_AUTH_BYPASS: z.string().optional(),

  // Logging
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).optional(),

  // Redis (optional — enables distributed rate limiting)
  REDIS_URL: z.string().optional(),

  // Azure Application Insights (optional)
  APPLICATIONINSIGHTS_CONNECTION_STRING: z.string().optional(),

  // Encryption key for PII (PAN, bank accounts) — 64-char hex string (32 bytes)
  ENCRYPTION_KEY: z.string().length(64).optional(),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    // Log each validation error clearly
    const errors = result.error.flatten().fieldErrors;
    logger.fatal({ errors }, 'Environment validation failed — fix .env and restart');
    // In test mode, don't exit — let tests handle it
    if (process.env.NODE_ENV !== 'test') {
      process.exit(1);
    }
    // Return partial config for tests
    return envSchema.parse({ ...process.env, DATABASE_URL: process.env.DATABASE_URL || 'postgresql://localhost:5432/test' });
  }

  return result.data;
}

const env = loadConfig();

export const config = {
  port: env.PORT,
  nodeEnv: env.NODE_ENV,
  databaseUrl: env.DATABASE_URL,
  corsOrigins: env.CORS_ORIGINS.split(','),

  // Firebase
  firebaseProjectId: env.FIREBASE_PROJECT_ID || '',
  firebaseClientEmail: env.FIREBASE_CLIENT_EMAIL || '',
  firebasePrivateKey: env.FIREBASE_PRIVATE_KEY || '',

  // Razorpay
  razorpayKeyId: env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: env.RAZORPAY_KEY_SECRET || '',
  razorpayWebhookSecret: env.RAZORPAY_WEBHOOK_SECRET || '',

  // BigQuery
  bigQueryProjectId: env.BIGQUERY_PROJECT_ID || '',
  bigQueryDataset: env.BIGQUERY_DATASET,

  // Cache
  cityCacheTtlMs: env.CITY_CACHE_TTL_MS,

  // Exports
  maxSyncExportRows: 10000,
  exportUrlExpiryHours: 24,
};
