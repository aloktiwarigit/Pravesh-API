/**
 * Environment configuration loader
 */
export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/property_legal_agent',
  corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],

  // Firebase
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
  firebaseServiceAccountKey: process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '',

  // BigQuery
  bigQueryProjectId: process.env.BIGQUERY_PROJECT_ID || '',
  bigQueryDataset: process.env.BIGQUERY_DATASET || 'property_legal_agent',

  // Cache
  cityCacheTtlMs: parseInt(process.env.CITY_CACHE_TTL_MS || '3600000', 10), // 1 hour

  // Exports
  maxSyncExportRows: 10000,
  exportUrlExpiryHours: 24,
};
