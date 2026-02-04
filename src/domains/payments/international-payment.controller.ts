// Story 13-1: International UPI Payment Controller
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { InternationalPaymentService } from './international-payment.service.js';

const createOrderSchema = z.object({
  serviceRequestId: z.string().uuid(),
  amountPaise: z.number().int().positive(),
  customerCurrency: z.string().length(3).optional(),
});

const confirmPaymentSchema = z.object({
  razorpayOrderId: z.string(),
  razorpayPaymentId: z.string(),
  razorpaySignature: z.string(),
  foreignCurrencyAmount: z.number().int().optional(),
  exchangeRate: z.number().positive().optional(),
});

export function internationalPaymentRoutes(
  service: InternationalPaymentService
): Router {
  const router = Router();

  // POST /api/v1/payments/international-upi/create-order
  router.post(
    '/international-upi/create-order',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = createOrderSchema.parse(req.body);
        const result = await service.createInternationalUpiOrder({
          ...body,
          customerId: (req as any).user!.id,
        });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/payments/international-upi/confirm
  router.post(
    '/international-upi/confirm',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = confirmPaymentSchema.parse(req.body);
        const result = await service.confirmInternationalPayment(body);
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
