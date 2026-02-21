/**
 * Tests for Dealer domain validation schemas.
 * Covers: dealerKycSubmitSchema, kycRejectSchema, whiteLabelSchema,
 *         addBankAccountSchema, verifyBankAccountSchema, pipelineFilterSchema,
 *         leaderboardQuerySchema
 */
import { describe, test, expect } from 'vitest';
import {
  dealerKycSubmitSchema,
  kycRejectSchema,
  whiteLabelSchema,
  addBankAccountSchema,
  verifyBankAccountSchema,
  pipelineFilterSchema,
  leaderboardQuerySchema,
} from '../dealers.validation';

describe('Dealers Validation Schemas', () => {
  // ============================================================
  // dealerKycSubmitSchema
  // ============================================================

  describe('dealerKycSubmitSchema', () => {
    const validKyc = {
      fullName: 'Rajesh Kumar',
      panNumber: 'ABCDE1234F',
      aadhaarLastFour: '1234',
      ifscCode: 'HDFC0001234',
      accountNumber: '123456789',
      accountHolderName: 'Rajesh Kumar',
      panPhotoUrl: 'https://storage.example.com/pan.jpg',
    };

    test('accepts valid KYC submission', () => {
      const result = dealerKycSubmitSchema.safeParse(validKyc);
      expect(result.success).toBe(true);
    });

    test('accepts optional businessName', () => {
      const result = dealerKycSubmitSchema.safeParse({
        ...validKyc,
        businessName: 'Rajesh Properties',
      });
      expect(result.success).toBe(true);
    });

    test('rejects invalid PAN format', () => {
      const result = dealerKycSubmitSchema.safeParse({
        ...validKyc,
        panNumber: 'INVALID123',
      });
      expect(result.success).toBe(false);
    });

    test('rejects PAN with lowercase letters', () => {
      const result = dealerKycSubmitSchema.safeParse({
        ...validKyc,
        panNumber: 'abcde1234f',
      });
      expect(result.success).toBe(false);
    });

    test('rejects aadhaarLastFour with non-digits', () => {
      const result = dealerKycSubmitSchema.safeParse({
        ...validKyc,
        aadhaarLastFour: 'abcd',
      });
      expect(result.success).toBe(false);
    });

    test('rejects aadhaarLastFour not exactly 4 digits', () => {
      const result = dealerKycSubmitSchema.safeParse({
        ...validKyc,
        aadhaarLastFour: '12345',
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid IFSC format', () => {
      const result = dealerKycSubmitSchema.safeParse({
        ...validKyc,
        ifscCode: 'INVALID123',
      });
      expect(result.success).toBe(false);
    });

    test('accepts IFSC with correct format XXXX0XXXXXXX', () => {
      const result = dealerKycSubmitSchema.safeParse({
        ...validKyc,
        ifscCode: 'SBIN0001234',
      });
      expect(result.success).toBe(true);
    });

    test('rejects account number with fewer than 9 digits', () => {
      const result = dealerKycSubmitSchema.safeParse({
        ...validKyc,
        accountNumber: '12345678',
      });
      expect(result.success).toBe(false);
    });

    test('rejects account number with more than 18 digits', () => {
      const result = dealerKycSubmitSchema.safeParse({
        ...validKyc,
        accountNumber: '1234567890123456789',
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid URL for panPhotoUrl', () => {
      const result = dealerKycSubmitSchema.safeParse({
        ...validKyc,
        panPhotoUrl: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    test('rejects fullName shorter than 2 characters', () => {
      const result = dealerKycSubmitSchema.safeParse({
        ...validKyc,
        fullName: 'A',
      });
      expect(result.success).toBe(false);
    });

    test('rejects fullName longer than 100 characters', () => {
      const result = dealerKycSubmitSchema.safeParse({
        ...validKyc,
        fullName: 'A'.repeat(101),
      });
      expect(result.success).toBe(false);
    });

    test('accepts valid 18-digit account number', () => {
      const result = dealerKycSubmitSchema.safeParse({
        ...validKyc,
        accountNumber: '123456789012345678',
      });
      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // kycRejectSchema
  // ============================================================

  describe('kycRejectSchema', () => {
    test('accepts valid rejection reason', () => {
      const result = kycRejectSchema.safeParse({ reason: 'INVALID_PAN' });
      expect(result.success).toBe(true);
    });

    test('accepts all valid reasons', () => {
      const reasons = ['INVALID_PAN', 'INVALID_AADHAAR', 'MISMATCHED_NAME', 'BLURRY_DOCUMENTS', 'OTHER'] as const;
      for (const reason of reasons) {
        const result = kycRejectSchema.safeParse({ reason });
        expect(result.success).toBe(true);
      }
    });

    test('accepts optional notes', () => {
      const result = kycRejectSchema.safeParse({
        reason: 'OTHER',
        notes: 'Document is not clearly visible',
      });
      expect(result.success).toBe(true);
    });

    test('rejects invalid reason', () => {
      const result = kycRejectSchema.safeParse({ reason: 'WRONG_REASON' });
      expect(result.success).toBe(false);
    });

    test('rejects notes exceeding 500 characters', () => {
      const result = kycRejectSchema.safeParse({
        reason: 'OTHER',
        notes: 'a'.repeat(501),
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // whiteLabelSchema
  // ============================================================

  describe('whiteLabelSchema', () => {
    test('accepts enabling with valid fields', () => {
      const result = whiteLabelSchema.safeParse({
        enabled: true,
        businessName: 'Acme Properties',
        logoUrl: 'https://acme.com/logo.png',
        brandColor: '#FF5733',
      });
      expect(result.success).toBe(true);
    });

    test('accepts disabling white-label', () => {
      const result = whiteLabelSchema.safeParse({ enabled: false });
      expect(result.success).toBe(true);
    });

    test('rejects invalid hex color format', () => {
      const result = whiteLabelSchema.safeParse({
        enabled: true,
        brandColor: 'red',
      });
      expect(result.success).toBe(false);
    });

    test('accepts valid 6-digit hex color', () => {
      const result = whiteLabelSchema.safeParse({
        enabled: true,
        brandColor: '#AABBCC',
      });
      expect(result.success).toBe(true);
    });

    test('rejects 3-digit short hex color', () => {
      const result = whiteLabelSchema.safeParse({
        enabled: true,
        brandColor: '#ABC',
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid URL for logoUrl', () => {
      const result = whiteLabelSchema.safeParse({
        enabled: true,
        logoUrl: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    test('rejects businessName shorter than 2 characters', () => {
      const result = whiteLabelSchema.safeParse({
        enabled: true,
        businessName: 'A',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // addBankAccountSchema
  // ============================================================

  describe('addBankAccountSchema', () => {
    const validAccount = {
      accountHolderName: 'Rajesh Kumar',
      ifscCode: 'HDFC0001234',
      accountNumber: '123456789',
      accountType: 'SAVINGS' as const,
      bankName: 'HDFC Bank',
    };

    test('accepts valid bank account', () => {
      const result = addBankAccountSchema.safeParse(validAccount);
      expect(result.success).toBe(true);
    });

    test('accepts CURRENT account type', () => {
      const result = addBankAccountSchema.safeParse({
        ...validAccount,
        accountType: 'CURRENT',
      });
      expect(result.success).toBe(true);
    });

    test('rejects invalid account type', () => {
      const result = addBankAccountSchema.safeParse({
        ...validAccount,
        accountType: 'FIXED_DEPOSIT',
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid IFSC format', () => {
      const result = addBankAccountSchema.safeParse({
        ...validAccount,
        ifscCode: 'INVALID',
      });
      expect(result.success).toBe(false);
    });

    test('rejects bankName shorter than 2 characters', () => {
      const result = addBankAccountSchema.safeParse({
        ...validAccount,
        bankName: 'A',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // verifyBankAccountSchema
  // ============================================================

  describe('verifyBankAccountSchema', () => {
    test('accepts 6-digit code', () => {
      const result = verifyBankAccountSchema.safeParse({ code: '123456' });
      expect(result.success).toBe(true);
    });

    test('rejects code shorter than 6 digits', () => {
      const result = verifyBankAccountSchema.safeParse({ code: '12345' });
      expect(result.success).toBe(false);
    });

    test('rejects code longer than 6 digits', () => {
      const result = verifyBankAccountSchema.safeParse({ code: '1234567' });
      expect(result.success).toBe(false);
    });

    test('rejects missing code', () => {
      const result = verifyBankAccountSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // pipelineFilterSchema
  // ============================================================

  describe('pipelineFilterSchema', () => {
    test('accepts empty filter (all optional)', () => {
      const result = pipelineFilterSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    test('accepts status filter', () => {
      expect(pipelineFilterSchema.safeParse({ status: 'active' }).success).toBe(true);
      expect(pipelineFilterSchema.safeParse({ status: 'completed' }).success).toBe(true);
    });

    test('rejects invalid status', () => {
      const result = pipelineFilterSchema.safeParse({ status: 'pending' });
      expect(result.success).toBe(false);
    });

    test('accepts valid datetime strings', () => {
      const result = pipelineFilterSchema.safeParse({
        startDate: '2024-01-01T00:00:00.000Z',
        endDate: '2024-12-31T23:59:59.000Z',
      });
      expect(result.success).toBe(true);
    });

    test('rejects invalid datetime format', () => {
      const result = pipelineFilterSchema.safeParse({
        startDate: 'not-a-date',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // leaderboardQuerySchema
  // ============================================================

  describe('leaderboardQuerySchema', () => {
    test('accepts monthly period', () => {
      const result = leaderboardQuerySchema.safeParse({ period: 'monthly' });
      expect(result.success).toBe(true);
    });

    test('accepts all-time period', () => {
      const result = leaderboardQuerySchema.safeParse({ period: 'all-time' });
      expect(result.success).toBe(true);
    });

    test('defaults to monthly when period not specified', () => {
      const result = leaderboardQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.period).toBe('monthly');
      }
    });

    test('rejects invalid period', () => {
      const result = leaderboardQuerySchema.safeParse({ period: 'weekly' });
      expect(result.success).toBe(false);
    });
  });
});
