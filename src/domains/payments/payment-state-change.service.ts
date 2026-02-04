/**
 * Payment state change logging service.
 * All state transitions are recorded as append-only entries.
 *
 * Story 4.9: Immutable Payment Audit Trail
 */
import { PrismaClient } from '@prisma/client';

export class PaymentStateChangeService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Logs a payment state transition.
   * This is INSERT-only — records are never updated or deleted.
   */
  async logStateChange(params: {
    paymentId: string;
    oldState: string;
    newState: string;
    changedBy: string;
    metadata?: Record<string, unknown>;
  }) {
    // TODO: PaymentStateChange model does not exist in Prisma schema yet. Using (prisma as any).
    return (this.prisma as any).paymentStateChange.create({
      data: {
        paymentId: params.paymentId,
        oldState: params.oldState,
        newState: params.newState,
        changedBy: params.changedBy,
        metadata: params.metadata ? JSON.stringify(params.metadata) : undefined,
      },
    });
  }

  /**
   * Gets the audit trail for a payment.
   */
  async getAuditTrail(paymentId: string) {
    // TODO: PaymentStateChange model does not exist in Prisma schema yet. Using (prisma as any).
    return (this.prisma as any).paymentStateChange.findMany({
      where: { paymentId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
