/**
 * Tests for auth validation schemas (Zod).
 * Covers registerSchema, setRoleSchema, updateStatusSchema, refreshClaimsSchema.
 */
import { describe, test, expect } from 'vitest';
import {
  registerSchema,
  setRoleSchema,
  updateStatusSchema,
  refreshClaimsSchema,
} from '../auth.validation';

describe('Auth Validation Schemas', () => {
  // ============================================================
  // registerSchema
  // ============================================================

  describe('registerSchema', () => {
    test('accepts valid registration input', () => {
      const result = registerSchema.safeParse({
        phone: '9876543210',
        firebaseUid: 'fb-uid-001',
        displayName: 'Test User',
        languagePref: 'en',
      });

      expect(result.success).toBe(true);
    });

    test('accepts registration with minimal required fields', () => {
      const result = registerSchema.safeParse({
        phone: '9876543210',
        firebaseUid: 'fb-uid-002',
      });

      expect(result.success).toBe(true);
    });

    test('rejects phone with less than 10 digits', () => {
      const result = registerSchema.safeParse({
        phone: '12345',
        firebaseUid: 'fb-uid-003',
      });

      expect(result.success).toBe(false);
    });

    test('rejects phone with more than 10 digits', () => {
      const result = registerSchema.safeParse({
        phone: '12345678901',
        firebaseUid: 'fb-uid-004',
      });

      expect(result.success).toBe(false);
    });

    test('rejects phone with non-numeric characters', () => {
      const result = registerSchema.safeParse({
        phone: 'abcdefghij',
        firebaseUid: 'fb-uid-005',
      });

      expect(result.success).toBe(false);
    });

    test('rejects empty firebaseUid', () => {
      const result = registerSchema.safeParse({
        phone: '9876543210',
        firebaseUid: '',
      });

      expect(result.success).toBe(false);
    });

    test('rejects missing firebaseUid', () => {
      const result = registerSchema.safeParse({
        phone: '9876543210',
      });

      expect(result.success).toBe(false);
    });

    test('rejects invalid languagePref', () => {
      const result = registerSchema.safeParse({
        phone: '9876543210',
        firebaseUid: 'fb-uid-006',
        languagePref: 'fr', // not 'en' or 'hi'
      });

      expect(result.success).toBe(false);
    });

    test('accepts displayName as optional', () => {
      const result = registerSchema.safeParse({
        phone: '9876543210',
        firebaseUid: 'fb-uid-007',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.displayName).toBeUndefined();
      }
    });

    test('rejects displayName exceeding 100 characters', () => {
      const result = registerSchema.safeParse({
        phone: '9876543210',
        firebaseUid: 'fb-uid-008',
        displayName: 'A'.repeat(101),
      });

      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // setRoleSchema
  // ============================================================

  describe('setRoleSchema', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    test('accepts valid set-role input', () => {
      const result = setRoleSchema.safeParse({
        userId: validUuid,
        roles: ['agent'],
      });

      expect(result.success).toBe(true);
    });

    test('accepts multiple roles', () => {
      const result = setRoleSchema.safeParse({
        userId: validUuid,
        roles: ['agent', 'dealer', 'customer'],
      });

      expect(result.success).toBe(true);
    });

    test('accepts optional cityId and primaryRole', () => {
      const result = setRoleSchema.safeParse({
        userId: validUuid,
        roles: ['agent'],
        cityId: validUuid,
        primaryRole: 'agent',
      });

      expect(result.success).toBe(true);
    });

    test('rejects empty roles array', () => {
      const result = setRoleSchema.safeParse({
        userId: validUuid,
        roles: [],
      });

      expect(result.success).toBe(false);
    });

    test('rejects invalid role values', () => {
      const result = setRoleSchema.safeParse({
        userId: validUuid,
        roles: ['invalid_role'],
      });

      expect(result.success).toBe(false);
    });

    test('rejects invalid userId (not UUID)', () => {
      const result = setRoleSchema.safeParse({
        userId: 'not-a-uuid',
        roles: ['agent'],
      });

      expect(result.success).toBe(false);
    });

    test('rejects invalid cityId (not UUID)', () => {
      const result = setRoleSchema.safeParse({
        userId: validUuid,
        roles: ['agent'],
        cityId: 'not-a-uuid',
      });

      expect(result.success).toBe(false);
    });

    test('accepts all valid role types', () => {
      const validRoles = [
        'customer', 'agent', 'dealer', 'ops', 'builder',
        'lawyer', 'franchise_owner', 'super_admin', 'support',
      ];

      for (const role of validRoles) {
        const result = setRoleSchema.safeParse({
          userId: validUuid,
          roles: [role],
        });
        expect(result.success).toBe(true);
      }
    });

    test('rejects more than 9 roles', () => {
      const result = setRoleSchema.safeParse({
        userId: validUuid,
        roles: ['customer', 'agent', 'dealer', 'ops', 'builder',
                'lawyer', 'franchise_owner', 'super_admin', 'support', 'customer'],
      });

      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // updateStatusSchema
  // ============================================================

  describe('updateStatusSchema', () => {
    const validUuid = '550e8400-e29b-41d4-a716-446655440000';

    test('accepts valid status update', () => {
      const result = updateStatusSchema.safeParse({
        userId: validUuid,
        status: 'SUSPENDED',
      });

      expect(result.success).toBe(true);
    });

    test('accepts all valid status values', () => {
      const statuses = ['ACTIVE', 'PENDING_ROLE', 'PENDING_APPROVAL', 'SUSPENDED', 'DEACTIVATED'];

      for (const status of statuses) {
        const result = updateStatusSchema.safeParse({
          userId: validUuid,
          status,
        });
        expect(result.success).toBe(true);
      }
    });

    test('rejects invalid status', () => {
      const result = updateStatusSchema.safeParse({
        userId: validUuid,
        status: 'INVALID',
      });

      expect(result.success).toBe(false);
    });

    test('rejects missing userId', () => {
      const result = updateStatusSchema.safeParse({
        status: 'ACTIVE',
      });

      expect(result.success).toBe(false);
    });

    test('rejects missing status', () => {
      const result = updateStatusSchema.safeParse({
        userId: validUuid,
      });

      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // refreshClaimsSchema
  // ============================================================

  describe('refreshClaimsSchema', () => {
    test('accepts valid UUID', () => {
      const result = refreshClaimsSchema.safeParse({
        userId: '550e8400-e29b-41d4-a716-446655440000',
      });

      expect(result.success).toBe(true);
    });

    test('rejects non-UUID string', () => {
      const result = refreshClaimsSchema.safeParse({
        userId: 'not-a-uuid',
      });

      expect(result.success).toBe(false);
    });

    test('rejects missing userId', () => {
      const result = refreshClaimsSchema.safeParse({});

      expect(result.success).toBe(false);
    });

    test('rejects empty string', () => {
      const result = refreshClaimsSchema.safeParse({
        userId: '',
      });

      expect(result.success).toBe(false);
    });
  });
});
