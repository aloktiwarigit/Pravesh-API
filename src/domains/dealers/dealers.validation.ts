import { z } from 'zod';

// ============================================================
// Story 9.1: KYC Submission Validation
// ============================================================

const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_NUMBER_REGEX = /^[0-9]{9,18}$/;

export const dealerKycSubmitSchema = z.object({
  fullName: z.string().min(2).max(100),
  businessName: z.string().max(200).optional(),
  panNumber: z.string().regex(PAN_REGEX, 'Invalid PAN format (expected: ABCDE1234F)'),
  aadhaarLastFour: z.string().length(4).regex(/^[0-9]{4}$/, 'Must be last 4 digits of Aadhaar'),
  businessAddress: z.string().max(500).optional(),
  ifscCode: z.string().regex(IFSC_REGEX, 'Invalid IFSC format'),
  accountNumber: z.string().regex(ACCOUNT_NUMBER_REGEX, 'Invalid account number (9-18 digits)'),
  accountHolderName: z.string().min(2).max(100),
  panPhotoUrl: z.string().url(),
  aadhaarPhotoUrl: z.string().url().optional(),
});

export type DealerKycSubmitInput = z.infer<typeof dealerKycSubmitSchema>;

// ============================================================
// Story 9.2: KYC Review Validation
// ============================================================

export const kycRejectSchema = z.object({
  reason: z.enum([
    'INVALID_PAN',
    'INVALID_AADHAAR',
    'MISMATCHED_NAME',
    'BLURRY_DOCUMENTS',
    'OTHER',
  ]),
  notes: z.string().max(500).optional(),
});

export type KycRejectInput = z.infer<typeof kycRejectSchema>;

// ============================================================
// Story 9.12: White-Label Validation
// ============================================================

export const whiteLabelSchema = z.object({
  enabled: z.boolean(),
  businessName: z.string().min(2).max(100).optional(),
  logoUrl: z.string().url().optional(),
  brandColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color (expected: #RRGGBB)')
    .optional(),
});

export type WhiteLabelInput = z.infer<typeof whiteLabelSchema>;

// ============================================================
// Story 9.13: Bank Account Validation
// ============================================================

export const addBankAccountSchema = z.object({
  accountHolderName: z.string().min(2).max(100),
  ifscCode: z.string().regex(IFSC_REGEX, 'Invalid IFSC format'),
  accountNumber: z.string().regex(ACCOUNT_NUMBER_REGEX, 'Invalid account number'),
  accountType: z.enum(['SAVINGS', 'CURRENT']),
  bankName: z.string().min(2).max(100),
});

export type AddBankAccountInput = z.infer<typeof addBankAccountSchema>;

export const verifyBankAccountSchema = z.object({
  code: z.string().length(6),
});

// ============================================================
// Story 9.6: Pipeline Filters
// ============================================================

export const pipelineFilterSchema = z.object({
  status: z.enum(['active', 'completed']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ============================================================
// Story 9.10: Leaderboard Params
// ============================================================

export const leaderboardQuerySchema = z.object({
  period: z.enum(['monthly', 'all-time']).default('monthly'),
});
