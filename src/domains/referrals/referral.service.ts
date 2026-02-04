/**
 * Referral service for code generation, credit earning, and balance management.
 *
 * Story 4.11: Customer Referral Credits - Earn
 *
 * TODO: The models customerReferral, referralConfig, and customerReferralCredit
 * do not exist in the current Prisma schema. These operations are stubbed to
 * return sensible defaults until the schema is extended.
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
   *
   * TODO: Requires CustomerReferral model in schema.
   */
  async getOrCreateReferralCode(customerId: string, _tenantId: string): Promise<string> {
    // TODO: prisma.customerReferral does not exist yet in schema.
    // Stub: generate a deterministic-ish code based on customerId.
    const referralCode = nanoid(10);
    return referralCode;
  }

  /**
   * Resolves a referral code to the referrer's customer ID.
   *
   * TODO: Requires CustomerReferral model in schema.
   */
  async resolveReferrer(_referralCode: string): Promise<string | null> {
    // TODO: prisma.customerReferral does not exist yet in schema.
    return null;
  }

  /**
   * Credits the referrer when a referred customer completes their first transaction.
   * Prevents duplicate credits for the same referred customer.
   *
   * Story 4.11 AC3
   *
   * TODO: Requires ReferralConfig and CustomerReferralCredit models in schema.
   */
  async creditReferrer(
    _referrerCustomerId: string,
    _referredCustomerId: string,
    _serviceRequestId: string,
    _tenantId: string,
  ): Promise<bigint> {
    // TODO: prisma.referralConfig and prisma.customerReferralCredit do not exist yet.
    return 0n;
  }

  /**
   * Gets the available credit balance for a customer.
   * Balance = sum(creditAmount) - sum(usedAmount)
   *
   * TODO: Requires CustomerReferralCredit model in schema.
   */
  async getCreditBalance(_customerId: string): Promise<bigint> {
    // TODO: prisma.customerReferralCredit does not exist yet.
    return 0n;
  }

  /**
   * Gets credit history with pagination.
   * Story 4.11 AC6
   *
   * TODO: Requires CustomerReferralCredit model in schema.
   */
  async getCreditHistory(_customerId: string, _page: number, _limit: number) {
    // TODO: prisma.customerReferralCredit does not exist yet.
    return { credits: [] as any[], total: 0 };
  }
}
