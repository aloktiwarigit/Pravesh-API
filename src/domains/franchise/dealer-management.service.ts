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
   * TODO: Dealer model does not have a tierConfig JSON field. Storing as metadata is not supported yet.
   */
  async setTierConfig(dealerId: string, tierConfig: DealerTierConfig) {
    dealerTierConfigSchema.parse(tierConfig);
    // TODO: Dealer model does not have a tierConfig field.
    // For now, just return the current dealer record.
    return this.prisma.dealer.findUnique({
      where: { id: dealerId },
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
  async deactivateDealer(dealerId: string, _reason: string) {
    return this.prisma.dealer.update({
      where: { id: dealerId },
      data: {
        dealerStatus: 'SUSPENDED',
        // TODO: Dealer model does not have a deactivationReason field.
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
   * List dealers for a city
   */
  async listDealers(cityId: string, filters?: {
    isActive?: boolean;
    tier?: string;
    kycStatus?: string;
  }) {
    return this.prisma.dealer.findMany({
      where: {
        cityId,
        ...(filters?.isActive !== undefined && {
          dealerStatus: filters.isActive ? 'ACTIVE' : 'SUSPENDED',
        }),
        ...(filters?.tier && { currentTier: filters.tier as any }),
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Get dealer details
   */
  async getDealer(dealerId: string) {
    const dealer = await this.prisma.dealer.findUnique({
      where: { id: dealerId },
    });

    if (!dealer) {
      throw new BusinessError(ErrorCodes.BUSINESS_DEALER_NOT_FOUND, 'Dealer not found', 404);
    }

    return dealer;
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
