/**
 * Lawyer Payout Service - Razorpay Payout Integration
 *
 * Story 12.7: Lawyer Case Fee Payout via Razorpay Payouts API
 *
 * Handles:
 * - Creating fund accounts for lawyers
 * - Initiating payouts after case completion
 * - Processing payout status updates from webhooks
 */

import { PrismaClient, PayoutStatus } from '@prisma/client';
import { RazorpayPayoutClient, RazorpayPayoutResponse } from '../../core/integrations/razorpay-payout.client';
import { BusinessError } from '../../shared/errors/business-error';
import { decrypt } from '../../shared/utils/encryption';

export interface InitiateLawyerPayoutInput {
  lawyerId: string;
  legalCaseId: string;
  payoutMethod?: 'NEFT' | 'UPI';
  initiatedBy: string;
}

export interface LawyerPayoutResult {
  payoutId: string;
  lawyerId: string;
  legalCaseId: string;
  netPayoutPaise: number;
  status: PayoutStatus;
  razorpayPayoutId?: string;
}

export class LawyerPayoutService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly payoutClient: RazorpayPayoutClient,
  ) {}

  /**
   * Initiates a payout for a completed legal case.
   * AC1: Calculates net payout after platform commission.
   * AC2: Creates payout record in PENDING status.
   */
  async initiatePayout(input: InitiateLawyerPayoutInput): Promise<LawyerPayoutResult> {
    const { lawyerId, legalCaseId, payoutMethod = 'NEFT', initiatedBy } = input;

    // Validate lawyer exists and has bank account
    const lawyer = await this.prisma.lawyer.findUnique({
      where: { id: lawyerId },
      include: {
        bankAccounts: { where: { isDefault: true }, take: 1 },
      },
    });

    if (!lawyer) {
      throw new BusinessError('LAWYER_NOT_FOUND', 'Lawyer not found', 404);
    }

    if (lawyer.lawyerStatus !== 'VERIFIED') {
      throw new BusinessError('LAWYER_NOT_VERIFIED', 'Lawyer must be verified for payouts', 422);
    }

    const bankAccount = lawyer.bankAccounts[0];
    if (!bankAccount) {
      throw new BusinessError('NO_BANK_ACCOUNT', 'Lawyer must have a bank account for payouts', 422);
    }

    // Validate legal case
    const legalCase = await this.prisma.legalCase.findUnique({
      where: { id: legalCaseId },
    });

    if (!legalCase) {
      throw new BusinessError('LEGAL_CASE_NOT_FOUND', 'Legal case not found', 404);
    }

    if (legalCase.lawyerId !== lawyerId) {
      throw new BusinessError('CASE_LAWYER_MISMATCH', 'This case is not assigned to this lawyer', 422);
    }

    if (legalCase.caseStatus !== 'COMPLETED') {
      throw new BusinessError('CASE_NOT_COMPLETED', 'Legal case must be completed for payout', 422);
    }

    // Check for existing payout
    const existingPayout = await this.prisma.lawyerPayout.findFirst({
      where: { legalCaseId },
    });

    if (existingPayout) {
      throw new BusinessError('PAYOUT_EXISTS', 'Payout already exists for this case', 422);
    }

    // Calculate payout amounts
    const grossFeeInPaise = legalCase.caseFeeInPaise;
    const commissionRate = legalCase.platformCommission;
    const commissionInPaise = Math.floor((grossFeeInPaise * commissionRate) / 100);
    const netPayoutInPaise = grossFeeInPaise - commissionInPaise;

    // Create payout record
    const payout = await this.prisma.lawyerPayout.create({
      data: {
        lawyerId,
        legalCaseId,
        grossFeeInPaise,
        commissionRate,
        commissionInPaise,
        netPayoutInPaise,
        payoutStatus: PayoutStatus.PENDING,
        payoutMethod,
      },
    });

    return {
      payoutId: payout.id,
      lawyerId,
      legalCaseId,
      netPayoutPaise: netPayoutInPaise,
      status: payout.payoutStatus,
    };
  }

  /**
   * Executes a pending payout via Razorpay Payouts API.
   * AC3: Creates contact + fund account if needed, then creates payout.
   */
  async executePayout(payoutId: string): Promise<LawyerPayoutResult> {
    const payout = await this.prisma.lawyerPayout.findUnique({
      where: { id: payoutId },
      include: {
        lawyer: {
          include: { bankAccounts: { where: { isDefault: true }, take: 1 } },
        },
        legalCase: true,
      },
    });

    if (!payout) {
      throw new BusinessError('PAYOUT_NOT_FOUND', 'Payout not found', 404);
    }

    if (payout.payoutStatus !== PayoutStatus.PENDING) {
      throw new BusinessError(
        'PAYOUT_NOT_PENDING',
        `Payout is already ${payout.payoutStatus.toLowerCase()}`,
        422,
      );
    }

    const { lawyer } = payout;
    const bankAccount = lawyer.bankAccounts[0];

    if (!bankAccount) {
      throw new BusinessError('NO_BANK_ACCOUNT', 'Lawyer must have a bank account for payouts', 422);
    }

    try {
      // Mark as confirmed (pre-processing)
      await this.prisma.lawyerPayout.update({
        where: { id: payoutId },
        data: {
          payoutStatus: PayoutStatus.CONFIRMED,
          confirmedAt: new Date(),
        },
      });

      // Create or get Razorpay contact
      let contactId = bankAccount.razorpayContactId;
      if (!contactId) {
        const contact = await this.payoutClient.createContact({
          name: bankAccount.accountHolderName,
          contact: '',
          type: 'vendor',
          reference_id: `lawyer_${lawyer.id}`,
          notes: {
            lawyer_id: lawyer.id,
            bar_council_number: lawyer.barCouncilNumber,
          },
        });
        contactId = contact.id;

        await this.prisma.lawyerBankAccount.update({
          where: { id: bankAccount.id },
          data: { razorpayContactId: contactId },
        });
      }

      // Create or get fund account
      let fundAccountId = bankAccount.razorpayFundAccountId;
      if (!fundAccountId) {
        const decryptedAccountNumber = decrypt(bankAccount.accountNumber);

        const fundAccount = await this.payoutClient.createFundAccount({
          contact_id: contactId,
          account_type: 'bank_account',
          bank_account: {
            name: bankAccount.accountHolderName,
            ifsc: bankAccount.ifscCode,
            account_number: decryptedAccountNumber,
          },
        });
        fundAccountId = fundAccount.id;

        await this.prisma.lawyerBankAccount.update({
          where: { id: bankAccount.id },
          data: { razorpayFundAccountId: fundAccountId },
        });
      }

      // Create the payout
      const razorpayPayout = await this.payoutClient.createPayout({
        fund_account_id: fundAccountId,
        amount: payout.netPayoutInPaise,
        currency: 'INR',
        mode: payout.payoutMethod === 'UPI' ? 'UPI' : 'NEFT',
        purpose: 'payout',
        queue_if_low_balance: true,
        reference_id: `lawyer_payout_${payout.id}`,
        narration: `Legal case fee payout - ${payout.legalCase.caseNumber}`,
        notes: {
          payout_id: payout.id,
          lawyer_id: lawyer.id,
          case_number: payout.legalCase.caseNumber,
        },
      });

      // Update payout with Razorpay transaction ID
      const updatedPayout = await this.prisma.lawyerPayout.update({
        where: { id: payoutId },
        data: {
          transactionId: razorpayPayout.id,
          payoutStatus: this.mapRazorpayStatusToLawyerStatus(razorpayPayout.status),
        },
      });

      return {
        payoutId: payout.id,
        lawyerId: lawyer.id,
        legalCaseId: payout.legalCaseId,
        netPayoutPaise: payout.netPayoutInPaise,
        status: updatedPayout.payoutStatus,
        razorpayPayoutId: razorpayPayout.id,
      };
    } catch (error) {
      // Mark payout as failed
      await this.prisma.lawyerPayout.update({
        where: { id: payoutId },
        data: {
          payoutStatus: PayoutStatus.FAILED,
        },
      });

      throw error;
    }
  }

  /**
   * Processes a payout webhook from Razorpay.
   */
  async processPayoutWebhook(razorpayPayoutId: string, webhookPayload: RazorpayPayoutResponse): Promise<void> {
    const payout = await this.prisma.lawyerPayout.findFirst({
      where: { transactionId: razorpayPayoutId },
    });

    if (!payout) {
      // Could be a dealer payout or unknown - ignore
      return;
    }

    const newStatus = this.mapRazorpayStatusToLawyerStatus(webhookPayload.status);

    await this.prisma.lawyerPayout.update({
      where: { id: payout.id },
      data: {
        payoutStatus: newStatus,
        processedAt: newStatus === PayoutStatus.COMPLETED ? new Date() : null,
      },
    });
  }

  /**
   * Gets payout history for a lawyer.
   */
  async getPayoutHistory(
    lawyerId: string,
    options: { limit?: number; offset?: number; status?: PayoutStatus },
  ) {
    const { limit = 20, offset = 0, status } = options;

    const where = {
      lawyerId,
      ...(status && { payoutStatus: status }),
    };

    const [payouts, total] = await Promise.all([
      this.prisma.lawyerPayout.findMany({
        where,
        include: {
          legalCase: {
            select: {
              id: true,
              caseNumber: true,
              caseStatus: true,
              completedAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.lawyerPayout.count({ where }),
    ]);

    return {
      payouts,
      total,
      limit,
      offset,
    };
  }

  /**
   * Gets earnings summary for a lawyer.
   */
  async getEarningsSummary(lawyerId: string, period?: { startDate: Date; endDate: Date }) {
    const where = {
      lawyerId,
      payoutStatus: PayoutStatus.COMPLETED,
      ...(period && {
        processedAt: {
          gte: period.startDate,
          lte: period.endDate,
        },
      }),
    };

    const payouts = await this.prisma.lawyerPayout.findMany({
      where,
      select: {
        grossFeeInPaise: true,
        commissionInPaise: true,
        netPayoutInPaise: true,
      },
    });

    const totals = payouts.reduce(
      (acc, p) => ({
        totalGross: acc.totalGross + p.grossFeeInPaise,
        totalCommission: acc.totalCommission + p.commissionInPaise,
        totalNet: acc.totalNet + p.netPayoutInPaise,
      }),
      { totalGross: 0, totalCommission: 0, totalNet: 0 },
    );

    return {
      ...totals,
      payoutCount: payouts.length,
    };
  }

  /**
   * Maps Razorpay payout status to our PayoutStatus enum.
   */
  private mapRazorpayStatusToLawyerStatus(
    razorpayStatus: RazorpayPayoutResponse['status'],
  ): PayoutStatus {
    switch (razorpayStatus) {
      case 'queued':
      case 'pending':
        return PayoutStatus.PENDING;
      case 'processing':
        return PayoutStatus.CONFIRMED;
      case 'processed':
        return PayoutStatus.COMPLETED;
      case 'reversed':
      case 'cancelled':
      case 'rejected':
        return PayoutStatus.FAILED;
      default:
        return PayoutStatus.PENDING;
    }
  }
}
