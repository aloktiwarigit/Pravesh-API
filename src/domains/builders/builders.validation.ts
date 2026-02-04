// ============================================================
// Epic 11: Builder Portal & Bulk Services — Zod Validation Schemas
// ============================================================

import { z } from 'zod';

// RERA number patterns by state
const RERA_PATTERNS: Record<string, RegExp> = {
  UP: /^UPRERAPRJ\d{6,10}$/,
  MH: /^P\d{11}$/,
  KA: /^PRM\/KA\/RERA\/\d{4}\/\d{3,6}$/,
  DEFAULT: /^[A-Z0-9\-\/]{8,30}$/,
};

const GST_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/;
const PHONE_PATTERN = /^\+91\d{10}$/;

// Story 11-1: Builder Registration
export const builderRegistrationSchema = z.object({
  companyName: z.string().min(2).max(200),
  reraNumber: z
    .string()
    .min(8)
    .max(30)
    .refine(
      (val) => Object.values(RERA_PATTERNS).some((p) => p.test(val)),
      { message: 'Invalid RERA registration number format' }
    ),
  gstNumber: z.string().regex(GST_PATTERN, 'Invalid GST number format'),
  contactPhone: z.string().regex(PHONE_PATTERN, 'Phone must be +91 followed by 10 digits'),
  contactEmail: z.string().email().optional(),
  cityId: z.string().uuid(),
});

export const builderApprovalSchema = z.object({
  builderId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  notes: z.string().max(1000).optional(),
});

// Story 11-1: Project Creation
export const projectCreateSchema = z.object({
  name: z.string().min(2).max(200),
  totalUnits: z.number().int().min(1).max(2000),
  location: z.string().min(5).max(500),
  projectType: z.enum(['RESIDENTIAL', 'COMMERCIAL', 'MIXED']),
  cityId: z.string().uuid(),
});

// Story 11-2: Unit Management
export const unitCreateSchema = z.object({
  unitNumber: z.string().min(1).max(50),
  buyerName: z.string().min(2).max(200),
  buyerPhone: z.string().regex(PHONE_PATTERN, 'Phone must be +91 followed by 10 digits'),
  buyerEmail: z.string().email().optional(),
});

export const unitUpdateSchema = z.object({
  unitNumber: z.string().min(1).max(50).optional(),
  buyerName: z.string().min(2).max(200).optional(),
  buyerPhone: z
    .string()
    .regex(PHONE_PATTERN, 'Phone must be +91 followed by 10 digits')
    .optional(),
  buyerEmail: z.string().email().optional(),
});

// Story 11-3: Bulk Service Request
export const bulkServiceRequestSchema = z
  .object({
    serviceIds: z.array(z.string().uuid()).min(1, 'Select at least one service'),
    packageIds: z.array(z.string().uuid()).optional().default([]),
    unitIds: z.array(z.string().uuid()).optional(),
    allUnits: z.boolean().optional().default(false),
  })
  .refine((data) => data.allUnits || (data.unitIds && data.unitIds.length > 0), {
    message: 'Select specific units or choose all units',
  });

// Story 11-6: Pricing Override
export const pricingOverrideSchema = z.object({
  discountPct: z.number().int().min(0).max(50),
  notes: z.string().max(1000).optional(),
});

export const customPricingRequestSchema = z.object({
  requestedPct: z.number().int().min(10).max(50),
  notes: z.string().min(10).max(1000),
});

// Story 11-7: Payment Reminder
export const paymentReminderSchema = z.object({
  unitId: z.string().uuid(),
});

// Story 11-8: Contract Management
export const contractCreateSchema = z
  .object({
    projectId: z.string().uuid().optional(),
    serviceIds: z.array(z.string().uuid()).min(1),
    unitCount: z.number().int().min(1).max(2000),
    discountPct: z.number().int().min(0).max(50),
    validFrom: z.string().datetime(),
    validTo: z.string().datetime(),
    autoRenew: z.boolean().optional().default(true),
  })
  .refine((d) => new Date(d.validTo) > new Date(d.validFrom), {
    message: 'validTo must be after validFrom',
  });

export const contractAmendmentSchema = z.object({
  amendmentNotes: z.string().min(10).max(2000),
});

// Story 11-9: Communication
export const broadcastCreateSchema = z.object({
  message: z.string().min(1).max(500),
  recipientFilter: z
    .object({
      allUnits: z.boolean().optional(),
      serviceStatus: z.string().optional(),
      serviceId: z.string().uuid().optional(),
    })
    .optional()
    .default({ allUnits: true }),
});

// Inferred types
export type BuilderRegistrationInput = z.infer<typeof builderRegistrationSchema>;
export type BuilderApprovalInput = z.infer<typeof builderApprovalSchema>;
export type ProjectCreateInput = z.infer<typeof projectCreateSchema>;
export type UnitCreateInput = z.infer<typeof unitCreateSchema>;
export type UnitUpdateInput = z.infer<typeof unitUpdateSchema>;
export type BulkServiceRequestInput = z.infer<typeof bulkServiceRequestSchema>;
export type PricingOverrideInput = z.infer<typeof pricingOverrideSchema>;
export type CustomPricingRequestInput = z.infer<typeof customPricingRequestSchema>;
export type ContractCreateInput = z.infer<typeof contractCreateSchema>;
export type ContractAmendmentInput = z.infer<typeof contractAmendmentSchema>;
export type BroadcastCreateInput = z.infer<typeof broadcastCreateSchema>;
