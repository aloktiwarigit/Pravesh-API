// Story 13-4: NRI Payment Reconciliation Dashboard Service
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export class NriPaymentDashboardService {
  constructor(private prisma: PrismaClient) {}

  async getPendingWireTransfers(filters?: {
    status?: string;
    agingDays?: number;
  }) {
    const where: any = { status: filters?.status || 'pending' };

    if (filters?.agingDays) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - filters.agingDays);
      where.createdAt = { lte: cutoff };
    }

    const transfers = await this.prisma.wireTransfer.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    // Calculate aging stats
    const now = Date.now();
    const agingStats = {
      total: transfers.length,
      over5Days: transfers.filter(
        (t) => now - t.createdAt.getTime() > 5 * 24 * 60 * 60 * 1000
      ).length,
      over7Days: transfers.filter(
        (t) => now - t.createdAt.getTime() > 7 * 24 * 60 * 60 * 1000
      ).length,
    };

    return {
      transfers: transfers.map((t) => ({
        ...t,
        daysPending: Math.ceil(
          (now - t.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        ),
        slaAtRisk:
          now - t.createdAt.getTime() > 5 * 24 * 60 * 60 * 1000,
      })),
      agingStats,
    };
  }

  async reconcilePayment(params: {
    wireTransferId: string;
    receivedAmountPaise: number;
    bankStatementUrl: string;
    opsUserId: string;
  }) {
    const wt = await this.prisma.wireTransfer.findUniqueOrThrow({
      where: { id: params.wireTransferId },
    });

    const variance = params.receivedAmountPaise - wt.amountPaise;

    // Update wire transfer
    await this.prisma.wireTransfer.update({
      where: { id: params.wireTransferId },
      data: {
        status: 'reconciled',
        receivedAmount: params.receivedAmountPaise,
        varianceAmount: variance,
        bankStatementUrl: params.bankStatementUrl,
        reconciledByUserId: params.opsUserId,
        reconciledAt: new Date(),
      },
    });

    // Update payment status
    await this.prisma.payment.update({
      where: { id: wt.paymentId },
      data: { status: 'paid', paidAt: new Date() },
    });

    // Log audit
    await this.prisma.paymentAuditLog.create({
      data: {
        id: crypto.randomUUID(),
        paymentId: wt.paymentId,
        wireTransferId: wt.id,
        action: variance !== 0 ? 'variance_flagged' : 'reconciled',
        performedBy: params.opsUserId,
        details: JSON.stringify({
          expectedPaise: wt.amountPaise,
          receivedPaise: params.receivedAmountPaise,
          variancePaise: variance,
        }),
      },
    });

    return { variance, hasVariance: variance !== 0 };
  }

  async sendPaymentReminder(wireTransferId: string, opsUserId: string) {
    const wt = await this.prisma.wireTransfer.findUniqueOrThrow({
      where: { id: wireTransferId },
    });

    // Log audit for the reminder
    await this.prisma.paymentAuditLog.create({
      data: {
        id: crypto.randomUUID(),
        paymentId: wt.paymentId,
        wireTransferId: wt.id,
        action: 'reminder_sent',
        performedBy: opsUserId,
        details: JSON.stringify({ sentAt: new Date().toISOString() }),
      },
    });

    return { sent: true };
  }
}
