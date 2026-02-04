/**
 * Environment Configuration
 * Validates and exports all required environment variables
 */

import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().default('postgresql://localhost:5432/property_legal_agent'),

  // Firebase
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  // WhatsApp Business API (Story 7-4)
  WHATSAPP_PHONE_NUMBER_ID: z.string().default(''),
  WHATSAPP_ACCESS_TOKEN: z.string().default(''),
  WHATSAPP_VERIFY_TOKEN: z.string().default(''),
  WHATSAPP_APP_SECRET: z.string().default(''),

  // SMS Gateway (Story 7-5)
  SMS_API_KEY: z.string().default(''),
  SMS_SENDER_ID: z.string().default('PROPLA'),
  SMS_BASE_URL: z.string().default('https://api.msg91.com/api/v5'),

  // Monitoring (Story 7-8)
  SLACK_DEVOPS_WEBHOOK_URL: z.string().optional(),

  // CORS
  CORS_ORIGINS: z.string().optional(),
});

export const env = envSchema.parse(process.env);
