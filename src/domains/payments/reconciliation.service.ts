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
  async runDailyReconciliation(tenantId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all successful payments for the day
    // Note: Payment model has no tenantId/cityId field; filter by date and status only.
    const payments = await this.prisma.payment.findMany({
      where: {
        status: 'SUCCESS',
        paidAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    // Payment.amountPaise is Int (number in TypeScript)
    const totalPaymentsPaise: number = payments.reduce(
      (sum: number, p: { amountPaise: number }) => sum + p.amountPaise,
      0,
    );

    // Get all cash receipts for the day
    const cashReceipts = await this.prisma.cashReceipt.findMany({
      where: {
        cityId: tenantId,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
      select: { amountPaise: true },
    });

    // CashReceipt.amountPaise is String (BigInt stored as string); parse to number
    const totalCashReceiptsPaise: number = cashReceipts.reduce(
      (sum: number, r: { amountPaise: string }) => sum + Number(r.amountPaise),
      0,
    );

    const discrepancyPaise: number = totalPaymentsPaise - totalCashReceiptsPaise;

    const status =
      discrepancyPaise === 0
        ? 'MATCHED'
        : discrepancyPaise > 0
          ? 'SHORTAGE'
          : 'EXCESS';

    // Create reconciliation log
    const log = await this.prisma.cashReconciliationLog.create({
      data: {
        cityId: tenantId,
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
