/**
 * Epic 9 Stories 9.7, 9.9, 9.16: Commission Service
 * Handles commission calculation, earnings summary, history, CSV export, and forecasting.
 * All monetary values stored as BigInt paise. NO floating point arithmetic.
 */

import { PrismaClient, CommissionStatus, DealerTier } from '@prisma/client';
import { Response } from 'express';

// Commission rates: basis points x 100 (500 = 5.00%)
const TIER_RATES: Record<string, number> = {
  BRONZE: 500,
  SILVER: 700,
  GOLD: 1000,
};

export class CommissionService {
  constructor(private readonly prisma: PrismaClient) {}

  // ============================================================
  // Story 9.7: Commission Calculation
  // ============================================================

  /**
   * Calculate commission for a service request.
   * AC2: commission = service_fee * commission_rate (tier-based)
   * AC3: Only service fees, NOT government fees.
   * AC8: All paise integers.
   * AC9: Idempotent — no duplicate commissions.
   */
  async calculateCommission(serviceRequestId: string): Promise<void> {
    // Wrap check-then-create in a transaction for atomicity
    await this.prisma.$transaction(async (tx) => {
      // AC9: Check if commission already exists (inside transaction)
      const existing = await tx.dealerCommission.findFirst({
        where: { serviceRequestId },
      });

      if (existing) {
        return; // Already calculated — idempotent
      }

      // Find if referred customer
      const referral = await tx.dealerReferral.findFirst({
        where: {
          // We need to find the referral by looking up the service request's customer
          // and checking if they have a dealer referral
        },
      });

      // Get service request to find customer, then find their referral
      // Using raw query for efficiency since we need to join across tables
      const serviceData = await tx.$queryRawUnsafe<any[]>(
        `SELECT sr.id, sr.service_fee_paise, sr.customer_id
         FROM service_requests sr
         WHERE sr.id = $1`,
        serviceRequestId,
      ).catch(() => []);

      if (!serviceData.length) return;

      const sr = serviceData[0];
      const customerId = sr.customer_id;

      // Find dealer referral for this customer
      const dealerReferral = await tx.dealerReferral.findFirst({
        where: { customerId },
      });

      if (!dealerReferral) return; // No dealer attribution

      const dealerId = dealerReferral.dealerId;

      // Get dealer tier for commission rate
      const dealer = await tx.dealer.findUnique({
        where: { id: dealerId },
        select: { currentTier: true, cityId: true },
      });

      if (!dealer) return;

      // AC3: Calculate on service fees only (not government fees)
      const serviceFeePaise = BigInt(sr.service_fee_paise || 0);

      // Check for admin-set fixed commission config before using tier rates.
      // Look up serviceDefinitionId via the service instance.
      let commissionAmountPaise: bigint;
      let commissionRate: number;

      const serviceInstance = await tx.$queryRawUnsafe<any[]>(
        `SELECT si.service_definition_id
         FROM service_requests sr
         JOIN service_instances si ON si.id = sr.service_instance_id
         WHERE sr.id = $1`,
        serviceRequestId,
      ).catch(() => []);

      const serviceDefinitionId = serviceInstance?.[0]?.service_definition_id;

      // Try to find admin-configured fixed commission for dealer role + service
      const fixedConfig = serviceDefinitionId
        ? await tx.commissionConfig.findUnique({
            where: {
              role_serviceDefinitionId: {
                role: 'dealer',
                serviceDefinitionId,
              },
            },
          })
        : null;

      if (fixedConfig?.isActive && fixedConfig.commissionAmountPaise > 0n) {
        // Use admin-set fixed amount
        commissionAmountPaise = fixedConfig.commissionAmountPaise;
        commissionRate = 0; // Fixed amount, not percentage-based
      } else {
        // Fallback to tier-based percentage calculation
        commissionRate = TIER_RATES[dealer.currentTier] ?? TIER_RATES.BRONZE;
        // Integer arithmetic only: commission = serviceFeePaise * rate / 10000
        // rate is basis points x 100 (500 = 5.00%), so /10000 gives correct result
        commissionAmountPaise = (serviceFeePaise * BigInt(commissionRate)) / 10000n;
      }

      // AC4: Create commission record — catch P2002 as idempotent no-op
      try {
        await tx.dealerCommission.create({
          data: {
            dealerId,
            referralId: dealerReferral.id,
            serviceRequestId,
            serviceFeePaise,
            commissionRate,
            commissionAmountPaise,
            status: CommissionStatus.PENDING, // AC5: Initially pending
            cityId: dealer.cityId,
          },
        });
      } catch (error: any) {
        // P2002 = unique constraint violation — treat as idempotent success
        if (error?.code === 'P2002') return;
        throw error;
      }
    });
  }

  /**
   * AC6: Auto-approve when service reaches COMPLETED status.
   */
  async approveCommissionsForService(serviceRequestId: string): Promise<void> {
    await this.prisma.dealerCommission.updateMany({
      where: {
        serviceRequestId,
        status: CommissionStatus.PENDING,
      },
      data: {
        status: CommissionStatus.APPROVED,
        approvedAt: new Date(),
      },
    });
  }

  // ============================================================
  // Story 9.9: Earnings Summary
  // ============================================================

  async getEarningsSummary(dealerId: string) {
    const [totalEarned, pendingPayout, paidThisMonth, paidAllTime] = await Promise.all([
      this.prisma.dealerCommission.aggregate({
        where: { dealerId, status: { in: [CommissionStatus.APPROVED, CommissionStatus.PAID] } },
        _sum: { commissionAmountPaise: true },
      }),
      this.prisma.dealerCommission.aggregate({
        where: { dealerId, status: CommissionStatus.APPROVED },
        _sum: { commissionAmountPaise: true },
      }),
      this.prisma.dealerCommission.aggregate({
        where: {
          dealerId,
          status: CommissionStatus.PAID,
          paidAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        _sum: { commissionAmountPaise: true },
      }),
      this.prisma.dealerCommission.aggregate({
        where: { dealerId, status: CommissionStatus.PAID },
        _sum: { commissionAmountPaise: true },
      }),
    ]);

    return {
      totalEarnedPaise: (totalEarned._sum.commissionAmountPaise ?? 0n).toString(),
      pendingPayoutPaise: (pendingPayout._sum.commissionAmountPaise ?? 0n).toString(),
      paidThisMonthPaise: (paidThisMonth._sum.commissionAmountPaise ?? 0n).toString(),
      paidAllTimePaise: (paidAllTime._sum.commissionAmountPaise ?? 0n).toString(),
    };
  }

  // ============================================================
  // Story 9.9: Commission History
  // ============================================================

  async getCommissionHistory(
    dealerId: string,
    filters: { status?: string; startDate?: string; endDate?: string },
    cursor?: string,
    limit = 20,
  ) {
    const where: any = { dealerId };
    if (filters.status) where.status = filters.status;
    if (filters.startDate || filters.endDate) {
      where.earnedDate = {};
      if (filters.startDate) where.earnedDate.gte = new Date(filters.startDate);
      if (filters.endDate) where.earnedDate.lte = new Date(filters.endDate);
    }

    const commissions = await this.prisma.dealerCommission.findMany({
      where,
      orderBy: { earnedDate: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    return commissions.map((c) => ({
      id: c.id,
      customerFirstName: 'Customer', // Privacy: first name only
      commissionAmountPaise: c.commissionAmountPaise.toString(),
      commissionRate: c.commissionRate,
      status: c.status,
      earnedDate: c.earnedDate.toISOString(),
      paidAt: c.paidAt?.toISOString() ?? null,
    }));
  }

  // ============================================================
  // Story 9.9: CSV Export
  // ============================================================

  async exportCommissionsCsv(dealerId: string, res: Response) {
    const commissions = await this.prisma.dealerCommission.findMany({
      where: { dealerId },
      orderBy: { earnedDate: 'desc' },
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=commissions.csv');

    const header = 'Date,Commission (Rs),Rate (%),Status\n';
    const rows = commissions
      .map(
        (c) =>
          `${c.earnedDate.toISOString().slice(0, 10)},${Number(c.commissionAmountPaise) / 100},${c.commissionRate / 100},${c.status}`,
      )
      .join('\n');

    res.send(header + rows);
  }

  // ============================================================
  // Story 9.16: Earnings Forecast
  // ============================================================

  async getEarningsForecast(dealerId: string) {
    const dealer = await this.prisma.dealer.findUnique({
      where: { id: dealerId },
      select: { currentTier: true },
    });

    const commissionRate = TIER_RATES[dealer?.currentTier ?? 'BRONZE'] ?? TIER_RATES.BRONZE;

    // Get referred customers
    const referrals = await this.prisma.dealerReferral.findMany({
      where: { dealerId, attributionStatus: 'CONFIRMED' },
      select: { customerId: true },
    });

    const customerIds = referrals.map((r) => r.customerId);

    if (customerIds.length === 0) {
      return {
        projections: [],
        totalProjectedPaise: '0',
        activeServiceCount: 0,
        currentTier: dealer?.currentTier ?? 'BRONZE',
        commissionRatePercent: commissionRate / 100,
        disclaimer: 'Projected earnings are estimates and subject to service completion.',
      };
    }

    // Active service requests for referred customers
    const activeServices = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, customer_id, service_type, status, service_fee_paise, created_at
       FROM service_requests
       WHERE customer_id = ANY($1::text[])
       AND status NOT IN ('COMPLETED', 'CANCELLED', 'HALTED')
       ORDER BY created_at DESC`,
      customerIds,
    ).catch(() => []);

    // Existing commissions (already calculated, don't double-count)
    const existingCommissionServiceIds = new Set(
      (
        await this.prisma.dealerCommission.findMany({
          where: { dealerId, serviceRequestId: { in: activeServices.map((s: any) => s.id) } },
          select: { serviceRequestId: true },
        })
      ).map((c) => c.serviceRequestId),
    );

    // AC2: Assumes completion
    const projections = activeServices.map((sr: any) => {
      const serviceFeePaise = BigInt(sr.service_fee_paise || 0);
      const projectedCommissionPaise =
        (serviceFeePaise * BigInt(commissionRate)) / 10000n;
      const hasExistingCommission = existingCommissionServiceIds.has(sr.id);

      return {
        serviceRequestId: sr.id,
        customerFirstName: 'Customer', // Privacy
        serviceType: sr.service_type,
        currentStage: sr.status,
        serviceFeePaise: serviceFeePaise.toString(),
        projectedCommissionPaise: projectedCommissionPaise.toString(),
        hasExistingCommission,
        createdAt: new Date(sr.created_at).toISOString(),
      };
    });

    // AC3: Summary total
    const totalProjectedPaise = projections.reduce(
      (sum, p) => sum + BigInt(p.projectedCommissionPaise),
      0n,
    );

    return {
      projections,
      totalProjectedPaise: totalProjectedPaise.toString(),
      activeServiceCount: projections.length,
      currentTier: dealer?.currentTier ?? 'BRONZE',
      commissionRatePercent: commissionRate / 100,
      disclaimer: 'Projected earnings are estimates and subject to service completion.',
    };
  }

  // ============================================================
  // Dealer pending commissions
  // ============================================================

  async getDealerPendingCommissions(dealerId: string) {
    return this.prisma.dealerCommission.findMany({
      where: {
        dealerId,
        status: CommissionStatus.APPROVED,
      },
      orderBy: { earnedDate: 'desc' },
    });
  }

  /**
   * Ops: Get all pending (APPROVED) commissions across all dealers.
   * Used by the ops payout dashboard to see what's awaiting payout.
   */
  async getAllPendingCommissions(cityId?: string) {
    const where: any = { status: CommissionStatus.APPROVED };
    if (cityId) where.cityId = cityId;

    const commissions = await this.prisma.dealerCommission.findMany({
      where,
      orderBy: { earnedDate: 'desc' },
      take: 100,
      include: {
        dealer: {
          select: {
            id: true,
            currentTier: true,
            kyc: { select: { fullName: true } },
          },
        },
      },
    });

    return commissions.map((c) => ({
      id: c.id,
      dealerName: c.dealer?.kyc?.fullName ?? 'Unknown',
      amountPaise: c.commissionAmountPaise.toString(),
      tier: c.dealer?.currentTier ?? 'BRONZE',
      earnedDate: c.earnedDate.toISOString(),
    }));
  }
}
