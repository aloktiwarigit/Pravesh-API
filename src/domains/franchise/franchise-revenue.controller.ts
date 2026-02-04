import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { FranchiseRevenueService } from './franchise-revenue.service';
import { authorize } from '../../middleware/authorize';

export function createFranchiseRevenueController(service: FranchiseRevenueService): Router {
  const router = Router();

  // POST /api/v1/franchise-revenue — Record revenue share (internal/system)
  router.post(
    '/',
    authorize('super_admin', 'ops'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z.object({
          franchiseId: z.string().uuid(),
          cityId: z.string().uuid(),
          serviceRequestId: z.string().uuid(),
          serviceFeePaise: z.number().int().min(0),
          adjustments: z.record(z.string(), z.number()).optional(),
        }).parse(req.body);

        const revenue = await service.recordRevenueShare(body);
        res.status(201).json({ success: true, data: revenue });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/franchise-revenue/:franchiseId/monthly/:month — Monthly report
  router.get(
    '/:franchiseId/monthly/:month',
    authorize('franchise_owner', 'super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const report = await service.getMonthlyReport(
          req.params.franchiseId,
          req.params.month
        );
        res.json({ success: true, data: report });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/franchise-revenue/:franchiseId/history — Revenue history
  router.get(
    '/:franchiseId/history',
    authorize('franchise_owner', 'super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const months = parseInt(req.query.months as string || '12', 10);
        const history = await service.getRevenueHistory(req.params.franchiseId, months);
        res.json({ success: true, data: history });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/franchise-revenue/:franchiseId/transactions/:month — Transaction details
  router.get(
    '/:franchiseId/transactions/:month',
    authorize('franchise_owner', 'super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const transactions = await service.getTransactionDetails(
          req.params.franchiseId,
          req.params.month
        );
        res.json({ success: true, data: transactions });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/franchise-revenue/process-payout/:month — Process payout (Super Admin)
  router.post(
    '/process-payout/:month',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const results = await service.processMonthlyPayout(req.params.month);
        res.json({ success: true, data: results });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/franchise-revenue/:franchiseId/mark-paid/:month — Mark as paid
  router.post(
    '/:franchiseId/mark-paid/:month',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.markAsPaid(req.params.franchiseId, req.params.month);
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
