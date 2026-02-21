/**
 * Refund Controller - HTTP endpoints for refund management
 *
 * Story 4.13: Refund Processing
 */

import { Router } from 'express';
import { PrismaClient, RefundReason, RefundStatus } from '@prisma/client';
import { z } from 'zod';
import { RefundService } from './refund.service';
import { RazorpayClient } from '../../core/integrations/razorpay.client';
import { authorize } from '../../middleware/authorize';

const initiateRefundSchema = z.object({
  paymentId: z.string().uuid(),
  amountPaise: z.number().int().positive(),
  reason: z.nativeEnum(RefundReason),
  reasonText: z.string().max(500).optional(),
});

const rejectRefundSchema = z.object({
  reason: z.string().min(1).max(500),
});

const listRefundsSchema = z.object({
  status: z.nativeEnum(RefundStatus).optional(),
  customerId: z.string().uuid().optional(),
  serviceRequestId: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export function createRefundController(
  prisma: PrismaClient,
  razorpay: RazorpayClient,
): Router {
  const router = Router();
  const refundService = new RefundService(prisma, razorpay);

  /**
   * POST /api/v1/payments/:paymentId/refund
   * Initiate a refund request for a payment.
   * Roles: ops_manager, super_admin
   */
  router.post(
    '/:paymentId/refund',
    authorize('ops_manager', 'super_admin'),
    async (req, res, next) => {
      try {
        const { paymentId } = req.params;
        const input = initiateRefundSchema.parse({ ...req.body, paymentId });
        const user = (req as any).user!;

        const result = await refundService.initiateRefund({
          paymentId: input.paymentId,
          amountPaise: input.amountPaise,
          reason: input.reason,
          reasonText: input.reasonText,
          initiatedBy: user.id,
          cityId: user.cityId,
        });

        res.status(201).json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/refunds
   * List refunds with filters.
   * Roles: ops_manager, super_admin, support_agent
   */
  router.get(
    '/',
    authorize('ops_manager', 'super_admin', 'support_agent'),
    async (req, res, next) => {
      try {
        const filters = listRefundsSchema.parse(req.query);
        const user = (req as any).user!;

        const result = await refundService.listRefunds({
          ...filters,
          cityId: user.role === 'super_admin' ? undefined : user.cityId,
        });

        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/refunds/:id
   * Get refund details.
   * Roles: ops_manager, super_admin, support_agent
   */
  router.get(
    '/:id',
    authorize('ops_manager', 'super_admin', 'support_agent'),
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const refund = await refundService.getRefund(id);

        res.json({ success: true, data: refund });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/refunds/:id/approve
   * Approve a pending refund request.
   * Roles: ops_manager, super_admin
   */
  router.post(
    '/:id/approve',
    authorize('ops_manager', 'super_admin'),
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const user = (req as any).user!;

        const result = await refundService.approveRefund(id, user.id);

        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/refunds/:id/reject
   * Reject a pending refund request.
   * Roles: ops_manager, super_admin
   */
  router.post(
    '/:id/reject',
    authorize('ops_manager', 'super_admin'),
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const { reason } = rejectRefundSchema.parse(req.body);
        const user = (req as any).user!;

        const result = await refundService.rejectRefund(id, user.id, reason);

        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/refunds/:id/process
   * Process an approved refund via Razorpay.
   * Roles: ops_manager, super_admin
   */
  router.post(
    '/:id/process',
    authorize('ops_manager', 'super_admin'),
    async (req, res, next) => {
      try {
        const { id } = req.params;

        const result = await refundService.processRefund(id);

        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
