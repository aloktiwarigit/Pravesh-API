/**
 * Refund Service - Razorpay Refund Integration
 *
 * Story 4.13: Refund Processing
 *
 * Handles:
 * - Initiating refund requests
 * - Processing refunds via Razorpay API
 * - Tracking refund status
 */

import { PrismaClient, RefundStatus, RefundReason } from '@prisma/client';
import { RazorpayClient } from '../../core/integrations/razorpay.client';
import { BusinessError } from '../../shared/errors/business-error';
import { nanoid } from 'nanoid';

export interface InitiateRefundInput {
  paymentId: string;
  amountPaise: number;
  reason: RefundReason;
  reasonText?: string;
  initiatedBy: string;
  cityId: string;
}

export interface RefundResult {
  refundId: string;
  paymentId: string;
  amountPaise: number;
  status: RefundStatus;
  razorpayRefundId?: string;
}

export class RefundService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly razorpay: RazorpayClient,
  ) {}

  /**
   * Initiates a refund request.
   * AC1: Creates refund record in PENDING status for approval.
   */
  async initiateRefund(input: InitiateRefundInput): Promise<RefundResult> {
    const { paymentId, amountPaise, reason, reasonText, initiatedBy, cityId } = input;

    // Validate payment exists and is paid
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new BusinessError('PAYMENT_NOT_FOUND', 'Payment not found', 404);
    }

    if (payment.status !== 'paid') {
      throw new BusinessError('PAYMENT_NOT_PAID', 'Only paid payments can be refunded', 422);
    }

    if (!payment.razorpayPaymentId) {
      throw new BusinessError('NO_RAZORPAY_PAYMENT', 'Payment has no Razorpay payment ID', 422);
    }

    // Validate refund amount
    if (amountPaise <= 0) {
      throw new BusinessError('INVALID_REFUND_AMOUNT', 'Refund amount must be positive', 422);
    }

    if (amountPaise > payment.amountPaise) {
      throw new BusinessError('REFUND_EXCEEDS_PAYMENT', 'Refund amount cannot exceed payment amount', 422);
    }

    // Check for existing pending/processing refunds
    const existingRefund = await this.prisma.refund.findFirst({
      where: {
        paymentId,
        status: { in: [RefundStatus.PENDING, RefundStatus.APPROVED, RefundStatus.PROCESSING] },
      },
    });

    if (existingRefund) {
      throw new BusinessError(
        'REFUND_IN_PROGRESS',
        'A refund is already in progress for this payment',
        422,
      );
    }

    // Check total refunded amount
    const completedRefunds = await this.prisma.refund.findMany({
      where: {
        paymentId,
        status: RefundStatus.COMPLETED,
      },
      select: { amountPaise: true },
    });

    const totalRefunded = completedRefunds.reduce((sum, r) => sum + r.amountPaise, 0);
    const remainingRefundable = payment.amountPaise - totalRefunded;

    if (amountPaise > remainingRefundable) {
      throw new BusinessError(
        'REFUND_EXCEEDS_REMAINING',
        `Maximum refundable amount is ${remainingRefundable} paise`,
        422,
        { remainingRefundablePaise: remainingRefundable },
      );
    }

    // Create refund record
    const refund = await this.prisma.refund.create({
      data: {
        paymentId,
        serviceRequestId: payment.serviceRequestId,
        customerId: payment.customerId,
        amountPaise,
        reason,
        reasonText,
        status: RefundStatus.PENDING,
        initiatedBy,
        cityId,
      },
    });

    return {
      refundId: refund.id,
      paymentId,
      amountPaise,
      status: refund.status,
    };
  }

  /**
   * Approves a pending refund request.
   * AC2: Manager approval before processing.
   */
  async approveRefund(refundId: string, approvedBy: string): Promise<RefundResult> {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
    });

    if (!refund) {
      throw new BusinessError('REFUND_NOT_FOUND', 'Refund not found', 404);
    }

    if (refund.status !== RefundStatus.PENDING) {
      throw new BusinessError(
        'REFUND_NOT_PENDING',
        `Refund is ${refund.status.toLowerCase()}, cannot approve`,
        422,
      );
    }

    const updatedRefund = await this.prisma.refund.update({
      where: { id: refundId },
      data: {
        status: RefundStatus.APPROVED,
        approvedBy,
        approvedAt: new Date(),
      },
    });

    return {
      refundId: updatedRefund.id,
      paymentId: updatedRefund.paymentId,
      amountPaise: updatedRefund.amountPaise,
      status: updatedRefund.status,
    };
  }

  /**
   * Rejects a pending refund request.
   */
  async rejectRefund(refundId: string, rejectedBy: string, reason: string): Promise<RefundResult> {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
    });

    if (!refund) {
      throw new BusinessError('REFUND_NOT_FOUND', 'Refund not found', 404);
    }

    if (refund.status !== RefundStatus.PENDING) {
      throw new BusinessError(
        'REFUND_NOT_PENDING',
        `Refund is ${refund.status.toLowerCase()}, cannot reject`,
        422,
      );
    }

    const updatedRefund = await this.prisma.refund.update({
      where: { id: refundId },
      data: {
        status: RefundStatus.REJECTED,
        approvedBy: rejectedBy,
        approvedAt: new Date(),
        failureReason: reason,
      },
    });

    return {
      refundId: updatedRefund.id,
      paymentId: updatedRefund.paymentId,
      amountPaise: updatedRefund.amountPaise,
      status: updatedRefund.status,
    };
  }

  /**
   * Processes an approved refund via Razorpay API.
   * AC3: Execute refund after approval.
   */
  async processRefund(refundId: string): Promise<RefundResult> {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
    });

    if (!refund) {
      throw new BusinessError('REFUND_NOT_FOUND', 'Refund not found', 404);
    }

    if (refund.status !== RefundStatus.APPROVED) {
      throw new BusinessError(
        'REFUND_NOT_APPROVED',
        `Refund must be approved before processing (current: ${refund.status.toLowerCase()})`,
        422,
      );
    }

    // Get payment for Razorpay payment ID
    const payment = await this.prisma.payment.findUnique({
      where: { id: refund.paymentId },
    });

    if (!payment?.razorpayPaymentId) {
      throw new BusinessError('NO_RAZORPAY_PAYMENT', 'Payment has no Razorpay payment ID', 422);
    }

    try {
      // Mark as processing
      await this.prisma.refund.update({
        where: { id: refundId },
        data: { status: RefundStatus.PROCESSING },
      });

      // Call Razorpay refund API
      const razorpayRefund = await this.razorpay.refund(
        payment.razorpayPaymentId,
        refund.amountPaise,
      );

      // Update with Razorpay refund ID
      const updatedRefund = await this.prisma.refund.update({
        where: { id: refundId },
        data: {
          razorpayRefundId: razorpayRefund.id,
          status: razorpayRefund.status === 'processed'
            ? RefundStatus.COMPLETED
            : RefundStatus.PROCESSING,
          processedAt: razorpayRefund.status === 'processed' ? new Date() : null,
        },
      });

      // Update payment status if fully refunded
      const totalRefunded = await this.getTotalRefundedAmount(payment.id);
      if (totalRefunded >= payment.amountPaise) {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: 'refunded' },
        });
      }

      return {
        refundId: updatedRefund.id,
        paymentId: updatedRefund.paymentId,
        amountPaise: updatedRefund.amountPaise,
        status: updatedRefund.status,
        razorpayRefundId: razorpayRefund.id,
      };
    } catch (error) {
      // Mark refund as failed
      await this.prisma.refund.update({
        where: { id: refundId },
        data: {
          status: RefundStatus.FAILED,
          failureReason: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  /**
   * Processes a refund webhook from Razorpay.
   */
  async processRefundWebhook(razorpayRefundId: string, status: string): Promise<void> {
    const refund = await this.prisma.refund.findFirst({
      where: { razorpayRefundId },
    });

    if (!refund) {
      return; // Unknown refund, ignore
    }

    const newStatus = status === 'processed'
      ? RefundStatus.COMPLETED
      : status === 'failed'
        ? RefundStatus.FAILED
        : refund.status;

    await this.prisma.refund.update({
      where: { id: refund.id },
      data: {
        status: newStatus,
        processedAt: newStatus === RefundStatus.COMPLETED ? new Date() : null,
      },
    });

    // Update payment status if fully refunded
    if (newStatus === RefundStatus.COMPLETED) {
      const payment = await this.prisma.payment.findUnique({
        where: { id: refund.paymentId },
      });

      if (payment) {
        const totalRefunded = await this.getTotalRefundedAmount(payment.id);
        if (totalRefunded >= payment.amountPaise) {
          await this.prisma.payment.update({
            where: { id: payment.id },
            data: { status: 'refunded' },
          });
        }
      }
    }
  }

  /**
   * Gets refund by ID.
   */
  async getRefund(refundId: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
    });

    if (!refund) {
      throw new BusinessError('REFUND_NOT_FOUND', 'Refund not found', 404);
    }

    return refund;
  }

  /**
   * Lists refunds with filters.
   */
  async listRefunds(options: {
    cityId?: string;
    status?: RefundStatus;
    customerId?: string;
    serviceRequestId?: string;
    limit?: number;
    offset?: number;
  }) {
    const { cityId, status, customerId, serviceRequestId, limit = 20, offset = 0 } = options;

    const where = {
      ...(cityId && { cityId }),
      ...(status && { status }),
      ...(customerId && { customerId }),
      ...(serviceRequestId && { serviceRequestId }),
    };

    const [refunds, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.refund.count({ where }),
    ]);

    return {
      refunds,
      total,
      limit,
      offset,
    };
  }

  /**
   * Gets total refunded amount for a payment.
   */
  private async getTotalRefundedAmount(paymentId: string): Promise<number> {
    const refunds = await this.prisma.refund.findMany({
      where: {
        paymentId,
        status: RefundStatus.COMPLETED,
      },
      select: { amountPaise: true },
    });

    return refunds.reduce((sum, r) => sum + r.amountPaise, 0);
  }
}
