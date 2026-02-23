/**
 * Credit application service for applying referral credits to payments.
 *
 * Story 4.12: Customer Referral Credits - Apply to Payment
 */
import { PrismaClient } from '@prisma/client';
import { AppError } from '../../core/errors/app-error.js';

export interface PaymentBreakdown {
  serviceFeePaise: bigint;
  govtFeePaise: bigint;
  creditsAppliedPaise: bigint;
  razorpayChargePaise: bigint;
  totalPaise: bigint;
  creditBalancePaise: bigint;
  creditBalanceAfterPaise: bigint;
}

export class CreditApplicationService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Calculates payment breakdown with optional credit application.
   * Credits apply to service fee only, never govt fees.
   *
   * Story 4.12 AC2-AC4
   */
  async calculateBreakdown(
    customerId: string,
    serviceRequestId: string,
    applyCredits: boolean,
  ): Promise<PaymentBreakdown> {
    const serviceRequest = await this.prisma.serviceRequest.findUnique({
      where: { id: serviceRequestId },
    });

    if (!serviceRequest) {
      throw new AppError('SERVICE_REQUEST_NOT_FOUND', 'Service request not found', 404);
    }

    if (serviceRequest.customerId !== customerId) {
      throw new AppError('FORBIDDEN', 'Not your service request', 403);
    }

    const serviceFeePaise: bigint = BigInt(serviceRequest.serviceFeePaise ?? 0);
    const govtFeePaise: bigint = BigInt(serviceRequest.govtFeeEstimatePaise ?? 0);

    const creditBalance = await this.getCreditBalance(customerId);

    let creditsAppliedPaise = 0n;

    if (applyCredits && creditBalance > 0n) {
      // Credits apply to service fee only, never govt fees
      creditsAppliedPaise = creditBalance >= serviceFeePaise
        ? serviceFeePaise
        : creditBalance;
    }

    const serviceFeeAfterCredits = serviceFeePaise - creditsAppliedPaise;
    const razorpayChargePaise = serviceFeeAfterCredits + govtFeePaise;
    const totalPaise = serviceFeePaise + govtFeePaise;
    const creditBalanceAfterPaise = creditBalance - creditsAppliedPaise;

    return {
      serviceFeePaise,
      govtFeePaise,
      creditsAppliedPaise,
      razorpayChargePaise,
      totalPaise,
      creditBalancePaise: creditBalance,
      creditBalanceAfterPaise,
    };
  }

  /**
   * Deducts credits from customer's referral credits on successful payment.
   * Uses FIFO (oldest credits first) within an atomic transaction with row locks.
   *
   * Story 4.12 AC5
   */
  async deductCreditsOnPayment(
    customerId: string,
    serviceRequestId: string,
    paymentId: string,
    creditsToDeductPaise: bigint,
    tenantId: string,
  ): Promise<void> {
    if (creditsToDeductPaise <= 0n) return;

    await this.prisma.$transaction(async (tx) => {
      // Fetch available credits with row-level lock (FOR UPDATE), oldest first (FIFO)
      const credits: Array<{ id: string; creditAmountPaise: bigint; usedAmountPaise: bigint }> =
        await tx.$queryRaw`
          SELECT id, credit_amount_paise AS "creditAmountPaise", used_amount_paise AS "usedAmountPaise"
          FROM customer_referral_credits
          WHERE referrer_customer_id = ${customerId}
            AND (expires_at IS NULL OR expires_at > NOW())
            AND credit_amount_paise > used_amount_paise
          ORDER BY created_at ASC
          FOR UPDATE
        `;

      let remaining = creditsToDeductPaise;

      for (const credit of credits) {
        if (remaining <= 0n) break;

        const available = BigInt(credit.creditAmountPaise) - BigInt(credit.usedAmountPaise);
        if (available <= 0n) continue;

        const deductFromThis = available >= remaining ? remaining : available;
        const newUsed = BigInt(credit.usedAmountPaise) + deductFromThis;

        await tx.customerReferralCredit.update({
          where: { id: credit.id },
          data: { usedAmountPaise: Number(newUsed) },
        });

        // Log the usage
        await tx.creditUsageLog.create({
          data: {
            creditId: credit.id,
            customerId,
            serviceRequestId,
            paymentId,
            amountUsedPaise: deductFromThis,
            tenantId,
          },
        });

        remaining -= deductFromThis;
      }

      if (remaining > 0n) {
        throw new AppError(
          'INSUFFICIENT_CREDITS',
          'Insufficient referral credits to complete deduction',
          409,
        );
      }
    });
  }

  private async getCreditBalance(customerId: string): Promise<bigint> {
    const result = await this.prisma.customerReferralCredit.aggregate({
      where: {
        referrerCustomerId: customerId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      _sum: {
        creditAmountPaise: true,
        usedAmountPaise: true,
      },
    });

    const total = BigInt(result._sum?.creditAmountPaise ?? 0);
    const used = BigInt(result._sum?.usedAmountPaise ?? 0);
    return total - used;
  }
}
