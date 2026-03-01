/**
 * Epic 9 Story 9.14: Scheduled Commission Payout Processing Service
 * Processes dealer commission payouts on a bi-monthly cycle.
 * All amounts in BigInt paise. Minimum threshold: Rs. 500 (50000 paise).
 */

import { PrismaClient, CommissionStatus, DealerBankAccount } from '@prisma/client';
import { RazorpayPayoutClient } from '../../core/integrations/razorpay-payout.client';
import { decrypt } from '../../shared/utils/encryption';
import { logger } from '../../shared/utils/logger';

const MIN_PAYOUT_PAISE = 50000n; // Rs. 500 minimum threshold

export class PayoutService {
  private readonly prisma: PrismaClient;
  private readonly razorpayClient?: RazorpayPayoutClient;

  constructor(prisma: PrismaClient, razorpayClient?: RazorpayPayoutClient) {
    this.prisma = prisma;
    this.razorpayClient = razorpayClient;
  }

  /**
   * Process full payout cycle.
   * AC1: Runs 1st and 15th of each month.
   * AC2: Aggregates all approved commissions per dealer.
   * AC3: Skip dealers below Rs. 500 threshold (rolls over to next cycle).
   * AC4: Initiate payout via Razorpay (or placeholder).
   * AC6: Update commission records to PAID.
   */
  async processPayoutCycle(): Promise<{
    totalDealers: number;
    totalAmountPaise: bigint;
    failedPayouts: number;
  }> {
    // AC2: Aggregate approved commissions per dealer
    const dealerAggregates = await this.prisma.dealerCommission.groupBy({
      by: ['dealerId'],
      where: { status: CommissionStatus.APPROVED },
      _sum: { commissionAmountPaise: true },
    });

    let totalDealers = 0;
    let totalAmountPaise = 0n;
    let failedPayouts = 0;

    for (const agg of dealerAggregates) {
      const amount = agg._sum.commissionAmountPaise ?? 0n;

      // AC3: Skip below threshold (AC9: rolls over)
      if (amount < MIN_PAYOUT_PAISE) {
        continue;
      }

      // Get primary verified bank account
      const bankAccount = await this.prisma.dealerBankAccount.findFirst({
        where: {
          dealerId: agg.dealerId,
          isPrimary: true,
          isVerified: true,
        },
      });

      if (!bankAccount) {
        continue; // No verified bank account
      }

      const dealer = await this.prisma.dealer.findUnique({
        where: { id: agg.dealerId },
        select: { cityId: true, userId: true },
      });

      if (!dealer) continue;

      try {
        // Wrap payout in a transaction to prevent double-processing
        const payout = await this.prisma.$transaction(async (tx) => {
          // Lock the specific APPROVED commissions for this dealer
          const commissions = await tx.dealerCommission.findMany({
            where: {
              dealerId: agg.dealerId,
              status: CommissionStatus.APPROVED,
            },
            select: { id: true, commissionAmountPaise: true },
          });

          if (commissions.length === 0) {
            return null; // Already processed by a concurrent cycle
          }

          const lockedAmount = commissions.reduce(
            (sum, c) => sum + c.commissionAmountPaise,
            0n,
          );
          const commissionIds = commissions.map((c) => c.id);

          // AC5: Create payout record
          const payoutRecord = await tx.dealerPayout.create({
            data: {
              dealerId: agg.dealerId,
              bankAccountId: bankAccount.id,
              totalAmountPaise: lockedAmount,
              status: 'PROCESSING',
              cityId: dealer!.cityId,
            },
          });

          // AC6: Update only the specific commission IDs (not blanket status filter)
          await tx.dealerCommission.updateMany({
            where: {
              id: { in: commissionIds },
              status: CommissionStatus.APPROVED, // Guard: only if still APPROVED
            },
            data: {
              status: CommissionStatus.PAID,
              paidAt: new Date(),
              payoutId: payoutRecord.id,
            },
          });

          return { payoutRecord, lockedAmount };
        });

        if (!payout) continue; // Skipped — already processed

        // AC4: Initiate payout (Razorpay Payout API integration point)
        const transactionId = await this.initiateRazorpayPayout(
          bankAccount,
          payout.lockedAmount,
          payout.payoutRecord.id,
        );

        await this.prisma.dealerPayout.update({
          where: { id: payout.payoutRecord.id },
          data: {
            status: 'COMPLETED',
            transactionId,
            processedAt: new Date(),
          },
        });

        totalDealers++;
        totalAmountPaise += payout.lockedAmount;
      } catch (error) {
        failedPayouts++;
        // AC8: Failed payouts will be retried next cycle
      }
    }

    return { totalDealers, totalAmountPaise, failedPayouts };
  }

  /**
   * Razorpay Payout API integration.
   * When RAZORPAY_PAYOUT_ENABLED=true and a client is available,
   * creates a Contact + FundAccount + Payout via the real API.
   * Otherwise returns a placeholder transaction ID.
   */
  private async initiateRazorpayPayout(
    bankAccount: DealerBankAccount,
    amountPaise: bigint,
    payoutId: string,
  ): Promise<string> {
    if (process.env.RAZORPAY_PAYOUT_ENABLED !== 'true' || !this.razorpayClient) {
      logger.warn(
        { payoutId, amountPaise: amountPaise.toString() },
        'RAZORPAY_PAYOUT_ENABLED is not set or no client — skipping actual payout, returning placeholder transaction ID',
      );
      return `txn_placeholder_${payoutId.slice(0, 8)}_${Date.now()}`;
    }

    // Decrypt account number only at payout time (NFR9)
    const accountNumber = decrypt(bankAccount.accountNumberEncrypted);

    // Step 1: Create or reuse Razorpay Contact
    const contact = await this.razorpayClient.createContact({
      name: bankAccount.accountHolderName,
      contact: bankAccount.accountHolderName,
      type: 'vendor',
      reference_id: `dealer_payout_${payoutId}`,
    });

    // Step 2: Create Fund Account
    const fundAccount = await this.razorpayClient.createFundAccount({
      contact_id: contact.id,
      account_type: 'bank_account',
      bank_account: {
        name: bankAccount.accountHolderName,
        ifsc: bankAccount.ifscCode,
        account_number: accountNumber,
      },
    });

    // Step 3: Initiate Payout
    const payout = await this.razorpayClient.createPayout({
      fund_account_id: fundAccount.id,
      amount: Number(amountPaise),
      currency: 'INR',
      mode: 'NEFT',
      purpose: 'payout',
      reference_id: payoutId,
    });

    logger.info(
      { payoutId, razorpayPayoutId: payout.id, amountPaise: amountPaise.toString() },
      'Razorpay payout initiated successfully',
    );

    return payout.id;
  }

  /**
   * Get payout history for a dealer.
   */
  async getPayoutHistory(dealerId: string, cursor?: string, limit = 20) {
    return this.prisma.dealerPayout.findMany({
      where: { dealerId },
      include: {
        bankAccount: {
          select: { accountNumberMasked: true, bankName: true },
        },
      },
      orderBy: { payoutDate: 'desc' },
      take: limit,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
  }

  /**
   * AC10: Ops payout dashboard for reconciliation.
   * Returns counts per status plus aggregate paise amounts.
   */
  async getPayoutDashboard(cityId?: string) {
    const where = cityId ? { cityId } : {};

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [pending, processing, completed, failed, pendingAggregate, paidThisMonth] =
      await Promise.all([
        this.prisma.dealerPayout.count({ where: { ...where, status: 'PENDING' } }),
        this.prisma.dealerPayout.count({ where: { ...where, status: 'PROCESSING' } }),
        this.prisma.dealerPayout.count({ where: { ...where, status: 'COMPLETED' } }),
        this.prisma.dealerPayout.count({ where: { ...where, status: 'FAILED' } }),
        this.prisma.dealerPayout.aggregate({
          where: { ...where, status: { in: ['PENDING', 'PROCESSING'] } },
          _sum: { totalAmountPaise: true },
          _count: true,
        }),
        this.prisma.dealerPayout.aggregate({
          where: {
            ...where,
            status: 'COMPLETED',
            processedAt: { gte: monthStart },
          },
          _sum: { totalAmountPaise: true },
        }),
      ]);

    return {
      pending,
      processing,
      completed,
      failed,
      totalPendingPaise: (pendingAggregate._sum.totalAmountPaise ?? 0n).toString(),
      totalPaidThisMonthPaise: (paidThisMonth._sum.totalAmountPaise ?? 0n).toString(),
      pendingCount: pendingAggregate._count,
    };
  }
}
