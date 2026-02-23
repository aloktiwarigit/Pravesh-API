import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ExportService, ExportType, ExportFormat } from './export.service';
import { authorize } from '../../middleware/authorize';

const requestExportSchema = z.object({
  exportType: z.enum([
    'revenue', 'agent_performance', 'dealer_commissions',
    'service_list', 'sla_report', 'referral_history', 'pipeline_forecast',
  ]),
  format: z.enum(['pdf', 'csv', 'xlsx']),
  cityId: z.string().uuid().optional(),
  filters: z.record(z.string(), z.any()).optional(),
});

export function createExportController(service: ExportService): Router {
  const router = Router();

  // POST /api/v1/exports — Request an export (authorized roles only)
  router.post(
    '/',
    authorize('ops_manager', 'franchise_owner', 'super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = requestExportSchema.parse(req.body);
        const result = await service.requestExport({
          userId: req.user!.id,
          userRole: req.user!.role,
          cityId: body.cityId,
          exportType: body.exportType as ExportType,
          format: body.format as ExportFormat,
          filters: body.filters,
        });
        res.status(201).json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/exports/:id — Get export status
  router.get(
    '/:id',
    authorize('ops_manager', 'franchise_owner', 'super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const job = await service.getExportStatus(req.params.id);
        res.json({ success: true, data: job });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/exports — List user's exports
  router.get(
    '/',
    authorize('ops_manager', 'franchise_owner', 'super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const exports = await service.listUserExports(req.user!.id);
        res.json({ success: true, data: exports });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
