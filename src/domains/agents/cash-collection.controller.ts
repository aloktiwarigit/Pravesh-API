// Stories 3-13, 3-14: Cash Collection Controller
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CashCollectionService } from './cash-collection.service.js';

const createReceiptSchema = z.object({
  receiptId: z.string().uuid(),
  taskId: z.string().uuid(),
  serviceRequestId: z.string().uuid(),
  amountPaise: z.string().regex(/^\d+$/),
  customerName: z.string().min(1),
  serviceName: z.string().min(1),
  gpsLat: z.number().min(-90).max(90),
  gpsLng: z.number().min(-180).max(180),
  signatureHash: z.string().min(1),
  pdfUrl: z.string().url().optional(),
  idempotencyKey: z.string().optional(),
  clientTimestamp: z.string().datetime(),
});

const standaloneReceiptSchema = z.object({
  receiptId: z.string().uuid(),
  amountPaise: z.string().regex(/^\d+$/),
  customerName: z.string().min(1),
  serviceName: z.string().min(1),
  gpsLat: z.number().min(-90).max(90),
  gpsLng: z.number().min(-180).max(180),
  signatureHash: z.string().min(1),
  pdfUrl: z.string().url().optional(),
  idempotencyKey: z.string().optional(),
  clientTimestamp: z.string().datetime(),
  notes: z.string().max(500).optional(),
});

const recordDepositSchema = z.object({
  receiptIds: z.array(z.string().uuid()).min(1),
  depositAmountPaise: z.string().regex(/^\d+$/),
  depositMethod: z.enum(['bank_deposit', 'office_handover']),
  depositReference: z.string().optional(),
  depositPhotoUrl: z.string().url().optional(),
  gpsLat: z.number().min(-90).max(90),
  gpsLng: z.number().min(-180).max(180),
});

const verifyDepositSchema = z.object({
  approved: z.boolean(),
  notes: z.string().optional(),
});

export function cashCollectionRoutes(
  service: CashCollectionService,
): Router {
  const router = Router();

  // POST /api/v1/agents/cash/receipts
  router.post(
    '/receipts',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = createReceiptSchema.parse(req.body);
        const user = (req as any).user!;
        const result = await service.createReceipt({
          ...body,
          agentId: user.id,
          cityId: user.cityId,
        });
        res.status(result.alreadyProcessed ? 200 : 201).json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // POST /api/v1/agents/cash/standalone-receipts
  router.post(
    '/standalone-receipts',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = standaloneReceiptSchema.parse(req.body);
        const user = (req as any).user!;
        const result = await service.createStandaloneReceipt({
          ...body,
          agentId: user.id,
          cityId: user.cityId,
        });
        res.status(result.alreadyProcessed ? 200 : 201).json({
          success: true,
          data: result,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /api/v1/agents/cash/receipts
  router.get(
    '/receipts',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user!;
        const result = await service.getAgentReceipts(user.id, {
          isReconciled:
            req.query.isReconciled !== undefined
              ? req.query.isReconciled === 'true'
              : undefined,
          cursor: req.query.cursor as string | undefined,
          limit: parseInt(req.query.limit as string, 10) || 20,
        });
        res.json({ success: true, ...result });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /api/v1/agents/cash/balance
  router.get(
    '/balance',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user!;
        const balance = await service.getAgentCashBalance(user.id);
        res.json({ success: true, data: balance });
      } catch (error) {
        next(error);
      }
    },
  );

  // POST /api/v1/agents/cash/deposits
  router.post(
    '/deposits',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = recordDepositSchema.parse(req.body);
        const user = (req as any).user!;
        const deposit = await service.recordDeposit({
          ...body,
          agentId: user.id,
        });
        res.status(201).json({ success: true, data: deposit });
      } catch (error) {
        next(error);
      }
    },
  );

  // PATCH /api/v1/agents/cash/deposits/:depositId/verify
  router.patch(
    '/deposits/:depositId/verify',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = verifyDepositSchema.parse(req.body);
        const user = (req as any).user!;
        const result = await service.verifyDeposit(
          req.params.depositId,
          user.id,
          body.approved,
          body.notes,
        );
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
