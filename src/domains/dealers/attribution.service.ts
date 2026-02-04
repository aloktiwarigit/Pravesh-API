/**
 * Epic 9 Story 9.5: Customer Attribution Service
 * Handles attributing customers to referring dealers.
 * Attribution is IMMUTABLE once set (prevents gaming).
 */

import { PrismaClient, DealerStatus, AttributionStatus, ReferralSource } from '@prisma/client';

export class AttributionService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Attribute a customer to a dealer via referral code.
   * AC5: If referral code is invalid or dealer inactive, silently skip.
   * AC6: Attribution is immutable — once set, never changed.
   * AC7: Customer is NOT notified (silent attribution).
   */
  async attributeCustomer(
    customerId: string,
    dealerCode: string,
    cityId: string,
    source: ReferralSource = ReferralSource.LINK,
  ): Promise<boolean> {
    // Resolve dealer from code
    const dealer = await this.prisma.dealer.findFirst({
      where: { dealerCode },
    });

    // AC5: Invalid or inactive dealer — skip silently
    if (!dealer || dealer.dealerStatus !== DealerStatus.ACTIVE) {
      return false;
    }

    // Wrap check-then-create in a transaction to prevent duplicate attributions
    return this.prisma.$transaction(async (tx) => {
      // AC6: Check if already attributed (immutable) — inside transaction
      const existingReferral = await tx.dealerReferral.findFirst({
        where: { customerId },
      });

      if (existingReferral) {
        return false; // Already attributed, immutable
      }

      // Create attribution — catch P2002 as idempotent no-op
      try {
        await tx.dealerReferral.create({
          data: {
            dealerId: dealer.id,
            customerId,
            referralSource: source,
            attributionStatus: AttributionStatus.PENDING,
            cityId,
          },
        });
      } catch (error: any) {
        // P2002 = unique constraint violation — treat as already attributed
        if (error?.code === 'P2002') return false;
        throw error;
      }

      return true;
    });
  }

  /**
   * AC3: Confirm attribution when customer places their first service request.
   */
  async confirmAttribution(customerId: string): Promise<void> {
    const referral = await this.prisma.dealerReferral.findFirst({
      where: {
        customerId,
        attributionStatus: AttributionStatus.PENDING,
      },
    });

    if (referral) {
      await this.prisma.dealerReferral.update({
        where: { id: referral.id },
        data: {
          attributionStatus: AttributionStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      });
    }
  }

  /**
   * Get referrals for a dealer (for audit by ops/franchise).
   */
  async getDealerReferrals(dealerId: string, cursor?: string, limit = 20) {
    return this.prisma.dealerReferral.findMany({
      where: { dealerId },
      orderBy: { referralDate: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }

  /**
   * Resolve dealer code for a redirect endpoint.
   */
  async resolveDealerCode(dealerCode: string) {
    return this.prisma.dealer.findFirst({
      where: { dealerCode, dealerStatus: DealerStatus.ACTIVE },
      select: { id: true, dealerCode: true },
    });
  }
}
