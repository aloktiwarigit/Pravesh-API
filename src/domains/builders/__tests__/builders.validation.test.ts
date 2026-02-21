/**
 * Tests for Builder domain Zod validation schemas.
 * Covers: builderRegistrationSchema, projectCreateSchema, unitCreateSchema,
 *         bulkServiceRequestSchema, contractCreateSchema, broadcastCreateSchema, etc.
 */
import { describe, test, expect } from 'vitest';
import {
  builderRegistrationSchema,
  builderApprovalSchema,
  projectCreateSchema,
  unitCreateSchema,
  unitUpdateSchema,
  bulkServiceRequestSchema,
  pricingOverrideSchema,
  customPricingRequestSchema,
  contractCreateSchema,
  contractAmendmentSchema,
  broadcastCreateSchema,
} from '../builders.validation';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('Builder Validation Schemas', () => {
  // ============================================================
  // builderRegistrationSchema
  // ============================================================

  describe('builderRegistrationSchema', () => {
    const validRegistration = {
      companyName: 'Acme Builders',
      reraNumber: 'UPRERAPRJ123456',
      gstNumber: '22AAAAA0000A1Z5',
      contactPhone: '+919876543210',
      cityId: VALID_UUID,
    };

    test('accepts valid builder registration', () => {
      const result = builderRegistrationSchema.safeParse(validRegistration);
      expect(result.success).toBe(true);
    });

    test('accepts with optional contactEmail', () => {
      const result = builderRegistrationSchema.safeParse({
        ...validRegistration,
        contactEmail: 'builder@acme.com',
      });
      expect(result.success).toBe(true);
    });

    test('rejects companyName shorter than 2 characters', () => {
      const result = builderRegistrationSchema.safeParse({
        ...validRegistration,
        companyName: 'A',
      });
      expect(result.success).toBe(false);
    });

    test('rejects companyName exceeding 200 characters', () => {
      const result = builderRegistrationSchema.safeParse({
        ...validRegistration,
        companyName: 'A'.repeat(201),
      });
      expect(result.success).toBe(false);
    });

    test('accepts UP RERA format UPRERAPRJ######', () => {
      const result = builderRegistrationSchema.safeParse({
        ...validRegistration,
        reraNumber: 'UPRERAPRJ123456',
      });
      expect(result.success).toBe(true);
    });

    test('accepts MH RERA format P###########', () => {
      const result = builderRegistrationSchema.safeParse({
        ...validRegistration,
        reraNumber: 'P12345678901',
      });
      expect(result.success).toBe(true);
    });

    test('rejects invalid RERA number', () => {
      const result = builderRegistrationSchema.safeParse({
        ...validRegistration,
        reraNumber: 'INVALID',
      });
      expect(result.success).toBe(false);
    });

    test('accepts valid GST number format', () => {
      const result = builderRegistrationSchema.safeParse({
        ...validRegistration,
        gstNumber: '27AAPFU0939F1ZV',
      });
      expect(result.success).toBe(true);
    });

    test('rejects invalid GST format', () => {
      const result = builderRegistrationSchema.safeParse({
        ...validRegistration,
        gstNumber: 'INVALID-GST',
      });
      expect(result.success).toBe(false);
    });

    test('accepts phone in +91XXXXXXXXXX format', () => {
      const result = builderRegistrationSchema.safeParse({
        ...validRegistration,
        contactPhone: '+919876543210',
      });
      expect(result.success).toBe(true);
    });

    test('rejects phone without +91 prefix', () => {
      const result = builderRegistrationSchema.safeParse({
        ...validRegistration,
        contactPhone: '9876543210',
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid cityId (not UUID)', () => {
      const result = builderRegistrationSchema.safeParse({
        ...validRegistration,
        cityId: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid email format', () => {
      const result = builderRegistrationSchema.safeParse({
        ...validRegistration,
        contactEmail: 'not-an-email',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // builderApprovalSchema
  // ============================================================

  describe('builderApprovalSchema', () => {
    test('accepts approve action', () => {
      const result = builderApprovalSchema.safeParse({
        builderId: VALID_UUID,
        action: 'approve',
      });
      expect(result.success).toBe(true);
    });

    test('accepts reject action with notes', () => {
      const result = builderApprovalSchema.safeParse({
        builderId: VALID_UUID,
        action: 'reject',
        notes: 'Documents are not valid.',
      });
      expect(result.success).toBe(true);
    });

    test('rejects invalid action', () => {
      const result = builderApprovalSchema.safeParse({
        builderId: VALID_UUID,
        action: 'pending',
      });
      expect(result.success).toBe(false);
    });

    test('rejects non-UUID builderId', () => {
      const result = builderApprovalSchema.safeParse({
        builderId: 'not-uuid',
        action: 'approve',
      });
      expect(result.success).toBe(false);
    });

    test('rejects notes exceeding 1000 characters', () => {
      const result = builderApprovalSchema.safeParse({
        builderId: VALID_UUID,
        action: 'reject',
        notes: 'a'.repeat(1001),
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // projectCreateSchema
  // ============================================================

  describe('projectCreateSchema', () => {
    const validProject = {
      name: 'Green Valley Phase 1',
      totalUnits: 100,
      location: 'Sector 5, Lucknow, UP',
      projectType: 'RESIDENTIAL' as const,
      cityId: VALID_UUID,
    };

    test('accepts valid project', () => {
      const result = projectCreateSchema.safeParse(validProject);
      expect(result.success).toBe(true);
    });

    test('accepts all project types', () => {
      const types = ['RESIDENTIAL', 'COMMERCIAL', 'MIXED'] as const;
      for (const projectType of types) {
        const result = projectCreateSchema.safeParse({ ...validProject, projectType });
        expect(result.success).toBe(true);
      }
    });

    test('rejects invalid projectType', () => {
      const result = projectCreateSchema.safeParse({
        ...validProject,
        projectType: 'INDUSTRIAL',
      });
      expect(result.success).toBe(false);
    });

    test('rejects totalUnits of 0', () => {
      const result = projectCreateSchema.safeParse({
        ...validProject,
        totalUnits: 0,
      });
      expect(result.success).toBe(false);
    });

    test('rejects totalUnits exceeding 2000', () => {
      const result = projectCreateSchema.safeParse({
        ...validProject,
        totalUnits: 2001,
      });
      expect(result.success).toBe(false);
    });

    test('rejects location shorter than 5 characters', () => {
      const result = projectCreateSchema.safeParse({
        ...validProject,
        location: 'LKO',
      });
      expect(result.success).toBe(false);
    });

    test('rejects name shorter than 2 characters', () => {
      const result = projectCreateSchema.safeParse({
        ...validProject,
        name: 'A',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // unitCreateSchema
  // ============================================================

  describe('unitCreateSchema', () => {
    const validUnit = {
      unitNumber: 'A-101',
      buyerName: 'Priya Singh',
      buyerPhone: '+919876543210',
    };

    test('accepts valid unit', () => {
      const result = unitCreateSchema.safeParse(validUnit);
      expect(result.success).toBe(true);
    });

    test('accepts with optional buyerEmail', () => {
      const result = unitCreateSchema.safeParse({
        ...validUnit,
        buyerEmail: 'priya@example.com',
      });
      expect(result.success).toBe(true);
    });

    test('rejects invalid phone format', () => {
      const result = unitCreateSchema.safeParse({
        ...validUnit,
        buyerPhone: '9876543210',
      });
      expect(result.success).toBe(false);
    });

    test('rejects buyerName shorter than 2 characters', () => {
      const result = unitCreateSchema.safeParse({
        ...validUnit,
        buyerName: 'A',
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid email', () => {
      const result = unitCreateSchema.safeParse({
        ...validUnit,
        buyerEmail: 'not-email',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // bulkServiceRequestSchema
  // ============================================================

  describe('bulkServiceRequestSchema', () => {
    test('accepts allUnits=true with service IDs', () => {
      const result = bulkServiceRequestSchema.safeParse({
        serviceIds: [VALID_UUID],
        allUnits: true,
      });
      expect(result.success).toBe(true);
    });

    test('accepts specific unitIds', () => {
      const result = bulkServiceRequestSchema.safeParse({
        serviceIds: [VALID_UUID],
        unitIds: [VALID_UUID],
        allUnits: false,
      });
      expect(result.success).toBe(true);
    });

    test('rejects when neither allUnits nor unitIds provided', () => {
      const result = bulkServiceRequestSchema.safeParse({
        serviceIds: [VALID_UUID],
      });
      expect(result.success).toBe(false);
    });

    test('rejects empty serviceIds array', () => {
      const result = bulkServiceRequestSchema.safeParse({
        serviceIds: [],
        allUnits: true,
      });
      expect(result.success).toBe(false);
    });

    test('rejects non-UUID serviceIds', () => {
      const result = bulkServiceRequestSchema.safeParse({
        serviceIds: ['not-a-uuid'],
        allUnits: true,
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // pricingOverrideSchema
  // ============================================================

  describe('pricingOverrideSchema', () => {
    test('accepts valid discount percentage', () => {
      const result = pricingOverrideSchema.safeParse({ discountPct: 20 });
      expect(result.success).toBe(true);
    });

    test('accepts 0% discount', () => {
      const result = pricingOverrideSchema.safeParse({ discountPct: 0 });
      expect(result.success).toBe(true);
    });

    test('accepts 50% (max) discount', () => {
      const result = pricingOverrideSchema.safeParse({ discountPct: 50 });
      expect(result.success).toBe(true);
    });

    test('rejects discount above 50%', () => {
      const result = pricingOverrideSchema.safeParse({ discountPct: 51 });
      expect(result.success).toBe(false);
    });

    test('rejects negative discount', () => {
      const result = pricingOverrideSchema.safeParse({ discountPct: -1 });
      expect(result.success).toBe(false);
    });

    test('rejects decimal discount (must be integer)', () => {
      const result = pricingOverrideSchema.safeParse({ discountPct: 10.5 });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // contractCreateSchema
  // ============================================================

  describe('contractCreateSchema', () => {
    const validFrom = '2025-01-01T00:00:00.000Z';
    const validTo = '2025-12-31T23:59:59.000Z';

    test('accepts valid contract', () => {
      const result = contractCreateSchema.safeParse({
        serviceIds: [VALID_UUID],
        unitCount: 50,
        discountPct: 10,
        validFrom,
        validTo,
      });
      expect(result.success).toBe(true);
    });

    test('rejects when validTo is before validFrom', () => {
      const result = contractCreateSchema.safeParse({
        serviceIds: [VALID_UUID],
        unitCount: 50,
        discountPct: 10,
        validFrom: validTo,
        validTo: validFrom,
      });
      expect(result.success).toBe(false);
    });

    test('rejects empty serviceIds', () => {
      const result = contractCreateSchema.safeParse({
        serviceIds: [],
        unitCount: 50,
        discountPct: 10,
        validFrom,
        validTo,
      });
      expect(result.success).toBe(false);
    });

    test('rejects unitCount exceeding 2000', () => {
      const result = contractCreateSchema.safeParse({
        serviceIds: [VALID_UUID],
        unitCount: 2001,
        discountPct: 10,
        validFrom,
        validTo,
      });
      expect(result.success).toBe(false);
    });

    test('defaults autoRenew to true', () => {
      const result = contractCreateSchema.safeParse({
        serviceIds: [VALID_UUID],
        unitCount: 50,
        discountPct: 10,
        validFrom,
        validTo,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.autoRenew).toBe(true);
      }
    });
  });

  // ============================================================
  // broadcastCreateSchema
  // ============================================================

  describe('broadcastCreateSchema', () => {
    test('accepts valid broadcast', () => {
      const result = broadcastCreateSchema.safeParse({
        message: 'Important update for your service.',
        recipientFilter: { allUnits: true },
      });
      expect(result.success).toBe(true);
    });

    test('accepts without recipientFilter (defaults to allUnits)', () => {
      const result = broadcastCreateSchema.safeParse({
        message: 'Hello everyone.',
      });
      expect(result.success).toBe(true);
    });

    test('rejects empty message', () => {
      const result = broadcastCreateSchema.safeParse({ message: '' });
      expect(result.success).toBe(false);
    });

    test('rejects message exceeding 500 characters', () => {
      const result = broadcastCreateSchema.safeParse({
        message: 'a'.repeat(501),
      });
      expect(result.success).toBe(false);
    });

    test('accepts recipientFilter with serviceId UUID', () => {
      const result = broadcastCreateSchema.safeParse({
        message: 'Update for specific service.',
        recipientFilter: { serviceId: VALID_UUID },
      });
      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // contractAmendmentSchema
  // ============================================================

  describe('contractAmendmentSchema', () => {
    test('accepts valid amendment notes', () => {
      const result = contractAmendmentSchema.safeParse({
        amendmentNotes: 'Extending validity by 6 months due to project delays.',
      });
      expect(result.success).toBe(true);
    });

    test('rejects notes shorter than 10 characters', () => {
      const result = contractAmendmentSchema.safeParse({
        amendmentNotes: 'Short',
      });
      expect(result.success).toBe(false);
    });

    test('rejects notes exceeding 2000 characters', () => {
      const result = contractAmendmentSchema.safeParse({
        amendmentNotes: 'a'.repeat(2001),
      });
      expect(result.success).toBe(false);
    });
  });
});
