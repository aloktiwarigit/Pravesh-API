/**
 * Referral service for code generation, credit earning, and balance management.
 *
 * Story 4.11: Customer Referral Credits - Earn
 */
import { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';
import { AppError } from '../../core/errors/app-error.js';

export class ReferralService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Gets or creates a referral code for a customer.
   * Code is generated once and reused.
   *
   * Story 4.11 AC1
   */
  async getOrCreateReferralCode(customerId: string, tenantId: string): Promise<string> {
    const existing = await this.prisma.customerReferral.findUnique({
      where: { customerId },
    });

    if (existing) {
      return existing.referralCode;
    }

    const referralCode = nanoid(10);
    const referral = await this.prisma.customerReferral.create({
      data: {
        customerId,
        referralCode,
        cityId: tenantId,
      },
    });

    return referral.referralCode;
  }

  /**
   * Resolves a referral code to the referrer's customer ID.
   */
  async resolveReferrer(referralCode: string): Promise<string | null> {
    const referral = await this.prisma.customerReferral.findUnique({
      where: { referralCode },
    });

    return referral?.customerId ?? null;
  }

  /**
   * Credits the referrer when a referred customer completes their first transaction.
   * Prevents duplicate credits for the same referred customer.
   *
   * Story 4.11 AC3
   */
  async creditReferrer(
    referrerCustomerId: string,
    referredCustomerId: string,
    serviceRequestId: string,
    tenantId: string,
  ): Promise<bigint> {
    // Check for existing credit to prevent duplicates
    const existingCredit = await this.prisma.customerReferralCredit.findUnique({
      where: {
        referrerCustomerId_referredCustomerId: {
          referrerCustomerId,
          referredCustomerId,
        },
      },
    });

    if (existingCredit) {
      return BigInt(existingCredit.creditAmountPaise);
    }

    // Look up referral config for credit amount (use 'default' tier if no specific match)
    const config = await this.prisma.referralConfig.findFirst({
      where: { isActive: true },
      orderBy: { tier: 'asc' },
    });

    if (!config) {
      return 0n;
    }

    // Create credit record
    const credit = await this.prisma.customerReferralCredit.create({
      data: {
        referrerCustomerId,
        referredCustomerId,
        serviceRequestId,
        creditAmountPaise: config.creditAmountPaise,
        cityId: tenantId,
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year expiry
      },
    });

    // Update referral count
    await this.prisma.customerReferral.update({
      where: { customerId: referrerCustomerId },
      data: { referralCount: { increment: 1 } },
    });

    return BigInt(credit.creditAmountPaise);
  }

  /**
   * Gets the available credit balance for a customer.
   * Balance = sum(creditAmount) - sum(usedAmount) for non-expired credits
   *
   * Story 4.11 AC6
   */
  async getCreditBalance(customerId: string): Promise<bigint> {
    const credits = await this.prisma.customerReferralCredit.findMany({
      where: {
        referrerCustomerId: customerId,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      select: {
        creditAmountPaise: true,
        usedAmountPaise: true,
      },
    });

    const balance = credits.reduce(
      (sum, c) => sum + BigInt(c.creditAmountPaise) - BigInt(c.usedAmountPaise),
      0n,
    );

    return balance;
  }

  /**
   * Gets credit history with pagination.
   * Story 4.11 AC6
   */
  async getCreditHistory(customerId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [credits, total] = await Promise.all([
      this.prisma.customerReferralCredit.findMany({
        where: { referrerCustomerId: customerId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.customerReferralCredit.count({
        where: { referrerCustomerId: customerId },
      }),
    ]);

    return { credits, total };
  }
}
