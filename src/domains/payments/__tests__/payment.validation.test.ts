/**
 * Tests for Payment domain validation schemas.
 * Covers: createPaymentOrderSchema, verifyPaymentSchema, createPaymentLinkSchema,
 *         applyCreditRequestSchema, paymentRetrySchema, reportFeeVarianceSchema,
 *         resolveFeeVarianceSchema
 * Stories 4.1, 4.2, 4.6, 4.12, 4.15
 */
import { describe, test, expect } from 'vitest';
import {
  createPaymentOrderSchema,
  verifyPaymentSchema,
  createPaymentLinkSchema,
  applyCreditRequestSchema,
  paymentRetrySchema,
} from '../payment.validation';
import {
  reportFeeVarianceSchema,
  resolveFeeVarianceSchema,
} from '../fee-variance.validation';

describe('Payment Validation Schemas', () => {
  // ============================================================
  // createPaymentOrderSchema
  // ============================================================

  describe('createPaymentOrderSchema', () => {
    test('accepts valid payment order', () => {
      const result = createPaymentOrderSchema.safeParse({
        serviceRequestId: 'sr-001',
        paymentType: 'ADVANCE',
        amountPaise: '150000',
      });
      expect(result.success).toBe(true);
    });

    test('defaults currency to INR', () => {
      const result = createPaymentOrderSchema.safeParse({
        serviceRequestId: 'sr-001',
        paymentType: 'FULL',
        amountPaise: '500000',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.currency).toBe('INR');
      }
    });

    test('accepts all valid paymentType values', () => {
      for (const paymentType of ['ADVANCE', 'BALANCE', 'FULL'] as const) {
        const result = createPaymentOrderSchema.safeParse({
          serviceRequestId: 'sr-001',
          paymentType,
          amountPaise: '100000',
        });
        expect(result.success).toBe(true);
      }
    });

    test('rejects invalid paymentType', () => {
      const result = createPaymentOrderSchema.safeParse({
        serviceRequestId: 'sr-001',
        paymentType: 'INSTALLMENT',
        amountPaise: '100000',
      });
      expect(result.success).toBe(false);
    });

    test('rejects zero amountPaise', () => {
      const result = createPaymentOrderSchema.safeParse({
        serviceRequestId: 'sr-001',
        paymentType: 'FULL',
        amountPaise: '0',
      });
      expect(result.success).toBe(false);
    });

    test('rejects negative amountPaise', () => {
      const result = createPaymentOrderSchema.safeParse({
        serviceRequestId: 'sr-001',
        paymentType: 'FULL',
        amountPaise: '-100',
      });
      expect(result.success).toBe(false);
    });

    test('rejects empty serviceRequestId', () => {
      const result = createPaymentOrderSchema.safeParse({
        serviceRequestId: '',
        paymentType: 'FULL',
        amountPaise: '100000',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // verifyPaymentSchema
  // ============================================================

  describe('verifyPaymentSchema', () => {
    const validPayload = {
      razorpayOrderId: 'order_123456789',
      razorpayPaymentId: 'pay_123456789',
      razorpaySignature: 'abcdef1234567890abcdef1234567890',
      serviceRequestId: 'sr-001',
      amountPaise: '150000',
    };

    test('accepts valid payment verification payload', () => {
      const result = verifyPaymentSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    test('accepts with optional creditsAppliedPaise', () => {
      const result = verifyPaymentSchema.safeParse({
        ...validPayload,
        creditsAppliedPaise: '5000',
      });
      expect(result.success).toBe(true);
    });

    test('rejects missing razorpayOrderId', () => {
      const { razorpayOrderId, ...rest } = validPayload;
      const result = verifyPaymentSchema.safeParse(rest);
      expect(result.success).toBe(false);
    });

    test('rejects empty razorpayPaymentId', () => {
      const result = verifyPaymentSchema.safeParse({
        ...validPayload,
        razorpayPaymentId: '',
      });
      expect(result.success).toBe(false);
    });

    test('rejects empty razorpaySignature', () => {
      const result = verifyPaymentSchema.safeParse({
        ...validPayload,
        razorpaySignature: '',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // createPaymentLinkSchema
  // ============================================================

  describe('createPaymentLinkSchema', () => {
    const validPayload = {
      serviceRequestId: 'sr-001',
      amountPaise: '150000',
      customerName: 'Priya Singh',
      customerPhone: '+919876543210',
      description: 'Title Check Service Payment',
    };

    test('accepts valid payment link creation payload', () => {
      const result = createPaymentLinkSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    test('defaults expiryMinutes to 30', () => {
      const result = createPaymentLinkSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.expiryMinutes).toBe(30);
      }
    });

    test('accepts with optional customerEmail', () => {
      const result = createPaymentLinkSchema.safeParse({
        ...validPayload,
        customerEmail: 'priya@example.com',
      });
      expect(result.success).toBe(true);
    });

    test('rejects invalid customerEmail', () => {
      const result = createPaymentLinkSchema.safeParse({
        ...validPayload,
        customerEmail: 'not-an-email',
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid phone number', () => {
      const result = createPaymentLinkSchema.safeParse({
        ...validPayload,
        customerPhone: '123',
      });
      expect(result.success).toBe(false);
    });

    test('rejects expiryMinutes below 5', () => {
      const result = createPaymentLinkSchema.safeParse({
        ...validPayload,
        expiryMinutes: 4,
      });
      expect(result.success).toBe(false);
    });

    test('rejects expiryMinutes above 1440 (24 hours)', () => {
      const result = createPaymentLinkSchema.safeParse({
        ...validPayload,
        expiryMinutes: 1441,
      });
      expect(result.success).toBe(false);
    });

    test('rejects empty customerName', () => {
      const result = createPaymentLinkSchema.safeParse({
        ...validPayload,
        customerName: '',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // applyCreditRequestSchema
  // ============================================================

  describe('applyCreditRequestSchema', () => {
    test('accepts valid credit application request', () => {
      const result = applyCreditRequestSchema.safeParse({
        serviceRequestId: 'sr-001',
        applyCredits: true,
      });
      expect(result.success).toBe(true);
    });

    test('accepts applyCredits as false', () => {
      const result = applyCreditRequestSchema.safeParse({
        serviceRequestId: 'sr-001',
        applyCredits: false,
      });
      expect(result.success).toBe(true);
    });

    test('rejects missing applyCredits', () => {
      const result = applyCreditRequestSchema.safeParse({
        serviceRequestId: 'sr-001',
      });
      expect(result.success).toBe(false);
    });

    test('rejects missing serviceRequestId', () => {
      const result = applyCreditRequestSchema.safeParse({
        applyCredits: true,
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // paymentRetrySchema
  // ============================================================

  describe('paymentRetrySchema', () => {
    test('accepts valid retry request', () => {
      const result = paymentRetrySchema.safeParse({
        serviceRequestId: 'sr-001',
      });
      expect(result.success).toBe(true);
    });

    test('rejects empty serviceRequestId', () => {
      const result = paymentRetrySchema.safeParse({
        serviceRequestId: '',
      });
      expect(result.success).toBe(false);
    });

    test('rejects missing serviceRequestId', () => {
      const result = paymentRetrySchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // reportFeeVarianceSchema
  // ============================================================

  describe('reportFeeVarianceSchema', () => {
    const validVariancePayload = {
      serviceRequestId: 'sr-001',
      estimatedGovtFeePaise: '50000',
      actualGovtFeePaise: '75000',
      varianceReasonEn: 'Government fees increased due to property valuation update.',
      varianceReasonHi: 'सरकारी फीस बढ़ गई।',
    };

    test('accepts valid fee variance report', () => {
      const result = reportFeeVarianceSchema.safeParse(validVariancePayload);
      expect(result.success).toBe(true);
    });

    test('accepts with optional evidenceUrls', () => {
      const result = reportFeeVarianceSchema.safeParse({
        ...validVariancePayload,
        evidenceUrls: ['https://example.com/receipt.pdf'],
      });
      expect(result.success).toBe(true);
    });

    test('rejects varianceReasonEn shorter than 10 characters', () => {
      const result = reportFeeVarianceSchema.safeParse({
        ...validVariancePayload,
        varianceReasonEn: 'Short',
      });
      expect(result.success).toBe(false);
    });

    test('rejects varianceReasonHi shorter than 5 characters', () => {
      const result = reportFeeVarianceSchema.safeParse({
        ...validVariancePayload,
        varianceReasonHi: 'छोट',
      });
      expect(result.success).toBe(false);
    });

    test('rejects zero estimatedGovtFeePaise', () => {
      const result = reportFeeVarianceSchema.safeParse({
        ...validVariancePayload,
        estimatedGovtFeePaise: '0',
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid URL in evidenceUrls', () => {
      const result = reportFeeVarianceSchema.safeParse({
        ...validVariancePayload,
        evidenceUrls: ['not-a-url'],
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // resolveFeeVarianceSchema
  // ============================================================

  describe('resolveFeeVarianceSchema', () => {
    test('accepts valid resolution approval', () => {
      const result = resolveFeeVarianceSchema.safeParse({
        varianceId: 'var-001',
        resolution: 'APPROVED',
        resolutionNotes: 'Variance approved per audit.',
      });
      expect(result.success).toBe(true);
    });

    test('accepts all valid resolution values', () => {
      for (const resolution of ['APPROVED', 'REJECTED', 'ADJUSTED'] as const) {
        const result = resolveFeeVarianceSchema.safeParse({
          varianceId: 'var-001',
          resolution,
          resolutionNotes: 'Notes about the resolution.',
        });
        expect(result.success).toBe(true);
      }
    });

    test('accepts with optional adjustedAmountPaise for ADJUSTED resolution', () => {
      const result = resolveFeeVarianceSchema.safeParse({
        varianceId: 'var-001',
        resolution: 'ADJUSTED',
        adjustedAmountPaise: '60000',
        resolutionNotes: 'Adjusted to actual receipt amount.',
      });
      expect(result.success).toBe(true);
    });

    test('rejects invalid resolution', () => {
      const result = resolveFeeVarianceSchema.safeParse({
        varianceId: 'var-001',
        resolution: 'PENDING',
        resolutionNotes: 'Some notes.',
      });
      expect(result.success).toBe(false);
    });

    test('rejects empty resolutionNotes', () => {
      const result = resolveFeeVarianceSchema.safeParse({
        varianceId: 'var-001',
        resolution: 'APPROVED',
        resolutionNotes: '',
      });
      expect(result.success).toBe(false);
    });

    test('rejects missing varianceId', () => {
      const result = resolveFeeVarianceSchema.safeParse({
        resolution: 'APPROVED',
        resolutionNotes: 'Notes.',
      });
      expect(result.success).toBe(false);
    });
  });
});
