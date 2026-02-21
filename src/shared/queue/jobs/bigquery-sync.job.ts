import { BigQueryPipelineService } from '../../../domains/analytics/bigquery-pipeline.service';
import { logger } from '../../utils/logger';

/**
 * Story 14-14: BigQuery sync job
 * Runs hourly via pg-boss to sync PostgreSQL to BigQuery
 */
export function createBigQuerySyncHandler(pipelineService: BigQueryPipelineService) {
  return async () => {
    logger.info('[BigQuerySync] Starting sync pipeline');

    try {
      const result = await pipelineService.runSync();
      logger.info(
        { tablesProcessed: result.tablesProcessed, totalRecords: result.totalRecords, durationMs: result.durationMs },
        '[BigQuerySync] Completed'
      );

      if (result.errors.length > 0) {
        logger.warn({ errors: result.errors }, '[BigQuerySync] Errors occurred');
        // In production: send alert to ops team
      }

      return result;
    } catch (error) {
      logger.error({ error }, '[BigQuerySync] Pipeline failed');
      throw error;
    }
  };
}

export const BIGQUERY_SYNC_SCHEDULE = '30 * * * *'; // 30 minutes past every hour
