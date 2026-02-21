import * as appInsights from 'applicationinsights';
import { logger } from '../utils/logger';

/**
 * Initialize Azure Application Insights.
 * Must be called BEFORE importing any other modules that make HTTP requests,
 * so that the SDK can monkey-patch them for automatic dependency tracking.
 *
 * Set APPLICATIONINSIGHTS_CONNECTION_STRING in environment to enable.
 */
export function initializeAppInsights(): void {
  const connectionString = process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;

  if (!connectionString) {
    logger.info('Application Insights disabled — no connection string provided');
    return;
  }

  appInsights
    .setup(connectionString)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true, true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(false) // We use pino, not console
    .setAutoDependencyCorrelation(true)
    .setDistributedTracingMode(appInsights.DistributedTracingModes.AI_AND_W3C)
    .setSendLiveMetrics(true)
    .start();

  // Set cloud role for Azure Portal identification
  appInsights.defaultClient.context.tags[
    appInsights.defaultClient.context.keys.cloudRole
  ] = 'pla-api-server';

  logger.info('Application Insights initialized');
}

/**
 * Access the default Application Insights client for custom telemetry.
 * Returns null if AppInsights is not initialized.
 */
export function getAppInsightsClient(): appInsights.TelemetryClient | null {
  try {
    return appInsights.defaultClient ?? null;
  } catch {
    return null;
  }
}
