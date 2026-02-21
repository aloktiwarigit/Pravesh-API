/**
 * Tests for Lawyer domain Zod validation schemas.
 * Covers: lawyerRegisterSchema, lawyerVerifySchema, assignExpertiseSchema,
 *         declineCaseSchema, submitOpinionSchema, rateOpinionSchema,
 *         updateCommissionSchema, deactivateLawyerSchema, toggleDndSchema
 */
import { describe, test, expect } from 'vitest';
import {
  lawyerRegisterSchema,
  lawyerVerifySchema,
  assignExpertiseSchema,
  requestExpertiseSchema,
  createLegalCaseSchema,
  acceptCaseSchema,
  declineCaseSchema,
  submitOpinionSchema,
  reviewOpinionSchema,
  lawyerBankAccountSchema,
  rateOpinionSchema,
  reassignCaseSchema,
  updateCommissionSchema,
  deactivateLawyerSchema,
  toggleDndSchema,
} from '../lawyers.validation';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('Lawyer Validation Schemas', () => {
  // ============================================================
  // lawyerRegisterSchema
  // ============================================================

  describe('lawyerRegisterSchema', () => {
    const validInput = {
      barCouncilNumber: 'UP/1234/2015',
      stateBarCouncil: 'Uttar Pradesh',
      admissionYear: 2015,
      practicingCertUrl: 'https://docs.example.com/cert.pdf',
    };

    test('accepts valid registration', () => {
      expect(lawyerRegisterSchema.safeParse(validInput).success).toBe(true);
    });

    test('accepts with optional barCouncilIdUrl', () => {
      const result = lawyerRegisterSchema.safeParse({
        ...validInput,
        barCouncilIdUrl: 'https://docs.example.com/id.pdf',
      });
      expect(result.success).toBe(true);
    });

    test('rejects barCouncilNumber shorter than 5 characters', () => {
      const result = lawyerRegisterSchema.safeParse({
        ...validInput,
        barCouncilNumber: 'UP',
      });
      expect(result.success).toBe(false);
    });

    test('rejects barCouncilNumber exceeding 30 characters', () => {
      const result = lawyerRegisterSchema.safeParse({
        ...validInput,
        barCouncilNumber: 'A'.repeat(31),
      });
      expect(result.success).toBe(false);
    });

    test('rejects admissionYear before 1950', () => {
      const result = lawyerRegisterSchema.safeParse({
        ...validInput,
        admissionYear: 1949,
      });
      expect(result.success).toBe(false);
    });

    test('rejects admissionYear in the future', () => {
      const result = lawyerRegisterSchema.safeParse({
        ...validInput,
        admissionYear: new Date().getFullYear() + 1,
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid practicingCertUrl', () => {
      const result = lawyerRegisterSchema.safeParse({
        ...validInput,
        practicingCertUrl: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid barCouncilIdUrl', () => {
      const result = lawyerRegisterSchema.safeParse({
        ...validInput,
        barCouncilIdUrl: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // lawyerVerifySchema
  // ============================================================

  describe('lawyerVerifySchema', () => {
    test('accepts approve action', () => {
      const result = lawyerVerifySchema.safeParse({
        lawyerId: VALID_UUID,
        action: 'approve',
      });
      expect(result.success).toBe(true);
    });

    test('accepts reject with reason', () => {
      const result = lawyerVerifySchema.safeParse({
        lawyerId: VALID_UUID,
        action: 'reject',
        rejectionReason: 'Documents are invalid',
      });
      expect(result.success).toBe(true);
    });

    test('rejects reject action without rejectionReason', () => {
      const result = lawyerVerifySchema.safeParse({
        lawyerId: VALID_UUID,
        action: 'reject',
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid action', () => {
      const result = lawyerVerifySchema.safeParse({
        lawyerId: VALID_UUID,
        action: 'suspend',
      });
      expect(result.success).toBe(false);
    });

    test('rejects non-UUID lawyerId', () => {
      const result = lawyerVerifySchema.safeParse({
        lawyerId: 'not-uuid',
        action: 'approve',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // assignExpertiseSchema
  // ============================================================

  describe('assignExpertiseSchema', () => {
    test('accepts valid tags', () => {
      const result = assignExpertiseSchema.safeParse({
        lawyerId: VALID_UUID,
        tags: ['TITLE_OPINIONS', 'LDA_DISPUTES'],
      });
      expect(result.success).toBe(true);
    });

    test('accepts all valid expertise tags', () => {
      const allTags = [
        'LDA_DISPUTES',
        'TITLE_OPINIONS',
        'RERA_MATTERS',
        'SUCCESSION_LEGAL_HEIR',
        'AGRICULTURAL_LAND_CONVERSION',
        'ENCUMBRANCE_ISSUES',
        'MUTATION_CHALLENGES',
        'PROPERTY_TAX_DISPUTES',
      ];
      const result = assignExpertiseSchema.safeParse({ lawyerId: VALID_UUID, tags: allTags });
      expect(result.success).toBe(true);
    });

    test('rejects empty tags array', () => {
      const result = assignExpertiseSchema.safeParse({
        lawyerId: VALID_UUID,
        tags: [],
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid tag name', () => {
      const result = assignExpertiseSchema.safeParse({
        lawyerId: VALID_UUID,
        tags: ['INVALID_TAG'],
      });
      expect(result.success).toBe(false);
    });

    test('rejects more than 8 tags', () => {
      const result = assignExpertiseSchema.safeParse({
        lawyerId: VALID_UUID,
        tags: [
          'LDA_DISPUTES', 'LDA_DISPUTES', 'LDA_DISPUTES', 'LDA_DISPUTES',
          'LDA_DISPUTES', 'LDA_DISPUTES', 'LDA_DISPUTES', 'LDA_DISPUTES', 'LDA_DISPUTES',
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // createLegalCaseSchema
  // ============================================================

  describe('createLegalCaseSchema', () => {
    const validCase = {
      serviceRequestId: VALID_UUID,
      requiredExpertise: 'TITLE_OPINIONS' as const,
      lawyerId: VALID_UUID,
      issueSummary: 'Title dispute regarding property ownership',
      caseFeeInPaise: 500000,
    };

    test('accepts valid case creation', () => {
      expect(createLegalCaseSchema.safeParse(validCase).success).toBe(true);
    });

    test('defaults casePriority to NORMAL', () => {
      const result = createLegalCaseSchema.safeParse(validCase);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.casePriority).toBe('NORMAL');
      }
    });

    test('accepts URGENT priority', () => {
      const result = createLegalCaseSchema.safeParse({ ...validCase, casePriority: 'URGENT' });
      expect(result.success).toBe(true);
    });

    test('rejects issueSummary shorter than 10 characters', () => {
      const result = createLegalCaseSchema.safeParse({ ...validCase, issueSummary: 'Short' });
      expect(result.success).toBe(false);
    });

    test('rejects negative caseFeeInPaise', () => {
      const result = createLegalCaseSchema.safeParse({ ...validCase, caseFeeInPaise: -1 });
      expect(result.success).toBe(false);
    });

    test('rejects invalid requiredExpertise', () => {
      const result = createLegalCaseSchema.safeParse({ ...validCase, requiredExpertise: 'INVALID' });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // declineCaseSchema
  // ============================================================

  describe('declineCaseSchema', () => {
    test('accepts valid decline with standard reason', () => {
      const result = declineCaseSchema.safeParse({
        caseId: VALID_UUID,
        reason: 'Workload full',
      });
      expect(result.success).toBe(true);
    });

    test('accepts Other reason with reasonText', () => {
      const result = declineCaseSchema.safeParse({
        caseId: VALID_UUID,
        reason: 'Other',
        reasonText: 'Personal emergency',
      });
      expect(result.success).toBe(true);
    });

    test('rejects Other reason without reasonText', () => {
      const result = declineCaseSchema.safeParse({
        caseId: VALID_UUID,
        reason: 'Other',
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid reason', () => {
      const result = declineCaseSchema.safeParse({
        caseId: VALID_UUID,
        reason: 'Not interested',
      });
      expect(result.success).toBe(false);
    });

    test('accepts all valid reasons', () => {
      const reasons = ['Outside expertise', 'Conflict of interest', 'Workload full', 'Other'];
      for (const reason of reasons) {
        const data: any = { caseId: VALID_UUID, reason };
        if (reason === 'Other') data.reasonText = 'Reason text here';
        expect(declineCaseSchema.safeParse(data).success).toBe(true);
      }
    });
  });

  // ============================================================
  // submitOpinionSchema
  // ============================================================

  describe('submitOpinionSchema', () => {
    const validOpinion = {
      caseId: VALID_UUID,
      opinionDocUrl: 'https://docs.example.com/opinion.pdf',
      opinionType: 'FAVORABLE' as const,
    };

    test('accepts FAVORABLE opinion', () => {
      expect(submitOpinionSchema.safeParse(validOpinion).success).toBe(true);
    });

    test('accepts ADVERSE opinion', () => {
      expect(submitOpinionSchema.safeParse({ ...validOpinion, opinionType: 'ADVERSE' }).success).toBe(true);
    });

    test('accepts CONDITIONAL opinion with conditions', () => {
      const result = submitOpinionSchema.safeParse({
        ...validOpinion,
        opinionType: 'CONDITIONAL',
        conditions: 'Subject to clearance of encumbrances',
      });
      expect(result.success).toBe(true);
    });

    test('rejects CONDITIONAL opinion without conditions', () => {
      const result = submitOpinionSchema.safeParse({
        ...validOpinion,
        opinionType: 'CONDITIONAL',
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid opinionDocUrl', () => {
      const result = submitOpinionSchema.safeParse({
        ...validOpinion,
        opinionDocUrl: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid opinionType', () => {
      const result = submitOpinionSchema.safeParse({
        ...validOpinion,
        opinionType: 'NEUTRAL',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // lawyerBankAccountSchema
  // ============================================================

  describe('lawyerBankAccountSchema', () => {
    const validAccount = {
      accountHolderName: 'Rajesh Kumar',
      accountNumber: '123456789',
      ifscCode: 'HDFC0001234',
      bankName: 'HDFC Bank',
    };

    test('accepts valid bank account', () => {
      expect(lawyerBankAccountSchema.safeParse(validAccount).success).toBe(true);
    });

    test('accepts with optional upiId', () => {
      const result = lawyerBankAccountSchema.safeParse({
        ...validAccount,
        upiId: 'lawyer@hdfc',
      });
      expect(result.success).toBe(true);
    });

    test('rejects invalid IFSC code', () => {
      const result = lawyerBankAccountSchema.safeParse({
        ...validAccount,
        ifscCode: 'INVALID',
      });
      expect(result.success).toBe(false);
    });

    test('rejects account number with fewer than 9 digits', () => {
      const result = lawyerBankAccountSchema.safeParse({
        ...validAccount,
        accountNumber: '12345678',
      });
      expect(result.success).toBe(false);
    });

    test('rejects account number with more than 18 digits', () => {
      const result = lawyerBankAccountSchema.safeParse({
        ...validAccount,
        accountNumber: '1234567890123456789',
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid UPI ID format', () => {
      const result = lawyerBankAccountSchema.safeParse({
        ...validAccount,
        upiId: 'invalid-upi',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // rateOpinionSchema
  // ============================================================

  describe('rateOpinionSchema', () => {
    test('accepts rating of 5 with feedback', () => {
      const result = rateOpinionSchema.safeParse({
        caseId: VALID_UUID,
        rating: 5,
        feedback: 'Excellent legal opinion',
      });
      expect(result.success).toBe(true);
    });

    test('accepts minimum rating of 1', () => {
      const result = rateOpinionSchema.safeParse({ caseId: VALID_UUID, rating: 1 });
      expect(result.success).toBe(true);
    });

    test('rejects rating of 0', () => {
      const result = rateOpinionSchema.safeParse({ caseId: VALID_UUID, rating: 0 });
      expect(result.success).toBe(false);
    });

    test('rejects rating of 6', () => {
      const result = rateOpinionSchema.safeParse({ caseId: VALID_UUID, rating: 6 });
      expect(result.success).toBe(false);
    });

    test('rejects decimal rating', () => {
      const result = rateOpinionSchema.safeParse({ caseId: VALID_UUID, rating: 4.5 });
      expect(result.success).toBe(false);
    });

    test('rejects feedback longer than 500 characters', () => {
      const result = rateOpinionSchema.safeParse({
        caseId: VALID_UUID,
        rating: 3,
        feedback: 'a'.repeat(501),
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // updateCommissionSchema
  // ============================================================

  describe('updateCommissionSchema', () => {
    test('accepts commission rate of 10% (minimum)', () => {
      const result = updateCommissionSchema.safeParse({ lawyerId: VALID_UUID, commissionRate: 10 });
      expect(result.success).toBe(true);
    });

    test('accepts commission rate of 30% (maximum)', () => {
      const result = updateCommissionSchema.safeParse({ lawyerId: VALID_UUID, commissionRate: 30 });
      expect(result.success).toBe(true);
    });

    test('accepts preferred tier rate of 15%', () => {
      const result = updateCommissionSchema.safeParse({ lawyerId: VALID_UUID, commissionRate: 15 });
      expect(result.success).toBe(true);
    });

    test('rejects commission rate below 10%', () => {
      const result = updateCommissionSchema.safeParse({ lawyerId: VALID_UUID, commissionRate: 9 });
      expect(result.success).toBe(false);
    });

    test('rejects commission rate above 30%', () => {
      const result = updateCommissionSchema.safeParse({ lawyerId: VALID_UUID, commissionRate: 31 });
      expect(result.success).toBe(false);
    });

    test('rejects decimal commission rate', () => {
      const result = updateCommissionSchema.safeParse({ lawyerId: VALID_UUID, commissionRate: 15.5 });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // deactivateLawyerSchema
  // ============================================================

  describe('deactivateLawyerSchema', () => {
    test('accepts valid deactivation', () => {
      const result = deactivateLawyerSchema.safeParse({
        lawyerId: VALID_UUID,
        reason: 'Repeated misconduct violations',
      });
      expect(result.success).toBe(true);
    });

    test('rejects reason shorter than 10 characters', () => {
      const result = deactivateLawyerSchema.safeParse({
        lawyerId: VALID_UUID,
        reason: 'Short',
      });
      expect(result.success).toBe(false);
    });

    test('rejects reason longer than 500 characters', () => {
      const result = deactivateLawyerSchema.safeParse({
        lawyerId: VALID_UUID,
        reason: 'a'.repeat(501),
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // toggleDndSchema
  // ============================================================

  describe('toggleDndSchema', () => {
    test('accepts enabled: true', () => {
      expect(toggleDndSchema.safeParse({ enabled: true }).success).toBe(true);
    });

    test('accepts enabled: false', () => {
      expect(toggleDndSchema.safeParse({ enabled: false }).success).toBe(true);
    });

    test('rejects missing enabled field', () => {
      expect(toggleDndSchema.safeParse({}).success).toBe(false);
    });

    test('rejects non-boolean enabled', () => {
      expect(toggleDndSchema.safeParse({ enabled: 'yes' }).success).toBe(false);
    });
  });

  // ============================================================
  // reassignCaseSchema
  // ============================================================

  describe('reassignCaseSchema', () => {
    test('accepts valid reassignment', () => {
      const result = reassignCaseSchema.safeParse({
        caseId: VALID_UUID,
        newLawyerId: VALID_UUID,
      });
      expect(result.success).toBe(true);
    });

    test('rejects non-UUID caseId', () => {
      const result = reassignCaseSchema.safeParse({
        caseId: 'not-uuid',
        newLawyerId: VALID_UUID,
      });
      expect(result.success).toBe(false);
    });

    test('rejects non-UUID newLawyerId', () => {
      const result = reassignCaseSchema.safeParse({
        caseId: VALID_UUID,
        newLawyerId: 'not-uuid',
      });
      expect(result.success).toBe(false);
    });
  });
});
