/**
 * Credit application service for applying referral credits to payments.
 *
 * Story 4.12: Customer Referral Credits - Apply to Payment
 *
 * TODO: CustomerReferralCredit and CreditUsageLog models do not exist
 * in the Prisma schema yet. All credit-related prisma calls are stubbed.
 */
import { PrismaClient } from '@prisma/client';
import { AppError } from '../../core/errors/app-error.js';

export interface PaymentBreakdown {
  serviceFeePaise: number;
  govtFeePaise: number;
  creditsAppliedPaise: number;
  razorpayChargePaise: number;
  totalPaise: number;
  creditBalancePaise: number;
  creditBalanceAfterPaise: number;
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
    // TODO: serviceRequest model does not exist in schema; use serviceInstance.
    const serviceInstance = await this.prisma.serviceInstance.findUnique({
      where: { id: serviceRequestId },
    });

    if (!serviceInstance) {
      throw new AppError('SERVICE_REQUEST_NOT_FOUND', 'Service request not found', 404);
    }

    if (serviceInstance.customerId !== customerId) {
      throw new AppError('FORBIDDEN', 'Not your service request', 403);
    }

    // TODO: serviceFeePaise and govtFeeEstimatePaise fields do not exist on ServiceInstance.
    // Stubbed with zero values. These should come from metadata or a related model.
    const serviceFeePaise = 0;
    const govtFeePaise = 0;
    const creditBalance = await this.getCreditBalance(customerId);

    let creditsAppliedPaise = 0;

    if (applyCredits && creditBalance > 0) {
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
   * Uses FIFO (oldest credits first) within an atomic transaction.
   *
   * Story 4.12 AC5
   */
  async deductCreditsOnPayment(
    _customerId: string,
    _serviceRequestId: string,
    _paymentId: string,
    creditsToDeductPaise: number,
    _cityId: string,
  ): Promise<void> {
    if (creditsToDeductPaise <= 0) return;

    // TODO: CustomerReferralCredit and CreditUsageLog models do not exist in schema.
    // Credit deduction is stubbed until these models are added.
    throw new AppError(
      'NOT_IMPLEMENTED',
      'Credit deduction not yet available - models pending schema migration',
      501,
    );
  }

  private async getCreditBalance(_customerId: string): Promise<number> {
    // TODO: CustomerReferralCredit model does not exist in schema. Stubbed.
    return 0;
  }
}
