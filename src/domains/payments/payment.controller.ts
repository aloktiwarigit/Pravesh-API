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
import { CreditApplicationService } from './credit-application.service';
import {
  createPaymentOrderSchema,
  verifyPaymentSchema,
  paymentStatusQuerySchema,
  createPaymentLinkSchema,
  applyCreditRequestSchema,
  recordFailureSchema,
  paymentHistoryQuerySchema,
} from './payment.validation';

export function createPaymentController(prisma: PrismaClient, razorpay: RazorpayClient): Router {
  const router = Router();
  const paymentService = new PaymentService(prisma, razorpay);
  const creditService = new CreditApplicationService(prisma);

  /**
   * GET /api/v1/payments
   * P0-4: Paginated payment history for the authenticated customer.
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user!;
      const query = paymentHistoryQuerySchema.parse(req.query);

      const result = await paymentService.getPaymentHistory(user.id, {
        page: query.page,
        limit: query.limit,
        status: query.status,
      });

      res.json({ success: true, data: result.payments, meta: result.meta });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/payments/create-order
   * Creates a Razorpay order for the customer to pay.
   * P0-2: amountPaise is now optional — derived from service request when omitted.
   */
  router.post('/create-order', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user!;
      const input = createPaymentOrderSchema.parse(req.body);

      const result = await paymentService.createOrder({
        serviceRequestId: input.serviceRequestId,
        amountPaise: input.amountPaise != null ? Number(input.amountPaise) : undefined,
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
   * P0-3: serviceRequestId and amountPaise are now optional — looked up from stored order.
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
        amountPaise: input.amountPaise != null ? Number(input.amountPaise) : undefined,
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

  /**
   * POST /api/v1/payments/record-failure
   * P2-1: Records a payment failure for audit trail.
   */
  router.post('/record-failure', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user!;
      const input = recordFailureSchema.parse(req.body);

      const result = await paymentService.recordFailure({
        razorpayOrderId: input.razorpayOrderId,
        reason: input.reason,
        customerId: user.id,
      });

      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  });

  /**
   * POST /api/v1/payments/apply-credits
   * P2-2: Calculates payment breakdown with optional credit application.
   */
  router.post('/apply-credits', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user!;
      const input = applyCreditRequestSchema.parse(req.body);

      const breakdown = await creditService.calculateBreakdown(
        user.id,
        input.serviceRequestId,
        input.applyCredits,
      );

      res.json({
        success: true,
        data: {
          serviceFeePaise: breakdown.serviceFeePaise.toString(),
          govtFeePaise: breakdown.govtFeePaise.toString(),
          creditsAppliedPaise: breakdown.creditsAppliedPaise.toString(),
          razorpayChargePaise: breakdown.razorpayChargePaise.toString(),
          totalPaise: breakdown.totalPaise.toString(),
          creditBalancePaise: breakdown.creditBalancePaise.toString(),
          creditBalanceAfterPaise: breakdown.creditBalanceAfterPaise.toString(),
        },
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/payments/:paymentId/receipt-url
   * P2-3: Returns receipt URL for a payment (stub — full PDF generation is a separate epic).
   */
  router.get('/:paymentId/receipt-url', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { paymentId } = req.params;
      res.json({
        success: true,
        data: { paymentId, receiptUrl: null, message: 'Receipt generation not yet available' },
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/payments/:paymentId/govt-receipt
   * P2-3: Returns govt receipt URL for a payment (stub).
   */
  router.get('/:paymentId/govt-receipt', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { paymentId } = req.params;
      res.json({
        success: true,
        data: { paymentId, govtReceiptUrl: null, message: 'Govt receipt not yet available' },
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
