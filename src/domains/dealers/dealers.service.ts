/**
 * Epic 9 Stories 9.1, 9.2, 9.3, 9.6, 9.8, 9.10, 9.12: Dealer Service
 * Handles dealer registration, KYC, referrals, pipeline, tiers, leaderboard, white-label.
 */

import { PrismaClient, KycStatus, DealerStatus, DealerTier, AttributionStatus } from '@prisma/client';
import { DealerKycSubmitInput } from './dealers.validation';
import { BusinessError } from '../../shared/errors/business-error';
import { encrypt } from '../../shared/utils/encryption';
import { nanoid } from 'nanoid';

// Tier commission rates in basis points x 100 (500 = 5.00%)
const TIER_RATES: Record<string, number> = {
  BRONZE: 500,
  SILVER: 700,
  GOLD: 1000,
};

// Tier thresholds: confirmed referrals/month
const TIER_THRESHOLDS = {
  SILVER: 5,
  GOLD: 15,
};

export class DealerService {
  constructor(private readonly prisma: PrismaClient) {}

  // ============================================================
  // Story 9.1: KYC Submission
  // ============================================================

  async submitKyc(
    userId: string,
    cityId: string,
    input: DealerKycSubmitInput,
  ) {
    // Check for existing approved dealer
    const existing = await this.prisma.dealer.findUnique({
      where: { userId },
      include: { kyc: true },
    });

    if (existing?.kyc?.status === KycStatus.APPROVED) {
      throw new BusinessError('DEALER_ALREADY_APPROVED', 'Dealer KYC already approved');
    }

    // Aadhaar masking: only store last 4 digits (NFR10)
    const aadhaarMasked = `XXXX-XXXX-${input.aadhaarLastFour}`;
    const encryptedPan = encrypt(input.panNumber);
    const encryptedAccount = encrypt(input.accountNumber);

    return this.prisma.$transaction(async (tx) => {
      const dealer = await tx.dealer.upsert({
        where: { userId },
        update: {
          businessName: input.businessName,
          dealerStatus: DealerStatus.PENDING_APPROVAL,
        },
        create: {
          userId,
          cityId,
          businessName: input.businessName,
          dealerStatus: DealerStatus.PENDING_APPROVAL,
        },
      });

      await tx.dealerKyc.upsert({
        where: { dealerId: dealer.id },
        update: {
          fullName: input.fullName,
          panNumber: encryptedPan,
          panPhotoUrl: input.panPhotoUrl,
          aadhaarMasked,
          aadhaarPhotoUrl: input.aadhaarPhotoUrl,
          businessAddress: input.businessAddress,
          ifscCode: input.ifscCode,
          accountNumber: encryptedAccount,
          accountHolderName: input.accountHolderName,
          status: KycStatus.PENDING,
          rejectionReason: null,
          rejectionNotes: null,
        },
        create: {
          dealerId: dealer.id,
          fullName: input.fullName,
          panNumber: encryptedPan,
          panPhotoUrl: input.panPhotoUrl,
          aadhaarMasked,
          aadhaarPhotoUrl: input.aadhaarPhotoUrl,
          businessAddress: input.businessAddress,
          ifscCode: input.ifscCode,
          accountNumber: encryptedAccount,
          accountHolderName: input.accountHolderName,
        },
      });

      return dealer;
    });
  }

  async getDealerByUserId(userId: string) {
    return this.prisma.dealer.findUnique({
      where: { userId },
      include: {
        kyc: {
          select: {
            status: true,
            fullName: true,
            rejectionReason: true,
            rejectionNotes: true,
          },
        },
      },
    });
  }

  // ============================================================
  // Story 9.2: KYC Approval Workflow
  // ============================================================

  async getPendingKycSubmissions(cityId: string, cursor?: string, limit = 20) {
    return this.prisma.dealerKyc.findMany({
      where: {
        status: KycStatus.PENDING,
        dealer: { cityId },
      },
      include: {
        dealer: {
          select: { id: true, businessName: true, cityId: true },
        },
      },
      orderBy: { submittedAt: 'asc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }

  async getKycDetail(kycId: string, cityId: string) {
    const kyc = await this.prisma.dealerKyc.findUnique({
      where: { id: kycId },
      include: { dealer: true },
    });

    if (!kyc || kyc.dealer.cityId !== cityId) {
      throw new BusinessError('KYC_NOT_FOUND', 'KYC submission not found');
    }

    return kyc;
  }

  async approveKyc(kycId: string, reviewerId: string, cityId: string) {
    const kyc = await this.getKycDetail(kycId, cityId);

    return this.prisma.$transaction(async (tx) => {
      await tx.dealerKyc.update({
        where: { id: kycId },
        data: {
          status: KycStatus.APPROVED,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
        },
      });

      // Generate dealer code (Story 9.3)
      const dealerCode = await this.generateDealerCode(tx);

      await tx.dealer.update({
        where: { id: kyc.dealerId },
        data: {
          dealerStatus: DealerStatus.ACTIVE,
          dealerCode,
        },
      });

      return { dealerId: kyc.dealerId, dealerCode };
    });
  }

  async rejectKyc(
    kycId: string,
    reviewerId: string,
    cityId: string,
    reason: string,
    notes?: string,
  ) {
    const kyc = await this.getKycDetail(kycId, cityId);

    return this.prisma.$transaction(async (tx) => {
      await tx.dealerKyc.update({
        where: { id: kycId },
        data: {
          status: KycStatus.REJECTED,
          rejectionReason: reason,
          rejectionNotes: notes,
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
        },
      });

      await tx.dealer.update({
        where: { id: kyc.dealerId },
        data: { dealerStatus: DealerStatus.REJECTED },
      });

      return kyc;
    });
  }

  async getActiveDealers(cityId: string, cursor?: string, limit = 20) {
    return this.prisma.dealer.findMany({
      where: { cityId, dealerStatus: DealerStatus.ACTIVE },
      include: { kyc: { select: { fullName: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }

  // ============================================================
  // Story 9.3: Dealer Code Generation (with collision retry)
  // ============================================================

  private async generateDealerCode(tx: any): Promise<string> {
    const MAX_RETRIES = 3;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const code = nanoid(8);
      const existing = await tx.dealer.findFirst({
        where: { dealerCode: code },
      });

      if (!existing) {
        return code;
      }
    }

    throw new BusinessError(
      'CODE_GENERATION_FAILED',
      'Failed to generate unique dealer code after retries',
    );
  }

  // ============================================================
  // Story 9.3: Referral Data
  // ============================================================

  async getDealerReferralData(userId: string) {
    const dealer = await this.prisma.dealer.findUnique({
      where: { userId },
    });

    if (!dealer || dealer.dealerStatus !== DealerStatus.ACTIVE) {
      throw new BusinessError('DEALER_NOT_ACTIVE', 'Dealer is not active');
    }

    const referralLink = `https://app.propertylegal.in/ref/${dealer.dealerCode}`;

    return {
      dealerCode: dealer.dealerCode!,
      referralLink,
      qrCodeUrl: dealer.qrCodeUrl,
    };
  }

  // ============================================================
  // Story 9.6: Dealer Pipeline
  // ============================================================

  async getDealerPipeline(
    dealerId: string,
    filters: { status?: string; startDate?: string; endDate?: string },
    cursor?: string,
    limit = 20,
  ) {
    const dealer = await this.prisma.dealer.findUnique({
      where: { id: dealerId },
      select: { currentTier: true },
    });

    const commissionRate = TIER_RATES[dealer?.currentTier ?? 'BRONZE'] ?? TIER_RATES.BRONZE;

    const referrals = await this.prisma.dealerReferral.findMany({
      where: { dealerId },
      orderBy: { referralDate: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    // Service requests for referred customers — privacy-restricted fields only
    const customerIds = referrals.map((r) => r.customerId);

    const whereClause: any = {
      customerId: { in: customerIds },
    };
    if (filters.status === 'active') {
      whereClause.status = { not: 'COMPLETED' };
    } else if (filters.status === 'completed') {
      whereClause.status = 'COMPLETED';
    }

    const serviceRequests = await this.prisma.$queryRawUnsafe<any[]>(
      `SELECT id, customer_id, service_type, status, created_at, service_fee_paise
       FROM service_requests
       WHERE customer_id = ANY($1::text[])
       ORDER BY status ASC, created_at DESC`,
      customerIds,
    ).catch(() => []);

    // Build pipeline response
    const pipeline = referrals.map((referral) => {
      const customerServices = serviceRequests.filter(
        (sr: any) => sr.customer_id === referral.customerId,
      );

      return {
        referralId: referral.id,
        customerFirstName: 'Customer', // Privacy: first name only
        referralDate: referral.referralDate.toISOString(),
        attributionStatus: referral.attributionStatus,
        services: customerServices.map((sr: any) => ({
          serviceRequestId: sr.id,
          serviceType: sr.service_type,
          status: sr.status,
          daysSinceRequest: Math.floor(
            (Date.now() - new Date(sr.created_at).getTime()) / 86400000,
          ),
          projectedCommissionPaise: (
            (BigInt(sr.service_fee_paise || 0) * BigInt(commissionRate)) /
            10000n
          ).toString(),
        })),
        hasActiveServices: customerServices.some(
          (sr: any) => sr.status !== 'COMPLETED',
        ),
      };
    });

    const withServices = pipeline.filter((p) => p.services.length > 0);
    const noServices = pipeline.filter((p) => p.services.length === 0);

    return { withServices, noServices };
  }

  // ============================================================
  // Story 9.8: Monthly Tier Calculation
  // ============================================================

  async calculateMonthlyTiers(): Promise<{
    promoted: number;
    demoted: number;
    unchanged: number;
  }> {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const activeDealers = await this.prisma.dealer.findMany({
      where: { dealerStatus: DealerStatus.ACTIVE },
    });

    let promoted = 0;
    let demoted = 0;
    let unchanged = 0;

    for (const dealer of activeDealers) {
      const referralCount = await this.prisma.dealerReferral.count({
        where: {
          dealerId: dealer.id,
          attributionStatus: AttributionStatus.CONFIRMED,
          confirmedAt: { gte: lastMonth, lte: lastMonthEnd },
        },
      });

      let newTier: DealerTier;
      if (referralCount >= TIER_THRESHOLDS.GOLD) {
        newTier = DealerTier.GOLD;
      } else if (referralCount >= TIER_THRESHOLDS.SILVER) {
        newTier = DealerTier.SILVER;
      } else {
        newTier = DealerTier.BRONZE;
      }

      if (newTier !== dealer.currentTier) {
        const isPromotion = this.tierRank(newTier) > this.tierRank(dealer.currentTier);

        await this.prisma.dealer.update({
          where: { id: dealer.id },
          data: {
            previousTier: dealer.currentTier,
            currentTier: newTier,
            tierStartDate: new Date(),
          },
        });

        // Story 9.12 AC10: Auto-disable white-label on demotion from Gold
        if (
          dealer.currentTier === DealerTier.GOLD &&
          newTier !== DealerTier.GOLD &&
          dealer.whitelabelEnabled
        ) {
          await this.prisma.dealer.update({
            where: { id: dealer.id },
            data: { whitelabelEnabled: false },
          });
        }

        // Log tier history (Story 9.8 AC8)
        await this.prisma.dealerTierHistory.create({
          data: {
            dealerId: dealer.id,
            previousTier: dealer.currentTier,
            newTier,
            referralCount,
            periodMonth: lastMonth.getMonth() + 1,
            periodYear: lastMonth.getFullYear(),
          },
        });

        if (isPromotion) promoted++;
        else demoted++;
      } else {
        unchanged++;
      }
    }

    return { promoted, demoted, unchanged };
  }

  private tierRank(tier: DealerTier): number {
    switch (tier) {
      case DealerTier.BRONZE:
        return 1;
      case DealerTier.SILVER:
        return 2;
      case DealerTier.GOLD:
        return 3;
      default:
        return 0;
    }
  }

  // ============================================================
  // Story 9.8: Tier Progress
  // ============================================================

  async getTierProgress(dealerId: string) {
    const dealer = await this.prisma.dealer.findUnique({
      where: { id: dealerId },
    });

    const currentMonthStart = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );

    const currentMonthReferrals = await this.prisma.dealerReferral.count({
      where: {
        dealerId,
        attributionStatus: AttributionStatus.CONFIRMED,
        confirmedAt: { gte: currentMonthStart },
      },
    });

    const nextTierThreshold =
      dealer?.currentTier === DealerTier.BRONZE
        ? TIER_THRESHOLDS.SILVER
        : dealer?.currentTier === DealerTier.SILVER
          ? TIER_THRESHOLDS.GOLD
          : null;

    const referralsToNextTier = nextTierThreshold
      ? Math.max(0, nextTierThreshold - currentMonthReferrals)
      : 0;

    return {
      currentTier: dealer?.currentTier,
      currentMonthReferrals,
      nextTierThreshold,
      referralsToNextTier,
    };
  }

  // ============================================================
  // Story 9.10: Leaderboard
  // ============================================================

  async getLeaderboard(
    cityId: string,
    dealerId: string,
    period: 'monthly' | 'all-time',
  ) {
    const now = new Date();
    const periodKey =
      period === 'monthly'
        ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
        : 'all-time';

    const todayStr = now.toISOString().slice(0, 10);

    // Top 20 (AC4)
    const top20 = await this.prisma.dealerLeaderboardSnapshot.findMany({
      where: {
        cityId,
        period: periodKey,
        snapshotDate: { gte: new Date(todayStr) },
      },
      include: {
        dealer: {
          select: {
            id: true,
            businessName: true,
            currentTier: true,
            displayNameOptIn: true,
          },
        },
      },
      orderBy: { rank: 'asc' },
      take: 20,
    });

    // Current dealer's rank (AC3)
    const myRank = await this.prisma.dealerLeaderboardSnapshot.findFirst({
      where: { dealerId, period: periodKey },
      orderBy: { snapshotDate: 'desc' },
    });

    return {
      leaderboard: top20.map((entry) => ({
        rank: entry.rank,
        // AC7: Anonymize unless opted in
        displayName: entry.dealer.displayNameOptIn
          ? entry.dealer.businessName ?? `Dealer #${entry.dealer.id.slice(-6)}`
          : `Dealer #${entry.dealer.id.slice(-6)}`,
        referralCount: entry.referralCount,
        totalCommissionPaise: entry.totalCommissionPaise.toString(),
        tier: entry.dealer.currentTier,
        isMe: entry.dealerId === dealerId,
      })),
      myRank: myRank
        ? {
            rank: myRank.rank,
            referralCount: myRank.referralCount,
            totalCommissionPaise: myRank.totalCommissionPaise.toString(),
          }
        : null,
    };
  }

  // ============================================================
  // Story 9.12: White-Label
  // ============================================================

  async updateWhiteLabel(
    dealerId: string,
    input: { enabled: boolean; businessName?: string; logoUrl?: string; brandColor?: string },
  ) {
    const dealer = await this.prisma.dealer.findUnique({
      where: { id: dealerId },
    });

    if (!dealer || dealer.currentTier !== DealerTier.GOLD) {
      throw new BusinessError('TIER_INSUFFICIENT', 'White-label requires Gold tier');
    }

    return this.prisma.dealer.update({
      where: { id: dealerId },
      data: {
        whitelabelEnabled: input.enabled,
        businessName: input.businessName ?? dealer.businessName,
        logoUrl: input.logoUrl ?? dealer.logoUrl,
        brandColor: input.brandColor ?? dealer.brandColor,
      },
    });
  }

  async getSenderBranding(
    customerId: string,
    notificationType: string,
  ): Promise<{ senderName: string; logoUrl: string | null }> {
    // AC9: Ops/franchise communications are never white-labeled
    const opsTypes = ['escalation', 'audit', 'sla_breach', 'kyc_review'];
    if (opsTypes.includes(notificationType)) {
      return { senderName: 'Property Legal Agent', logoUrl: null };
    }

    // Look up referring dealer
    const referral = await this.prisma.dealerReferral.findFirst({
      where: { customerId },
      include: {
        dealer: {
          select: { whitelabelEnabled: true, businessName: true, logoUrl: true },
        },
      },
    });

    if (referral?.dealer?.whitelabelEnabled) {
      return {
        senderName: referral.dealer.businessName ?? 'Property Legal Agent',
        logoUrl: referral.dealer.logoUrl,
      };
    }

    return { senderName: 'Property Legal Agent', logoUrl: null };
  }

  // ============================================================
  // Display name opt-in toggle
  // ============================================================

  async toggleDisplayNameOptIn(dealerId: string, optIn: boolean) {
    return this.prisma.dealer.update({
      where: { id: dealerId },
      data: { displayNameOptIn: optIn },
    });
  }

  // ============================================================
  // Tier rate helper (exported for other services)
  // ============================================================

  getTierRate(tier: string): number {
    return TIER_RATES[tier] ?? TIER_RATES.BRONZE;
  }
}
