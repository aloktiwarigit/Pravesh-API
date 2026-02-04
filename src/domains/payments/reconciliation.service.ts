/**
 * Cash reconciliation service for ops dashboard.
 *
 * Story 4.8: Cash Reconciliation Dashboard for Ops
 */
import { PrismaClient } from '@prisma/client';

export class ReconciliationService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Runs daily reconciliation for a tenant.
   * Compares collected cash receipts against expected amounts.
   *
   * Story 4.8 AC1-AC3
   */
  async runDailyReconciliation(cityId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all successful payments for the day
    const payments = await this.prisma.payment.findMany({
      where: {
        status: 'paid',
        paidAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    const totalPaymentsPaise = payments.reduce((sum, p) => sum + p.amountPaise, 0);

    // Get all cash receipts for the day
    const cashReceipts = await this.prisma.cashReceipt.findMany({
      where: {
        cityId,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
      select: { amountPaise: true },
    });

    const totalCashReceiptsPaise = cashReceipts.reduce(
      (sum, r) => sum + Number(r.amountPaise),
      0,
    );

    const discrepancyPaise = totalPaymentsPaise - totalCashReceiptsPaise;

    const status = discrepancyPaise === 0
      ? 'MATCHED'
      : discrepancyPaise > 0
        ? 'SHORTAGE'
        : 'EXCESS';

    // Create reconciliation log
    const log = await this.prisma.cashReconciliationLog.create({
      data: {
        cityId,
        reconciliationDate: startOfDay,
        totalPaymentsPaise,
        totalCashReceiptsPaise,
        discrepancyPaise,
        status,
        paymentCount: payments.length,
        receiptCount: cashReceipts.length,
      },
    });

    return {
      id: log.id,
      reconciliationDate: log.reconciliationDate.toISOString(),
      totalPaymentsPaise: log.totalPaymentsPaise.toString(),
      totalCashReceiptsPaise: log.totalCashReceiptsPaise.toString(),
      discrepancyPaise: log.discrepancyPaise.toString(),
      status: log.status,
      paymentCount: log.paymentCount,
      receiptCount: log.receiptCount,
    };
  }

  /**
   * Gets reconciliation logs for a date range.
   */
  async getReconciliationLogs(cityId: string, startDate: Date, endDate: Date) {
    const logs = await this.prisma.cashReconciliationLog.findMany({
      where: {
        cityId,
        reconciliationDate: { gte: startDate, lte: endDate },
      },
      orderBy: { reconciliationDate: 'desc' },
    });

    return logs.map((l) => ({
      id: l.id,
      reconciliationDate: l.reconciliationDate.toISOString(),
      totalPaymentsPaise: l.totalPaymentsPaise.toString(),
      totalCashReceiptsPaise: l.totalCashReceiptsPaise.toString(),
      discrepancyPaise: l.discrepancyPaise.toString(),
      status: l.status,
      paymentCount: l.paymentCount,
      receiptCount: l.receiptCount,
    }));
  }
}
