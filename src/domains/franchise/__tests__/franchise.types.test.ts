/**
 * Tests for franchise.types Zod schemas.
 * Covers: governmentAuthoritySchema, officeAddressSchema, workingHoursSchema,
 *         holidaySchema, cityConfigSchema, feeSlabSchema, feeConfigSchema,
 *         franchiseApplicationCreateSchema, contractTermsSchema,
 *         dealerTierConfigSchema, quizDataSchema, auditChecklistItemSchema
 */
import { describe, test, expect } from 'vitest';
import {
  governmentAuthoritySchema,
  officeAddressSchema,
  workingHoursSchema,
  holidaySchema,
  feeSlabSchema,
  feeConfigSchema,
  franchiseApplicationCreateSchema,
  reviewChecklistSchema,
  contractTermsSchema,
  dealerTierConfigSchema,
  quizQuestionSchema,
  quizDataSchema,
  auditChecklistItemSchema,
  correctiveActionSchema,
  documentRequirementSchema,
  processStepSchema,
} from '../franchise.types';

describe('Franchise Types Schemas', () => {
  // ============================================================
  // governmentAuthoritySchema
  // ============================================================

  describe('governmentAuthoritySchema', () => {
    test('accepts valid government authority', () => {
      const result = governmentAuthoritySchema.safeParse({
        name: 'District Registrar Office',
        departmentType: 'registration',
        address: '123 Civil Lines, Lucknow',
      });
      expect(result.success).toBe(true);
    });

    test('accepts without optional address', () => {
      const result = governmentAuthoritySchema.safeParse({
        name: 'District Registrar Office',
        departmentType: 'registration',
      });
      expect(result.success).toBe(true);
    });

    test('rejects empty name', () => {
      const result = governmentAuthoritySchema.safeParse({
        name: '',
        departmentType: 'registration',
      });
      expect(result.success).toBe(false);
    });

    test('rejects missing departmentType', () => {
      const result = governmentAuthoritySchema.safeParse({
        name: 'District Registrar',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // officeAddressSchema
  // ============================================================

  describe('officeAddressSchema', () => {
    test('accepts valid office address', () => {
      const result = officeAddressSchema.safeParse({
        addressLine1: '123 MG Road',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        pincode: '226001',
        gpsLat: 26.8467,
        gpsLng: 80.9462,
      });
      expect(result.success).toBe(true);
    });

    test('rejects invalid pincode (non-6-digit)', () => {
      const result = officeAddressSchema.safeParse({
        addressLine1: '123 MG Road',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        pincode: '2260',
      });
      expect(result.success).toBe(false);
    });

    test('rejects pincode with letters', () => {
      const result = officeAddressSchema.safeParse({
        addressLine1: '123 MG Road',
        city: 'Lucknow',
        state: 'Uttar Pradesh',
        pincode: 'ABCDEF',
      });
      expect(result.success).toBe(false);
    });

    test('rejects gpsLat out of range', () => {
      const result = officeAddressSchema.safeParse({
        addressLine1: '123 MG Road',
        city: 'Lucknow',
        state: 'UP',
        pincode: '226001',
        gpsLat: 95,
      });
      expect(result.success).toBe(false);
    });

    test('accepts valid 6-digit pincode', () => {
      const result = officeAddressSchema.safeParse({
        addressLine1: '456 Park Road',
        city: 'Varanasi',
        state: 'Uttar Pradesh',
        pincode: '221001',
      });
      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // workingHoursSchema
  // ============================================================

  describe('workingHoursSchema', () => {
    test('accepts valid working hours', () => {
      const result = workingHoursSchema.safeParse({
        weekdayStart: '09:00',
        weekdayEnd: '17:00',
        saturdayStart: '09:00',
        saturdayEnd: '13:00',
        sundayClosed: true,
      });
      expect(result.success).toBe(true);
    });

    test('accepts without optional saturday hours', () => {
      const result = workingHoursSchema.safeParse({
        weekdayStart: '09:00',
        weekdayEnd: '17:00',
      });
      expect(result.success).toBe(true);
    });

    test('defaults sundayClosed to true', () => {
      const result = workingHoursSchema.safeParse({
        weekdayStart: '09:00',
        weekdayEnd: '17:00',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sundayClosed).toBe(true);
      }
    });

    test('rejects invalid time format (not HH:MM)', () => {
      const result = workingHoursSchema.safeParse({
        weekdayStart: '9:00',
        weekdayEnd: '17:00',
      });
      expect(result.success).toBe(false);
    });

    test('rejects weekdayEnd with invalid format', () => {
      const result = workingHoursSchema.safeParse({
        weekdayStart: '09:00',
        weekdayEnd: '5pm',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // holidaySchema
  // ============================================================

  describe('holidaySchema', () => {
    test('accepts valid holiday', () => {
      const result = holidaySchema.safeParse({
        date: '2026-01-26',
        name: 'Republic Day',
        type: 'national',
      });
      expect(result.success).toBe(true);
    });

    test('accepts all holiday types', () => {
      for (const type of ['national', 'state', 'local'] as const) {
        const result = holidaySchema.safeParse({
          date: '2026-08-15',
          name: 'Independence Day',
          type,
        });
        expect(result.success).toBe(true);
      }
    });

    test('rejects invalid date format', () => {
      const result = holidaySchema.safeParse({
        date: '26-01-2026',
        name: 'Republic Day',
        type: 'national',
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid type', () => {
      const result = holidaySchema.safeParse({
        date: '2026-01-26',
        name: 'Some Holiday',
        type: 'federal',
      });
      expect(result.success).toBe(false);
    });

    test('rejects empty name', () => {
      const result = holidaySchema.safeParse({
        date: '2026-01-26',
        name: '',
        type: 'national',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // feeSlabSchema
  // ============================================================

  describe('feeSlabSchema', () => {
    test('accepts valid fee slab', () => {
      const result = feeSlabSchema.safeParse({
        minValuePaise: 0,
        maxValuePaise: 10000000,
        feePaise: 500000,
        label: 'Up to Rs. 1 Lakh',
      });
      expect(result.success).toBe(true);
    });

    test('accepts null maxValuePaise (open-ended slab)', () => {
      const result = feeSlabSchema.safeParse({
        minValuePaise: 10000000,
        maxValuePaise: null,
        feePaise: 1000000,
      });
      expect(result.success).toBe(true);
    });

    test('rejects negative minValuePaise', () => {
      const result = feeSlabSchema.safeParse({
        minValuePaise: -1,
        maxValuePaise: null,
        feePaise: 100,
      });
      expect(result.success).toBe(false);
    });

    test('rejects non-integer feePaise', () => {
      const result = feeSlabSchema.safeParse({
        minValuePaise: 0,
        maxValuePaise: null,
        feePaise: 100.5,
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // feeConfigSchema
  // ============================================================

  describe('feeConfigSchema', () => {
    test('accepts valid fee config', () => {
      const result = feeConfigSchema.safeParse({
        baseFeePaise: 500000,
        gstPercentage: 18,
        description: 'Standard title check fee',
      });
      expect(result.success).toBe(true);
    });

    test('defaults gstPercentage to 18', () => {
      const result = feeConfigSchema.safeParse({ baseFeePaise: 100000 });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.gstPercentage).toBe(18);
      }
    });

    test('rejects gstPercentage over 100', () => {
      const result = feeConfigSchema.safeParse({
        baseFeePaise: 100000,
        gstPercentage: 101,
      });
      expect(result.success).toBe(false);
    });

    test('rejects negative baseFeePaise', () => {
      const result = feeConfigSchema.safeParse({ baseFeePaise: -1 });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // franchiseApplicationCreateSchema
  // ============================================================

  describe('franchiseApplicationCreateSchema', () => {
    const validCityId = '550e8400-e29b-41d4-a716-446655440000';

    const validPayload = {
      applicantName: 'Ravi Kumar',
      applicantEmail: 'ravi@example.com',
      applicantPhone: '+919876543210',
      cityId: validCityId,
      businessExperience: 'I have 10 years of experience in real estate business.',
      financialCapacity: 'I have sufficient capital.',
      references: [{ name: 'Amit Shah', phone: '9898989898', relationship: 'colleague' }],
    };

    test('accepts valid franchise application', () => {
      const result = franchiseApplicationCreateSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    test('accepts with optional businessPlanUrl', () => {
      const result = franchiseApplicationCreateSchema.safeParse({
        ...validPayload,
        businessPlanUrl: 'https://example.com/plan.pdf',
      });
      expect(result.success).toBe(true);
    });

    test('rejects invalid email', () => {
      const result = franchiseApplicationCreateSchema.safeParse({
        ...validPayload,
        applicantEmail: 'not-an-email',
      });
      expect(result.success).toBe(false);
    });

    test('rejects non-UUID cityId', () => {
      const result = franchiseApplicationCreateSchema.safeParse({
        ...validPayload,
        cityId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    test('rejects businessExperience shorter than 10 characters', () => {
      const result = franchiseApplicationCreateSchema.safeParse({
        ...validPayload,
        businessExperience: 'Short',
      });
      expect(result.success).toBe(false);
    });

    test('rejects empty references array', () => {
      const result = franchiseApplicationCreateSchema.safeParse({
        ...validPayload,
        references: [],
      });
      expect(result.success).toBe(false);
    });

    test('rejects applicantName shorter than 2 characters', () => {
      const result = franchiseApplicationCreateSchema.safeParse({
        ...validPayload,
        applicantName: 'R',
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid phone number format', () => {
      const result = franchiseApplicationCreateSchema.safeParse({
        ...validPayload,
        applicantPhone: '123',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // reviewChecklistSchema
  // ============================================================

  describe('reviewChecklistSchema', () => {
    test('accepts empty object (all optional)', () => {
      const result = reviewChecklistSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    test('accepts valid checklist with all fields', () => {
      const result = reviewChecklistSchema.safeParse({
        financialViability: true,
        localMarketKnowledge: true,
        referencesVerified: false,
        businessPlanQuality: 'good',
      });
      expect(result.success).toBe(true);
    });

    test('accepts all businessPlanQuality values', () => {
      for (const quality of ['poor', 'fair', 'good', 'excellent'] as const) {
        const result = reviewChecklistSchema.safeParse({ businessPlanQuality: quality });
        expect(result.success).toBe(true);
      }
    });

    test('rejects invalid businessPlanQuality', () => {
      const result = reviewChecklistSchema.safeParse({ businessPlanQuality: 'average' });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // contractTermsSchema
  // ============================================================

  describe('contractTermsSchema', () => {
    test('accepts valid contract terms', () => {
      const result = contractTermsSchema.safeParse({
        franchisePercentage: 70,
        platformPercentage: 30,
        contractStartDate: '2026-01-01',
      });
      expect(result.success).toBe(true);
    });

    test('defaults payoutDay to 5', () => {
      const result = contractTermsSchema.safeParse({
        franchisePercentage: 70,
        platformPercentage: 30,
        contractStartDate: '2026-01-01',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.payoutDay).toBe(5);
      }
    });

    test('rejects franchisePercentage over 100', () => {
      const result = contractTermsSchema.safeParse({
        franchisePercentage: 101,
        platformPercentage: 30,
        contractStartDate: '2026-01-01',
      });
      expect(result.success).toBe(false);
    });

    test('rejects negative platformPercentage', () => {
      const result = contractTermsSchema.safeParse({
        franchisePercentage: 70,
        platformPercentage: -1,
        contractStartDate: '2026-01-01',
      });
      expect(result.success).toBe(false);
    });

    test('rejects payoutDay over 28', () => {
      const result = contractTermsSchema.safeParse({
        franchisePercentage: 70,
        platformPercentage: 30,
        payoutDay: 29,
        contractStartDate: '2026-01-01',
      });
      expect(result.success).toBe(false);
    });

    test('rejects payoutDay less than 1', () => {
      const result = contractTermsSchema.safeParse({
        franchisePercentage: 70,
        platformPercentage: 30,
        payoutDay: 0,
        contractStartDate: '2026-01-01',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // dealerTierConfigSchema
  // ============================================================

  describe('dealerTierConfigSchema', () => {
    test('accepts valid dealer tier config', () => {
      const result = dealerTierConfigSchema.safeParse({
        bronze: { minReferrals: 0, commissionPercent: 5 },
        silver: { minReferrals: 10, commissionPercent: 7 },
        gold: { minReferrals: 30, commissionPercent: 10 },
      });
      expect(result.success).toBe(true);
    });

    test('rejects missing bronze tier', () => {
      const result = dealerTierConfigSchema.safeParse({
        silver: { minReferrals: 10, commissionPercent: 7 },
        gold: { minReferrals: 30, commissionPercent: 10 },
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // quizQuestionSchema
  // ============================================================

  describe('quizQuestionSchema', () => {
    test('accepts valid quiz question', () => {
      const result = quizQuestionSchema.safeParse({
        question: 'What is the SLA for a standard title check?',
        options: ['3 days', '5 days', '7 days', '10 days'],
        correctOptionIndex: 1,
      });
      expect(result.success).toBe(true);
    });

    test('rejects fewer than 2 options', () => {
      const result = quizQuestionSchema.safeParse({
        question: 'True or false?',
        options: ['True'],
        correctOptionIndex: 0,
      });
      expect(result.success).toBe(false);
    });

    test('rejects more than 6 options', () => {
      const result = quizQuestionSchema.safeParse({
        question: 'Which one?',
        options: ['A', 'B', 'C', 'D', 'E', 'F', 'G'],
        correctOptionIndex: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // quizDataSchema
  // ============================================================

  describe('quizDataSchema', () => {
    const validQuestion = {
      question: 'What is SLA?',
      options: ['Service Level Agreement', 'Standard Legal Act'],
      correctOptionIndex: 0,
    };

    test('accepts valid quiz data', () => {
      const result = quizDataSchema.safeParse({
        questions: [validQuestion],
        passingScore: 80,
        timeLimit: 300,
      });
      expect(result.success).toBe(true);
    });

    test('defaults passingScore to 80', () => {
      const result = quizDataSchema.safeParse({
        questions: [validQuestion],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.passingScore).toBe(80);
      }
    });

    test('rejects empty questions array', () => {
      const result = quizDataSchema.safeParse({ questions: [] });
      expect(result.success).toBe(false);
    });

    test('rejects passingScore over 100', () => {
      const result = quizDataSchema.safeParse({
        questions: [validQuestion],
        passingScore: 101,
      });
      expect(result.success).toBe(false);
    });

    test('rejects timeLimit less than 60 seconds', () => {
      const result = quizDataSchema.safeParse({
        questions: [validQuestion],
        timeLimit: 30,
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // auditChecklistItemSchema
  // ============================================================

  describe('auditChecklistItemSchema', () => {
    test('accepts valid audit item', () => {
      const result = auditChecklistItemSchema.safeParse({
        item: 'Agent background checks complete',
        status: 'pass',
        notes: 'All 5 agents verified',
      });
      expect(result.success).toBe(true);
    });

    test('defaults status to pending', () => {
      const result = auditChecklistItemSchema.safeParse({
        item: 'Revenue reporting on time',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('pending');
      }
    });

    test('accepts all valid statuses', () => {
      for (const status of ['pending', 'pass', 'fail', 'not_applicable'] as const) {
        const result = auditChecklistItemSchema.safeParse({
          item: 'Test item',
          status,
        });
        expect(result.success).toBe(true);
      }
    });

    test('rejects invalid status', () => {
      const result = auditChecklistItemSchema.safeParse({
        item: 'Test item',
        status: 'skipped',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // correctiveActionSchema
  // ============================================================

  describe('correctiveActionSchema', () => {
    test('accepts valid corrective action', () => {
      const result = correctiveActionSchema.safeParse({
        description: 'Update agent training materials',
        deadline: '2026-03-31',
        assignedTo: 'ops-manager-001',
        status: 'in_progress',
      });
      expect(result.success).toBe(true);
    });

    test('defaults status to pending', () => {
      const result = correctiveActionSchema.safeParse({
        description: 'Complete the audit trail',
        deadline: '2026-04-01',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.status).toBe('pending');
      }
    });

    test('accepts all valid statuses', () => {
      for (const status of ['pending', 'in_progress', 'completed', 'overdue'] as const) {
        const result = correctiveActionSchema.safeParse({
          description: 'Some corrective action description',
          deadline: '2026-06-01',
          status,
        });
        expect(result.success).toBe(true);
      }
    });
  });

  // ============================================================
  // documentRequirementSchema
  // ============================================================

  describe('documentRequirementSchema', () => {
    test('accepts valid document requirement', () => {
      const result = documentRequirementSchema.safeParse({
        documentName: 'Aadhaar Card',
        description: 'Government issued identity proof',
        isMandatory: true,
        acceptedFormats: ['PDF', 'JPG'],
        maxFileSizeMb: 5,
      });
      expect(result.success).toBe(true);
    });

    test('defaults isMandatory to true and maxFileSizeMb to 10', () => {
      const result = documentRequirementSchema.safeParse({
        documentName: 'PAN Card',
        acceptedFormats: ['PDF'],
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.isMandatory).toBe(true);
        expect(result.data.maxFileSizeMb).toBe(10);
      }
    });

    test('rejects empty acceptedFormats array', () => {
      const result = documentRequirementSchema.safeParse({
        documentName: 'PAN Card',
        acceptedFormats: [],
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid format type', () => {
      const result = documentRequirementSchema.safeParse({
        documentName: 'PAN Card',
        acceptedFormats: ['DOC'],
      });
      expect(result.success).toBe(false);
    });

    test('rejects maxFileSizeMb over 50', () => {
      const result = documentRequirementSchema.safeParse({
        documentName: 'PAN Card',
        acceptedFormats: ['PDF'],
        maxFileSizeMb: 51,
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // processStepSchema
  // ============================================================

  describe('processStepSchema', () => {
    test('accepts valid process step', () => {
      const result = processStepSchema.safeParse({
        stepName: 'Submit Application',
        description: 'Visit the registrar office and submit the application form.',
        requiredDocuments: ['Aadhaar', 'PAN'],
        estimatedDays: 2,
        officeLocation: 'District Registrar Office',
        departmentName: 'Property Registration',
        sortOrder: 1,
      });
      expect(result.success).toBe(true);
    });

    test('rejects negative estimatedDays', () => {
      const result = processStepSchema.safeParse({
        stepName: 'Submit Application',
        description: 'Visit the office.',
        estimatedDays: -1,
        sortOrder: 1,
      });
      expect(result.success).toBe(false);
    });

    test('rejects empty stepName', () => {
      const result = processStepSchema.safeParse({
        stepName: '',
        description: 'Some description',
        estimatedDays: 1,
        sortOrder: 1,
      });
      expect(result.success).toBe(false);
    });
  });
});
