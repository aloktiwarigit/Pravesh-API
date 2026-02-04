import { PrismaClient } from '@prisma/client';
import { ContractTerms } from './franchise.types';
import { BusinessError } from '../../shared/errors/business-error';
import * as ErrorCodes from '../../shared/errors/error-codes';
import { getCurrentMonth, getMonthRange } from '../../shared/utils/date';
import { calculatePercentage, formatPaiseForDisplay } from '../../shared/utils/money';

/**
 * Story 14-8: Franchise Revenue Share Calculation
 *
 * Automatic revenue share calculation based on franchise agreement terms.
 * Excludes government fees (only service fees are shared).
 * Monthly payouts processed by pg-boss scheduled job on the 5th.
 */
export class FranchiseRevenueService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Record a revenue share entry when a service is completed
   */
  async recordRevenueShare(params: {
    franchiseId: string;
    cityId: string;
    serviceRequestId: string;
    serviceFeePaise: number;
    adjustments?: Record<string, any>;
  }) {
    // Get franchise contract terms
    const franchise = await this.prisma.franchise.findUnique({
      where: { id: params.franchiseId },
    });

    if (!franchise) {
      throw new BusinessError(
        ErrorCodes.BUSINESS_FRANCHISE_NOT_FOUND,
        'Franchise not found',
        404
      );
    }

    const contractTerms = franchise.contractTerms as unknown as ContractTerms;
    const franchisePercentage = contractTerms.franchisePercentage; // still read from contract JSON
    const franchiseShareBps = Math.round(franchisePercentage * 100); // convert percentage to basis points for storage

    // Calculate shares
    let effectiveFeePaise = params.serviceFeePaise;

    // Apply adjustments (bulk discounts, referral credits, refunds)
    if (params.adjustments) {
      const adjustmentTotal = Object.values(params.adjustments).reduce(
        (sum: number, val: any) => sum + (typeof val === 'number' ? val : 0),
        0
      );
      effectiveFeePaise = Math.max(0, effectiveFeePaise + adjustmentTotal);
    }

    const franchiseSharePaise = calculatePercentage(effectiveFeePaise, franchisePercentage);
    const platformSharePaise = effectiveFeePaise - franchiseSharePaise;

    return this.prisma.franchiseRevenue.create({
      data: {
        franchiseId: params.franchiseId,
        cityId: params.cityId,
        serviceRequestId: params.serviceRequestId,
        serviceFeePaise: effectiveFeePaise,
        franchiseSharePaise,
        platformSharePaise,
        franchiseShareBps,
        month: getCurrentMonth(),
        status: 'pending',
        adjustments: params.adjustments as any || null,
      },
    });
  }

  /**
   * Get monthly revenue report for a franchise
   */
  async getMonthlyReport(franchiseId: string, month: string) {
    const { start, end } = getMonthRange(month);

    const entries = await this.prisma.franchiseRevenue.findMany({
      where: {
        franchiseId,
        month,
      },
      orderBy: { createdAt: 'desc' },
    });

    const summary = {
      month,
      totalServicesPaise: 0,
      totalFranchiseSharePaise: 0,
      totalPlatformSharePaise: 0,
      serviceCount: entries.length,
      entries,
    };

    for (const entry of entries) {
      summary.totalServicesPaise += entry.serviceFeePaise;
      summary.totalFranchiseSharePaise += entry.franchiseSharePaise;
      summary.totalPlatformSharePaise += entry.platformSharePaise;
    }

    return summary;
  }

  /**
   * Get revenue history for a franchise (multiple months)
   */
  async getRevenueHistory(franchiseId: string, months: number = 12) {
    const results: Array<{
      month: string;
      totalFeePaise: number;
      franchiseSharePaise: number;
      serviceCount: number;
      status: string;
    }> = [];

    // Get distinct months
    const revenueData = await this.prisma.franchiseRevenue.groupBy({
      by: ['month', 'status'],
      where: { franchiseId },
      _sum: {
        serviceFeePaise: true,
        franchiseSharePaise: true,
      },
      _count: true,
      orderBy: { month: 'desc' },
      take: months,
    });

    for (const entry of revenueData) {
      results.push({
        month: entry.month,
        totalFeePaise: entry._sum.serviceFeePaise || 0,
        franchiseSharePaise: entry._sum.franchiseSharePaise || 0,
        serviceCount: entry._count,
        status: entry.status,
      });
    }

    return results;
  }

  /**
   * Get transaction details for a specific month
   */
  async getTransactionDetails(franchiseId: string, month: string) {
    return this.prisma.franchiseRevenue.findMany({
      where: { franchiseId, month },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Process monthly payout (called by pg-boss job on the 5th)
   */
  async processMonthlyPayout(month: string) {
    const pendingEntries = await this.prisma.franchiseRevenue.findMany({
      where: { month, status: 'pending' },
      include: { franchise: true },
    });

    // Group by franchise
    const groupedByFranchise = new Map<string, typeof pendingEntries>();
    for (const entry of pendingEntries) {
      const existing = groupedByFranchise.get(entry.franchiseId) || [];
      existing.push(entry);
      groupedByFranchise.set(entry.franchiseId, existing);
    }

    const payoutResults = [];

    for (const [franchiseId, entries] of groupedByFranchise) {
      const totalPayoutPaise = entries.reduce((sum, e) => sum + e.franchiseSharePaise, 0);

      // Mark as approved for payout
      await this.prisma.franchiseRevenue.updateMany({
        where: {
          franchiseId,
          month,
          status: 'pending',
        },
        data: { status: 'approved' },
      });

      payoutResults.push({
        franchiseId,
        month,
        totalPayoutPaise,
        entryCount: entries.length,
      });
    }

    return payoutResults;
  }

  /**
   * Mark entries as paid after payout
   */
  async markAsPaid(franchiseId: string, month: string) {
    return this.prisma.franchiseRevenue.updateMany({
      where: {
        franchiseId,
        month,
        status: 'approved',
      },
      data: {
        status: 'paid',
        paidAt: new Date(),
      },
    });
  }
}
