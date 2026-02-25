import { PrismaClient } from '@prisma/client';
import { dealerTierConfigSchema, DealerTierConfig } from './franchise.types';
import { BusinessError } from '../../shared/errors/business-error';
import * as ErrorCodes from '../../shared/errors/error-codes';

/**
 * Story 14-7: Franchise Owner - Local Dealer Management
 *
 * City-scoped dealer management: KYC review, commission tiers,
 * performance tracking, promotions/demotions, announcements.
 *
 * NOTE: The Dealer model uses `dealerStatus` (enum DealerStatus) and
 * `currentTier` (enum DealerTier) instead of `kycStatus`/`commissionTier`/`isActive`.
 */
export class DealerManagementService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a dealer (after KYC approval)
   */
  async createDealer(params: {
    userId: string;
    cityId: string;
    businessName?: string;
  }) {
    try {
      return await this.prisma.dealer.create({
        data: {
          userId: params.userId,
          cityId: params.cityId,
          businessName: params.businessName || null,
          dealerStatus: 'PENDING_KYC',
          currentTier: 'BRONZE',
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BusinessError(
          ErrorCodes.BUSINESS_DEALER_NOT_FOUND,
          'A dealer with this user ID already exists',
          409
        );
      }
      throw error;
    }
  }

  /**
   * Approve/reject dealer KYC - updates dealer status
   */
  async updateKycStatus(dealerId: string, status: 'approved' | 'rejected', _notes?: string) {
    return this.prisma.dealer.update({
      where: { id: dealerId },
      data: {
        dealerStatus: status === 'approved' ? 'ACTIVE' : 'REJECTED',
      },
    });
  }

  /**
   * Set city-specific commission tier configuration
   */
  async setTierConfig(dealerId: string, tierConfig: DealerTierConfig) {
    dealerTierConfigSchema.parse(tierConfig);
    return this.prisma.dealer.update({
      where: { id: dealerId },
      data: { tierConfig: tierConfig as any },
    });
  }

  /**
   * Promote or demote dealer tier
   */
  async updateTier(dealerId: string, newTier: 'BRONZE' | 'SILVER' | 'GOLD') {
    return this.prisma.dealer.update({
      where: { id: dealerId },
      data: { currentTier: newTier },
    });
  }

  /**
   * Deactivate dealer for policy violations
   */
  async deactivateDealer(dealerId: string, reason: string) {
    return this.prisma.dealer.update({
      where: { id: dealerId },
      data: {
        dealerStatus: 'SUSPENDED',
        deactivationReason: reason,
      },
    });
  }

  /**
   * Activate dealer
   */
  async activateDealer(dealerId: string) {
    return this.prisma.dealer.update({
      where: { id: dealerId },
      data: {
        dealerStatus: 'ACTIVE',
      },
    });
  }

  /**
   * List dealers for a city.
   * Joins with User table to include name, phone, email for the Flutter model.
   */
  async listDealers(cityId: string, filters?: {
    isActive?: boolean;
    tier?: string;
    kycStatus?: string;
  }) {
    const dealers = await this.prisma.dealer.findMany({
      where: {
        cityId,
        ...(filters?.isActive !== undefined && {
          dealerStatus: filters.isActive ? 'ACTIVE' : 'SUSPENDED',
        }),
        ...(filters?.tier && { currentTier: filters.tier as any }),
      },
      orderBy: { createdAt: 'asc' },
    });

    // Batch-fetch user info for all dealers
    const userIds = dealers.map((d) => d.userId);
    const users = userIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, displayName: true, phone: true, email: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    return dealers.map((d) => {
      const user = userMap.get(d.userId);
      return {
        id: d.id,
        userId: d.userId,
        cityId: d.cityId,
        name: user?.displayName ?? d.businessName ?? 'Unknown',
        phone: user?.phone ?? '',
        email: user?.email ?? null,
        kycStatus: this.mapDealerKycStatus(d.dealerStatus),
        commissionTier: d.currentTier,
        isActive: d.dealerStatus === 'ACTIVE',
        deactivationReason: d.deactivationReason,
      };
    });
  }

  /**
   * Get dealer details.
   * Returns transformed data with user info for Flutter compatibility.
   */
  async getDealer(dealerId: string) {
    const dealer = await this.prisma.dealer.findUnique({
      where: { id: dealerId },
    });

    if (!dealer) {
      throw new BusinessError(ErrorCodes.BUSINESS_DEALER_NOT_FOUND, 'Dealer not found', 404);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: dealer.userId },
      select: { displayName: true, phone: true, email: true },
    });

    return {
      ...dealer,
      name: user?.displayName ?? dealer.businessName ?? 'Unknown',
      phone: user?.phone ?? '',
      email: user?.email ?? null,
      kycStatus: this.mapDealerKycStatus(dealer.dealerStatus),
      commissionTier: dealer.currentTier,
      isActive: dealer.dealerStatus === 'ACTIVE',
    };
  }

  /**
   * Map Prisma DealerStatus enum to Flutter-compatible kycStatus string.
   */
  private mapDealerKycStatus(status: string): string {
    switch (status) {
      case 'PENDING_KYC':
      case 'PENDING_APPROVAL':
        return 'pending';
      case 'ACTIVE':
        return 'approved';
      case 'REJECTED':
        return 'rejected';
      case 'SUSPENDED':
        return 'suspended';
      default:
        return status.toLowerCase();
    }
  }

  /**
   * Get dealer count by city
   */
  async getDealerCount(cityId: string): Promise<number> {
    return this.prisma.dealer.count({
      where: { cityId, dealerStatus: 'ACTIVE' },
    });
  }
}
