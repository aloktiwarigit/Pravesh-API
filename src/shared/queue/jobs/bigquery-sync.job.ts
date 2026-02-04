import { BigQueryPipelineService } from '../../../domains/analytics/bigquery-pipeline.service';

/**
 * Story 14-14: BigQuery sync job
 * Runs hourly via pg-boss to sync PostgreSQL to BigQuery
 */
export function createBigQuerySyncHandler(pipelineService: BigQueryPipelineService) {
  return async () => {
    console.log('[BigQuerySync] Starting sync pipeline');

    try {
      const result = await pipelineService.runSync();
      console.log(
        `[BigQuerySync] Completed: ${result.tablesProcessed} tables, ${result.totalRecords} records, ${result.durationMs}ms`
      );

      if (result.errors.length > 0) {
        console.warn('[BigQuerySync] Errors:', result.errors);
        // In production: send alert to ops team
      }

      return result;
    } catch (error) {
      console.error('[BigQuerySync] Pipeline failed:', error);
      throw error;
    }
  };
}

export const BIGQUERY_SYNC_SCHEDULE = '30 * * * *'; // 30 minutes past every hour
