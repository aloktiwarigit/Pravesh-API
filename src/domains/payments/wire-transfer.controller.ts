// Story 13-2: Wire Transfer Controller
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { WireTransferService } from './wire-transfer.service.js';

const initiateSchema = z.object({
  serviceRequestId: z.string().uuid(),
  amountPaise: z.number().int().positive(),
  foreignCurrencyCode: z.string().length(3).optional(),
  foreignAmount: z.number().int().optional(),
});

const reconcileSchema = z.object({
  wireTransferId: z.string().uuid(),
  receivedAmountPaise: z.number().int().positive(),
  bankStatementUrl: z.string().url(),
});

export function wireTransferRoutes(service: WireTransferService): Router {
  const router = Router();

  // POST /api/v1/wire-transfers/initiate
  router.post(
    '/initiate',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = initiateSchema.parse(req.body);
        const result = await service.initiateWireTransfer({
          ...body,
          customerId: (req as any).user!.id,
        });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/wire-transfers/reconcile
  router.post(
    '/reconcile',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = reconcileSchema.parse(req.body);
        const result = await service.reconcileWireTransfer({
          ...body,
          reconciledByUserId: (req as any).user!.id,
        });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/wire-transfers/pending
  router.get(
    '/pending',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const transfers = await service.getPendingWireTransfers();
        res.json({ success: true, data: transfers });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
