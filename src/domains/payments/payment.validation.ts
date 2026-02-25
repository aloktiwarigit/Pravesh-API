/**
 * Payment validation schemas using Zod.
 *
 * Story 4.1: Razorpay SDK Integration
 * Story 4.3: Payment Structure Enforcement
 */
import { z } from 'zod';
import { bigIntStringSchema, positiveBigIntStringSchema } from '../../core/validation/bigint-string.js';

// ============================================================
// Story 4.1: Payment Order Creation
// ============================================================

export const createPaymentOrderSchema = z.object({
  serviceRequestId: z.string().min(1),
  paymentType: z.enum(['ADVANCE', 'BALANCE', 'FULL']),
  amountPaise: positiveBigIntStringSchema.optional(),
  currency: z.string().default('INR'),
  notes: z.record(z.string()).optional(),
});

export const verifyPaymentSchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
  serviceRequestId: z.string().min(1).optional(),
  amountPaise: positiveBigIntStringSchema.optional(),
  paymentMethod: z.string().optional(),
  creditsAppliedPaise: bigIntStringSchema.optional(),
});

export const paymentStatusQuerySchema = z.object({
  serviceRequestId: z.string().min(1),
});

// ============================================================
// Story 4.2: WhatsApp Payment Link
// ============================================================

export const createPaymentLinkSchema = z.object({
  serviceRequestId: z.string().min(1),
  amountPaise: positiveBigIntStringSchema,
  customerName: z.string().min(1),
  customerPhone: z.string().regex(/^\+?[1-9]\d{9,14}$/),
  customerEmail: z.string().email().optional(),
  description: z.string().min(1),
  expiryMinutes: z.number().int().min(5).max(1440).default(30),
});

// ============================================================
// Story 4.12: Credit Application
// ============================================================

export const applyCreditRequestSchema = z.object({
  serviceRequestId: z.string().min(1),
  applyCredits: z.boolean(),
});

// ============================================================
// Story 4.15: Payment Retry
// ============================================================

export const paymentRetrySchema = z.object({
  serviceRequestId: z.string().min(1),
});

// ============================================================
// P2-1: Record Payment Failure
// ============================================================

export const recordFailureSchema = z.object({
  razorpayOrderId: z.string().min(1),
  reason: z.string().min(1),
});

// ============================================================
// P0-4: Payment History
// ============================================================

export const paymentHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.string().optional(),
});

export type RecordFailureInput = z.infer<typeof recordFailureSchema>;
export type PaymentHistoryQuery = z.infer<typeof paymentHistoryQuerySchema>;
export type CreatePaymentOrderInput = z.infer<typeof createPaymentOrderSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
export type CreatePaymentLinkInput = z.infer<typeof createPaymentLinkSchema>;
export type ApplyCreditInput = z.infer<typeof applyCreditRequestSchema>;
export type PaymentRetryInput = z.infer<typeof paymentRetrySchema>;
