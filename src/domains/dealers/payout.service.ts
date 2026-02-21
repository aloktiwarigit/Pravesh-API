/**
 * Dealer Payout Service - Razorpay Payout Integration
 *
 * Story 9.8: Dealer Commission Payout via Razorpay Payouts API
 *
 * Handles:
 * - Creating fund accounts for dealers
 * - Initiating payouts for pending commissions
 * - Processing payout status updates from webhooks
 */

import { PrismaClient, DealerPayoutStatus } from '@prisma/client';
import { RazorpayPayoutClient, RazorpayPayoutResponse } from '../../core/integrations/razorpay-payout.client';
import { BusinessError } from '../../shared/errors/business-error';
import { decrypt } from '../../shared/utils/encryption';

export interface InitiatePayoutInput {
  dealerId: string;
  bankAccountId: string;
  commissionIds: string[];
  cityId: string;
  initiatedBy: string;
}

export interface PayoutResult {
  payoutId: string;
  dealerId: string;
  totalAmountPaise: bigint;
  status: DealerPayoutStatus;
  razorpayPayoutId?: string;
}

export class DealerPayoutService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly payoutClient: RazorpayPayoutClient,
  ) {}

  /**
   * Initiates a payout for a dealer's pending commissions.
   * AC1: Aggregates all selected commissions into a single payout.
   * AC2: Creates fund account if not exists, then initiates payout.
   */
  async initiatePayout(input: InitiatePayoutInput): Promise<PayoutResult> {
    const { dealerId, bankAccountId, commissionIds, cityId, initiatedBy } = input;

    // Validate dealer exists and is approved
    const dealer = await this.prisma.dealer.findUnique({
      where: { id: dealerId },
      include: {
        kyc: true,
        bankAccounts: { where: { id: bankAccountId } },
      },
    });

    if (!dealer) {
      throw new BusinessError('DEALER_NOT_FOUND', 'Dealer not found', 404);
    }

    if (dealer.dealerStatus !== 'ACTIVE') {
      throw new BusinessError('DEALER_NOT_APPROVED', 'Dealer must be active for payouts', 422);
    }

    const bankAccount = dealer.bankAccounts[0];
    if (!bankAccount) {
      throw new BusinessError('BANK_ACCOUNT_NOT_FOUND', 'Bank account not found', 404);
    }

    if (!bankAccount.isVerified) {
      throw new BusinessError('BANK_ACCOUNT_NOT_VERIFIED', 'Bank account must be verified for payouts', 422);
    }

    // Fetch pending commissions
    const commissions = await this.prisma.dealerCommission.findMany({
      where: {
        id: { in: commissionIds },
        dealerId,
        payoutId: null, // Not yet associated with a payout
      },
    });

    if (commissions.length === 0) {
      throw new BusinessError('NO_PENDING_COMMISSIONS', 'No pending commissions found for payout', 422);
    }

    if (commissions.length !== commissionIds.length) {
      throw new BusinessError(
        'COMMISSION_MISMATCH',
        'Some commissions are not available for payout',
        422,
      );
    }

    // Calculate total payout amount
    const totalAmountPaise = commissions.reduce(
      (sum, c) => sum + BigInt(c.commissionAmountPaise),
      BigInt(0),
    );

    if (totalAmountPaise <= BigInt(0)) {
      throw new BusinessError('INVALID_PAYOUT_AMOUNT', 'Payout amount must be positive', 422);
    }

    // Create payout record in PENDING status
    return this.prisma.$transaction(async (tx) => {
      const payout = await tx.dealerPayout.create({
        data: {
          dealerId,
          bankAccountId,
          totalAmountPaise,
          status: DealerPayoutStatus.PENDING,
          cityId,
        },
      });

      // Link commissions to this payout
      await tx.dealerCommission.updateMany({
        where: { id: { in: commissionIds } },
        data: { payoutId: payout.id },
      });

      return {
        payoutId: payout.id,
        dealerId,
        totalAmountPaise,
        status: payout.status,
      };
    });
  }

  /**
   * Executes a pending payout via Razorpay Payouts API.
   * AC3: Creates contact + fund account if needed, then creates payout.
   */
  async executePayout(payoutId: string): Promise<PayoutResult> {
    const payout = await this.prisma.dealerPayout.findUnique({
      where: { id: payoutId },
      include: {
        dealer: {
          include: { kyc: true },
        },
        bankAccount: true,
      },
    });

    if (!payout) {
      throw new BusinessError('PAYOUT_NOT_FOUND', 'Payout not found', 404);
    }

    if (payout.status !== DealerPayoutStatus.PENDING) {
      throw new BusinessError(
        'PAYOUT_NOT_PENDING',
        `Payout is already ${payout.status.toLowerCase()}`,
        422,
      );
    }

    const { dealer, bankAccount } = payout;

    try {
      // Mark as processing
      await this.prisma.dealerPayout.update({
        where: { id: payoutId },
        data: { status: DealerPayoutStatus.PROCESSING },
      });

      // Create or get Razorpay contact
      let contactId = bankAccount.razorpayContactId;
      if (!contactId) {
        const contact = await this.payoutClient.createContact({
          name: bankAccount.accountHolderName,
          contact: dealer.kyc?.fullName ? dealer.kyc.fullName : 'Dealer',
          type: 'vendor',
          reference_id: `dealer_${dealer.id}`,
          notes: {
            dealer_id: dealer.id,
            dealer_code: dealer.dealerCode || '',
          },
        });
        contactId = contact.id;

        // Store contact ID for future use
        await this.prisma.dealerBankAccount.update({
          where: { id: bankAccount.id },
          data: { razorpayContactId: contactId },
        });
      }

      // Create or get fund account
      let fundAccountId = bankAccount.razorpayFundAccountId;
      if (!fundAccountId) {
        // Decrypt account number for fund account creation
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

        // Store fund account ID for future use
        await this.prisma.dealerBankAccount.update({
          where: { id: bankAccount.id },
          data: { razorpayFundAccountId: fundAccountId },
        });
      }

      // Create the payout
      const razorpayPayout = await this.payoutClient.createPayout({
        fund_account_id: fundAccountId,
        amount: Number(payout.totalAmountPaise),
        currency: 'INR',
        mode: 'NEFT', // Default to NEFT, can be configured
        purpose: 'payout',
        queue_if_low_balance: true,
        reference_id: `dealer_payout_${payout.id}`,
        narration: `Dealer commission payout ${payout.id}`,
        notes: {
          payout_id: payout.id,
          dealer_id: dealer.id,
          dealer_code: dealer.dealerCode || '',
        },
      });

      // Update payout with Razorpay transaction ID
      const updatedPayout = await this.prisma.dealerPayout.update({
        where: { id: payoutId },
        data: {
          transactionId: razorpayPayout.id,
          status: this.mapRazorpayStatusToDealerStatus(razorpayPayout.status),
        },
      });

      return {
        payoutId: payout.id,
        dealerId: dealer.id,
        totalAmountPaise: payout.totalAmountPaise,
        status: updatedPayout.status,
        razorpayPayoutId: razorpayPayout.id,
      };
    } catch (error) {
      // Mark payout as failed
      await this.prisma.dealerPayout.update({
        where: { id: payoutId },
        data: {
          status: DealerPayoutStatus.FAILED,
          failureReason: error instanceof Error ? error.message : 'Unknown error',
        },
      });

      throw error;
    }
  }

  /**
   * Processes a payout webhook from Razorpay.
   * Called when payout status changes (processed, reversed, etc.)
   */
  async processPayoutWebhook(razorpayPayoutId: string, webhookPayload: RazorpayPayoutResponse): Promise<void> {
    const payout = await this.prisma.dealerPayout.findFirst({
      where: { transactionId: razorpayPayoutId },
    });

    if (!payout) {
      // Could be a lawyer payout or unknown - ignore
      return;
    }

    const newStatus = this.mapRazorpayStatusToDealerStatus(webhookPayload.status);

    await this.prisma.dealerPayout.update({
      where: { id: payout.id },
      data: {
        status: newStatus,
        processedAt: newStatus === DealerPayoutStatus.COMPLETED ? new Date() : null,
        failureReason: webhookPayload.failure_reason,
      },
    });
  }

  /**
   * Gets payout history for a dealer.
   */
  async getPayoutHistory(
    dealerId: string,
    options: { limit?: number; offset?: number; status?: DealerPayoutStatus },
  ) {
    const { limit = 20, offset = 0, status } = options;

    const where = {
      dealerId,
      ...(status && { status }),
    };

    const [payouts, total] = await Promise.all([
      this.prisma.dealerPayout.findMany({
        where,
        include: {
          bankAccount: {
            select: {
              accountHolderName: true,
              ifscCode: true,
              // Don't include encrypted account number
            },
          },
          commissions: {
            select: {
              id: true,
              commissionAmountPaise: true,
              referralId: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.dealerPayout.count({ where }),
    ]);

    return {
      payouts,
      total,
      limit,
      offset,
    };
  }

  /**
   * Gets pending payout summary for a dealer.
   */
  async getPendingPayoutSummary(dealerId: string) {
    const pendingCommissions = await this.prisma.dealerCommission.findMany({
      where: {
        dealerId,
        payoutId: null,
      },
      select: {
        id: true,
        commissionAmountPaise: true,
        referralId: true,
        createdAt: true,
      },
    });

    const totalPending = pendingCommissions.reduce(
      (sum, c) => sum + BigInt(c.commissionAmountPaise),
      BigInt(0),
    );

    return {
      pendingCommissions,
      totalPendingPaise: totalPending.toString(),
      count: pendingCommissions.length,
    };
  }

  /**
   * Maps Razorpay payout status to our DealerPayoutStatus enum.
   */
  private mapRazorpayStatusToDealerStatus(
    razorpayStatus: RazorpayPayoutResponse['status'],
  ): DealerPayoutStatus {
    switch (razorpayStatus) {
      case 'queued':
      case 'pending':
        return DealerPayoutStatus.PENDING;
      case 'processing':
        return DealerPayoutStatus.PROCESSING;
      case 'processed':
        return DealerPayoutStatus.COMPLETED;
      case 'reversed':
      case 'cancelled':
      case 'rejected':
        return DealerPayoutStatus.FAILED;
      default:
        return DealerPayoutStatus.PENDING;
    }
  }
}
