// Story 13-4: NRI Payment Reconciliation Dashboard Controller
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { NriPaymentDashboardService } from './nri-payment-dashboard.service.js';

export function nriPaymentDashboardRoutes(
  service: NriPaymentDashboardService
): Router {
  const router = Router();

  // GET /api/v1/ops/nri-payments/pending
  router.get(
    '/pending',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const agingDays = req.query.agingDays
          ? parseInt(req.query.agingDays as string)
          : undefined;
        const result = await service.getPendingWireTransfers({ agingDays });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/ops/nri-payments/reconcile
  router.post(
    '/reconcile',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z
          .object({
            wireTransferId: z.string().uuid(),
            receivedAmountPaise: z.number().int().positive(),
            bankStatementUrl: z.string().url(),
          })
          .parse(req.body);
        const result = await service.reconcilePayment({
          ...body,
          opsUserId: (req as any).user!.id,
        });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/ops/nri-payments/send-reminder
  router.post(
    '/send-reminder',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { wireTransferId } = z
          .object({ wireTransferId: z.string().uuid() })
          .parse(req.body);
        await service.sendPaymentReminder(
          wireTransferId,
          (req as any).user!.id
        );
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
