import { Router, Request, Response, NextFunction } from 'express';
import { BigQueryPipelineService } from './bigquery-pipeline.service';
import { authorize } from '../../middleware/authorize';

/**
 * Story 14-14: BigQuery Pipeline Controller
 * Provides health monitoring and manual sync trigger endpoints.
 */
export function createBigQueryPipelineController(service: BigQueryPipelineService): Router {
  const router = Router();

  // GET /api/v1/bigquery/health — Pipeline health (AC10)
  router.get(
    '/health',
    authorize('super_admin'),
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const health = await service.getPipelineHealth();
        res.json({ success: true, data: health });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/bigquery/logs — Sync logs
  router.get(
    '/logs',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const limit = parseInt(req.query.limit as string || '50', 10);
        const logs = await service.getSyncLogs(limit);
        res.json({ success: true, data: logs });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/bigquery/sync — Manual sync trigger (Super Admin)
  router.post(
    '/sync',
    authorize('super_admin'),
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.runSync();
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
