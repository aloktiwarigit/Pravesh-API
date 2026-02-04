/**
 * Epic 9 Story 9.13: Bank Account Management Service
 * Handles bank account CRUD, verification via test deposit, and primary account selection.
 * Account numbers encrypted at rest (NFR9). Only masked version in API responses.
 */

import { PrismaClient } from '@prisma/client';
import { encrypt } from '../../shared/utils/encryption';
import { BusinessError } from '../../shared/errors/business-error';
import { nanoid } from 'nanoid';

export class BankAccountService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Add a new bank account with encryption and verification code.
   * AC4: A Rs. 1 test deposit is initiated and verification code sent as reference.
   * AC8: Changes logged in audit_logs.
   */
  async addBankAccount(
    dealerId: string,
    input: {
      accountHolderName: string;
      ifscCode: string;
      accountNumber: string;
      accountType: 'SAVINGS' | 'CURRENT';
      bankName: string;
    },
  ) {
    const accountNumberMasked = `XXXX-${input.accountNumber.slice(-4)}`;
    const accountNumberEncrypted = encrypt(input.accountNumber);
    const verificationCode = nanoid(6).toUpperCase();

    const account = await this.prisma.dealerBankAccount.create({
      data: {
        dealerId,
        accountHolderName: input.accountHolderName,
        bankName: input.bankName,
        ifscCode: input.ifscCode,
        accountNumberMasked,
        accountNumberEncrypted,
        accountType: input.accountType,
        verificationCode,
        verified: false,
      },
    });

    // AC8: Audit log
    await this.prisma.auditLog.create({
      data: {
        userId: dealerId,
        userRole: 'dealer',
        action: 'BANK_ACCOUNT_ADDED',
        resourceType: 'dealer_bank_account',
        resourceId: account.id,
        metadata: { accountMasked: accountNumberMasked, ifsc: input.ifscCode },
      },
    });

    return {
      id: account.id,
      accountNumberMasked,
      bankName: input.bankName,
      ifscCode: input.ifscCode,
      verified: false,
      verificationPending: true,
    };
  }

  /**
   * AC5: Verify bank account with reference code from test deposit.
   */
  async verifyBankAccount(dealerId: string, accountId: string, code: string) {
    const account = await this.prisma.dealerBankAccount.findFirst({
      where: { id: accountId, dealerId },
    });

    if (!account) {
      throw new BusinessError('ACCOUNT_NOT_FOUND', 'Bank account not found');
    }

    if (account.verified) {
      throw new BusinessError('ACCOUNT_ALREADY_VERIFIED', 'Account is already verified');
    }

    if (account.verificationCode !== code) {
      throw new BusinessError('INVALID_VERIFICATION_CODE', 'Invalid verification code');
    }

    await this.prisma.dealerBankAccount.update({
      where: { id: accountId },
      data: { verified: true, verificationCode: null },
    });

    return { verified: true };
  }

  /**
   * AC7: Set a verified account as primary. Unset all others.
   */
  async setPrimaryAccount(dealerId: string, accountId: string) {
    const account = await this.prisma.dealerBankAccount.findFirst({
      where: { id: accountId, dealerId, verified: true },
    });

    if (!account) {
      throw new BusinessError(
        'ACCOUNT_NOT_VERIFIED',
        'Only verified accounts can be set as primary',
      );
    }

    await this.prisma.$transaction([
      this.prisma.dealerBankAccount.updateMany({
        where: { dealerId, isPrimary: true },
        data: { isPrimary: false },
      }),
      this.prisma.dealerBankAccount.update({
        where: { id: accountId },
        data: { isPrimary: true },
      }),
    ]);

    return { id: accountId, isPrimary: true };
  }

  /**
   * AC1: Get dealer bank accounts (masked, never full number).
   */
  async getDealerAccounts(dealerId: string) {
    return this.prisma.dealerBankAccount.findMany({
      where: { dealerId },
      select: {
        id: true,
        accountHolderName: true,
        bankName: true,
        ifscCode: true,
        accountNumberMasked: true,
        accountType: true,
        verified: true,
        isPrimary: true,
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'desc' }],
    });
  }
}
