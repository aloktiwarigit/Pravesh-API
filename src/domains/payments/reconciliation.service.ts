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

    // TODO: CashReceipt model does not exist in schema yet.
    // Stubbed: returning zero cash receipts until the model is added.
    const totalCashReceiptsPaise = 0;
    const receiptCount = 0;

    const discrepancyPaise = totalPaymentsPaise - totalCashReceiptsPaise;

    const status = discrepancyPaise === 0
      ? 'MATCHED'
      : discrepancyPaise > 0
        ? 'SHORTAGE'
        : 'EXCESS';

    // TODO: CashReconciliationLog model does not exist in schema yet.
    // Stubbed: returning a synthetic log object until the model is added.
    const log = {
      id: crypto.randomUUID(),
      reconciliationDate: startOfDay,
      totalPaymentsPaise,
      totalCashReceiptsPaise,
      discrepancyPaise,
      status,
      paymentCount: payments.length,
      receiptCount,
    };

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
    // TODO: CashReconciliationLog model does not exist in schema yet.
    // Stubbed: returning empty array until the model is added.
    const logs: Array<{
      id: string;
      reconciliationDate: Date;
      totalPaymentsPaise: number;
      totalCashReceiptsPaise: number;
      discrepancyPaise: number;
      status: string;
      paymentCount: number;
      receiptCount: number;
    }> = [];

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
