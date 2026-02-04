import { z } from 'zod';

// ============================================================
// City Config Types (Story 14-1)
// ============================================================

export const governmentAuthoritySchema = z.object({
  name: z.string().min(1),
  departmentType: z.string().min(1),
  address: z.string().optional(),
});

export const officeAddressSchema = z.object({
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  gpsLat: z.number().min(-90).max(90).optional(),
  gpsLng: z.number().min(-180).max(180).optional(),
});

export const workingHoursSchema = z.object({
  weekdayStart: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  weekdayEnd: z.string().regex(/^\d{2}:\d{2}$/, 'Format: HH:MM'),
  saturdayStart: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  saturdayEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  sundayClosed: z.boolean().default(true),
});

export const holidaySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format: YYYY-MM-DD'),
  name: z.string().min(1),
  type: z.enum(['national', 'state', 'local']),
});

export const cityConfigSchema = z.object({
  governmentAuthorities: z.array(governmentAuthoritySchema).min(1),
  officeAddresses: z.record(z.string(), officeAddressSchema),
  contactNumbers: z.record(z.string(), z.string()),
  workingHours: workingHoursSchema,
  holidayCalendar: z.array(holidaySchema),
});

export type CityConfig = z.infer<typeof cityConfigSchema>;
export type GovernmentAuthority = z.infer<typeof governmentAuthoritySchema>;
export type OfficeAddress = z.infer<typeof officeAddressSchema>;
export type WorkingHours = z.infer<typeof workingHoursSchema>;
export type Holiday = z.infer<typeof holidaySchema>;

// ============================================================
// City Service Fee Types (Story 14-2)
// ============================================================

export const feeSlabSchema = z.object({
  minValuePaise: z.number().int().min(0),
  maxValuePaise: z.number().int().min(0).nullable(),
  feePaise: z.number().int().min(0),
  label: z.string().optional(),
});

export const feeConfigSchema = z.object({
  baseFeePaise: z.number().int().min(0),
  propertyValueSlabs: z.array(feeSlabSchema).optional(),
  slabMultipliers: z.record(z.string(), z.number()).optional(),
  gstPercentage: z.number().min(0).max(100).default(18),
  description: z.string().optional(),
});

export type FeeConfig = z.infer<typeof feeConfigSchema>;
export type FeeSlab = z.infer<typeof feeSlabSchema>;

// ============================================================
// City Process Override Types (Story 14-3)
// ============================================================

export const processStepSchema = z.object({
  stepName: z.string().min(1),
  description: z.string(),
  requiredDocuments: z.array(z.string()).optional(),
  estimatedDays: z.number().int().min(0),
  officeLocation: z.string().optional(),
  departmentName: z.string().optional(),
  sortOrder: z.number().int().min(0),
});

export const conditionalRuleSchema = z.object({
  condition: z.string(), // e.g., "property_type == agricultural"
  additionalSteps: z.array(processStepSchema),
});

export const customStepsSchema = z.object({
  steps: z.array(processStepSchema).min(1),
});

export type ProcessStep = z.infer<typeof processStepSchema>;
export type ConditionalRule = z.infer<typeof conditionalRuleSchema>;

// ============================================================
// City Document Requirement Types (Story 14-4)
// ============================================================

export const documentRequirementSchema = z.object({
  documentName: z.string().min(1),
  description: z.string().optional(),
  isMandatory: z.boolean().default(true),
  acceptedFormats: z.array(z.enum(['PDF', 'JPG', 'PNG', 'JPEG'])).min(1),
  maxFileSizeMb: z.number().min(0.1).max(50).default(10),
  sampleUrl: z.string().url().optional(),
});

export const cityDocumentsSchema = z.object({
  documents: z.array(documentRequirementSchema).min(1),
});

export type DocumentRequirement = z.infer<typeof documentRequirementSchema>;

// ============================================================
// Franchise Application Types (Story 14-5)
// ============================================================

export const franchiseApplicationCreateSchema = z.object({
  applicantName: z.string().min(2).max(200),
  applicantEmail: z.string().email(),
  applicantPhone: z.string().regex(/^\+?[1-9]\d{9,14}$/, 'Invalid phone number'),
  cityId: z.string().uuid(),
  businessExperience: z.string().min(10).max(5000),
  financialCapacity: z.string().min(5).max(2000),
  references: z.array(z.object({
    name: z.string(),
    phone: z.string(),
    relationship: z.string(),
  })).min(1),
  businessPlanUrl: z.string().url().optional(),
});

export const reviewChecklistSchema = z.object({
  financialViability: z.boolean().optional(),
  localMarketKnowledge: z.boolean().optional(),
  referencesVerified: z.boolean().optional(),
  businessPlanQuality: z.enum(['poor', 'fair', 'good', 'excellent']).optional(),
});

export type FranchiseApplicationStatus =
  | 'pending_review'
  | 'info_requested'
  | 'interview_scheduled'
  | 'approved'
  | 'rejected'
  | 'agreement_sent'
  | 'onboarded';

// ============================================================
// Franchise Contract Types (Story 14-8)
// ============================================================

export const contractTermsSchema = z.object({
  franchisePercentage: z.number().min(0).max(100),
  platformPercentage: z.number().min(0).max(100),
  payoutDay: z.number().int().min(1).max(28).default(5),
  minimumMonthlyGuarantee: z.number().int().min(0).optional(),
  contractStartDate: z.string(),
  contractEndDate: z.string().optional(),
});

export type ContractTerms = z.infer<typeof contractTermsSchema>;

// ============================================================
// Dealer Management Types (Story 14-7)
// ============================================================

export const dealerTierConfigSchema = z.object({
  bronze: z.object({ minReferrals: z.number(), commissionPercent: z.number() }),
  silver: z.object({ minReferrals: z.number(), commissionPercent: z.number() }),
  gold: z.object({ minReferrals: z.number(), commissionPercent: z.number() }),
});

export type DealerTierConfig = z.infer<typeof dealerTierConfigSchema>;

// ============================================================
// Corporate Audit Types (Story 14-16)
// ============================================================

export const auditChecklistItemSchema = z.object({
  item: z.string(),
  status: z.enum(['pending', 'pass', 'fail', 'not_applicable']).default('pending'),
  notes: z.string().optional(),
});

export const correctiveActionSchema = z.object({
  description: z.string(),
  deadline: z.string(),
  assignedTo: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'overdue']).default('pending'),
});

export type AuditStatus =
  | 'scheduled'
  | 'in_progress'
  | 'findings_shared'
  | 'corrective_actions'
  | 'closed';

// ============================================================
// Training Module Types (Story 14-15)
// ============================================================

export const quizQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).min(2).max(6),
  correctOptionIndex: z.number().int().min(0),
});

export const quizDataSchema = z.object({
  questions: z.array(quizQuestionSchema).min(1),
  passingScore: z.number().int().min(0).max(100).default(80),
  timeLimit: z.number().int().min(60).optional(), // seconds
});

export type QuizData = z.infer<typeof quizDataSchema>;
