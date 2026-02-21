/**
 * Payment Controller — HTTP endpoints for payment order creation & verification.
 *
 * Story 4.1: Razorpay SDK Integration
 * Story 4.2: WhatsApp Payment Link Fallback
 */
import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { RazorpayClient } from '../../core/integrations/razorpay.client';
import { PaymentService } from './payment.service';
import {
  createPaymentOrderSchema,
  verifyPaymentSchema,
  paymentStatusQuerySchema,
  createPaymentLinkSchema,
} from './payment.validation';

export function createPaymentController(prisma: PrismaClient, razorpay: RazorpayClient): Router {
  const router = Router();
  const paymentService = new PaymentService(prisma, razorpay);

  /**
   * POST /api/v1/payments/create-order
   * Creates a Razorpay order for the customer to pay.
   */
  router.post('/create-order', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user!;
      const input = createPaymentOrderSchema.parse(req.body);

      const result = await paymentService.createOrder({
        serviceRequestId: input.serviceRequestId,
        amountPaise: Number(input.amountPaise),
        currency: input.currency,
        customerId: user.id,
        cityId: user.cityId,
        notes: input.notes,
      });

      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/payments/verify
   * Verifies Razorpay payment after Flutter SDK completes checkout.
   */
  router.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user!;
      const input = verifyPaymentSchema.parse(req.body);

      const result = await paymentService.verifyPayment({
        razorpayOrderId: input.razorpayOrderId,
        razorpayPaymentId: input.razorpayPaymentId,
        razorpaySignature: input.razorpaySignature,
        serviceRequestId: input.serviceRequestId,
        amountPaise: Number(input.amountPaise),
        customerId: user.id,
        cityId: user.cityId,
        paymentMethodType: input.paymentMethod,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/payments/status?serviceRequestId=xxx
   * Gets payment status for a service request.
   */
  router.get('/status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user!;
      const { serviceRequestId } = paymentStatusQuerySchema.parse(req.query);

      const payments = await paymentService.getPaymentStatus(serviceRequestId, user.id);

      res.json({ success: true, data: payments });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/payments/payment-link
   * Creates a payment link for WhatsApp fallback.
   */
  router.post('/payment-link', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user!;
      const input = createPaymentLinkSchema.parse(req.body);

      const result = await paymentService.createPaymentLink({
        serviceRequestId: input.serviceRequestId,
        amountPaise: Number(input.amountPaise),
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail,
        description: input.description,
        expiryMinutes: input.expiryMinutes,
        customerId: user.id,
        cityId: user.cityId,
      });

      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
