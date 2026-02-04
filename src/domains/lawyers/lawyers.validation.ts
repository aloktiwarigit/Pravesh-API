import { z } from 'zod';

// ============================================================
// Story 12-1: Lawyer Registration & Bar Council Verification
// ============================================================

// State-specific bar council number patterns
const BAR_COUNCIL_PATTERNS: Record<string, RegExp> = {
  'delhi': /^D\/\d{4}\/\d{4}$/,
  'maharashtra': /^MAH\/\d{5}\/\d{4}$/,
  'karnataka': /^KAR\/\d{5}\/\d{4}$/,
  'uttar pradesh': /^UP\/\d{4,6}\/\d{4}$/,
  'default': /^[A-Z]{2,5}\/\d{4,6}\/\d{4}$/,
};

export const lawyerRegisterSchema = z.object({
  barCouncilNumber: z.string().min(5).max(30),
  stateBarCouncil: z.string().min(2).max(50),
  admissionYear: z.number().int().min(1950).max(new Date().getFullYear()),
  practicingCertUrl: z.string().url(),
  barCouncilIdUrl: z.string().url().optional(),
});

export const lawyerVerifySchema = z.object({
  lawyerId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  rejectionReason: z.string().max(500).optional(),
}).refine(
  (data) => data.action !== 'reject' || (data.rejectionReason && data.rejectionReason.length > 0),
  { message: 'Rejection reason required when rejecting', path: ['rejectionReason'] },
);

// ============================================================
// Story 12-2: Lawyer Expertise Tagging
// ============================================================

export const EXPERTISE_TAGS = [
  'LDA_DISPUTES',
  'TITLE_OPINIONS',
  'RERA_MATTERS',
  'SUCCESSION_LEGAL_HEIR',
  'AGRICULTURAL_LAND_CONVERSION',
  'ENCUMBRANCE_ISSUES',
  'MUTATION_CHALLENGES',
  'PROPERTY_TAX_DISPUTES',
] as const;

export const assignExpertiseSchema = z.object({
  lawyerId: z.string().uuid(),
  tags: z.array(z.enum(EXPERTISE_TAGS)).min(1).max(8),
});

export const requestExpertiseSchema = z.object({
  requestedTag: z.enum(EXPERTISE_TAGS),
  supportingDocUrl: z.string().url().optional(),
});

export const reviewExpertiseRequestSchema = z.object({
  requestId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  rejectionReason: z.string().max(500).optional(),
});

// ============================================================
// Story 12-3: Case Routing to Matched Lawyers
// ============================================================

export const createLegalCaseSchema = z.object({
  serviceRequestId: z.string().uuid(),
  requiredExpertise: z.enum(EXPERTISE_TAGS),
  lawyerId: z.string().uuid(),
  issueSummary: z.string().min(10).max(2000),
  caseFeeInPaise: z.number().int().positive(),
  casePriority: z.enum(['NORMAL', 'URGENT']).default('NORMAL'),
});

// ============================================================
// Story 12-4: Case Acceptance/Decline
// ============================================================

export const DECLINE_REASONS = [
  'Outside expertise',
  'Conflict of interest',
  'Workload full',
  'Other',
] as const;

export const acceptCaseSchema = z.object({
  caseId: z.string().uuid(),
});

export const declineCaseSchema = z.object({
  caseId: z.string().uuid(),
  reason: z.enum(DECLINE_REASONS),
  reasonText: z.string().max(500).optional(),
}).refine(
  (data) => data.reason !== 'Other' || (data.reasonText && data.reasonText.length > 0),
  { message: 'Text input required when reason is Other', path: ['reasonText'] },
);

// ============================================================
// Story 12-5: Document Access
// ============================================================

export const logDocumentAccessSchema = z.object({
  accessType: z.enum(['view', 'download']).default('view'),
});

export const requestDocumentSchema = z.object({
  requestText: z.string().min(5).max(1000),
});

// ============================================================
// Story 12-6: Legal Opinion Upload
// ============================================================

export const submitOpinionSchema = z.object({
  caseId: z.string().uuid(),
  opinionDocUrl: z.string().url(),
  opinionType: z.enum(['FAVORABLE', 'ADVERSE', 'CONDITIONAL']),
  summary: z.string().max(500).optional(),
  conditions: z.string().max(2000).optional(),
}).refine(
  (data) => data.opinionType !== 'CONDITIONAL' || (data.conditions && data.conditions.length > 0),
  { message: 'Conditions required for Conditional opinion type', path: ['conditions'] },
);

export const reviewOpinionSchema = z.object({
  opinionId: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  reviewNotes: z.string().max(1000).optional(),
});

// ============================================================
// Story 12-8: Lawyer Payment & Bank Account
// ============================================================

export const lawyerBankAccountSchema = z.object({
  accountHolderName: z.string().min(2).max(100),
  accountNumber: z.string().regex(/^[0-9]{9,18}$/, 'Invalid account number'),
  ifscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code'),
  bankName: z.string().min(2).max(100),
  upiId: z.string().regex(/^[\w.-]+@[\w]+$/, 'Invalid UPI ID').optional(),
});

// ============================================================
// Story 12-9: Customer Rates Legal Opinion Quality
// ============================================================

export const rateOpinionSchema = z.object({
  caseId: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  feedback: z.string().max(500).optional(),
});

// ============================================================
// Story 12-11: Ops Management
// ============================================================

export const reassignCaseSchema = z.object({
  caseId: z.string().uuid(),
  newLawyerId: z.string().uuid(),
});

export const updateCommissionSchema = z.object({
  lawyerId: z.string().uuid(),
  commissionRate: z.number().int().min(10).max(30),
});

export const deactivateLawyerSchema = z.object({
  lawyerId: z.string().uuid(),
  reason: z.string().min(10).max(500),
});

// ============================================================
// Story 12-12: DND Toggle
// ============================================================

export const toggleDndSchema = z.object({
  enabled: z.boolean(),
});

// ============================================================
// Type Exports
// ============================================================

export type LawyerRegisterInput = z.infer<typeof lawyerRegisterSchema>;
export type LawyerVerifyInput = z.infer<typeof lawyerVerifySchema>;
export type AssignExpertiseInput = z.infer<typeof assignExpertiseSchema>;
export type CreateLegalCaseInput = z.infer<typeof createLegalCaseSchema>;
export type DeclineCaseInput = z.infer<typeof declineCaseSchema>;
export type SubmitOpinionInput = z.infer<typeof submitOpinionSchema>;
export type ReviewOpinionInput = z.infer<typeof reviewOpinionSchema>;
export type RateOpinionInput = z.infer<typeof rateOpinionSchema>;
export type BankAccountInput = z.infer<typeof lawyerBankAccountSchema>;
