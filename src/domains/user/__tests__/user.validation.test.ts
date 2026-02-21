/**
 * Tests for user validation schemas (Zod).
 * Covers updateProfileSchema and userSearchSchema.
 */
import { describe, test, expect } from 'vitest';
import { updateProfileSchema, userSearchSchema } from '../user.validation';

describe('User Validation Schemas', () => {
  // ============================================================
  // updateProfileSchema
  // ============================================================

  describe('updateProfileSchema', () => {
    test('accepts valid profile update with all fields', () => {
      const result = updateProfileSchema.safeParse({
        displayName: 'Test User',
        email: 'test@example.com',
        languagePref: 'en',
        profileData: { address: '123 Main St' },
      });

      expect(result.success).toBe(true);
    });

    test('accepts empty object (all fields optional)', () => {
      const result = updateProfileSchema.safeParse({});

      expect(result.success).toBe(true);
    });

    test('accepts displayName only', () => {
      const result = updateProfileSchema.safeParse({
        displayName: 'Just Name',
      });

      expect(result.success).toBe(true);
    });

    test('rejects empty displayName', () => {
      const result = updateProfileSchema.safeParse({
        displayName: '',
      });

      expect(result.success).toBe(false);
    });

    test('rejects displayName exceeding 100 characters', () => {
      const result = updateProfileSchema.safeParse({
        displayName: 'A'.repeat(101),
      });

      expect(result.success).toBe(false);
    });

    test('rejects invalid email format', () => {
      const result = updateProfileSchema.safeParse({
        email: 'not-an-email',
      });

      expect(result.success).toBe(false);
    });

    test('accepts valid email', () => {
      const result = updateProfileSchema.safeParse({
        email: 'user@example.com',
      });

      expect(result.success).toBe(true);
    });

    test('rejects invalid languagePref', () => {
      const result = updateProfileSchema.safeParse({
        languagePref: 'fr',
      });

      expect(result.success).toBe(false);
    });

    test('accepts "en" and "hi" as languagePref', () => {
      expect(updateProfileSchema.safeParse({ languagePref: 'en' }).success).toBe(true);
      expect(updateProfileSchema.safeParse({ languagePref: 'hi' }).success).toBe(true);
    });

    test('accepts profileData as arbitrary record', () => {
      const result = updateProfileSchema.safeParse({
        profileData: {
          address: '123 Main St',
          pincode: 226001,
          nested: { key: 'value' },
        },
      });

      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // userSearchSchema
  // ============================================================

  describe('userSearchSchema', () => {
    test('accepts empty query params (all optional with defaults)', () => {
      const result = userSearchSchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(20);
      }
    });

    test('accepts all filter fields', () => {
      const result = userSearchSchema.safeParse({
        query: 'john',
        role: 'agent',
        status: 'ACTIVE',
        cityId: '550e8400-e29b-41d4-a716-446655440000',
        page: '2',
        limit: '10',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(10);
      }
    });

    test('coerces string page and limit to numbers', () => {
      const result = userSearchSchema.safeParse({
        page: '5',
        limit: '50',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(5);
        expect(result.data.limit).toBe(50);
      }
    });

    test('rejects page less than 1', () => {
      const result = userSearchSchema.safeParse({
        page: '0',
      });

      expect(result.success).toBe(false);
    });

    test('rejects limit less than 1', () => {
      const result = userSearchSchema.safeParse({
        limit: '0',
      });

      expect(result.success).toBe(false);
    });

    test('rejects limit greater than 100', () => {
      const result = userSearchSchema.safeParse({
        limit: '101',
      });

      expect(result.success).toBe(false);
    });

    test('rejects invalid cityId (not UUID)', () => {
      const result = userSearchSchema.safeParse({
        cityId: 'not-a-uuid',
      });

      expect(result.success).toBe(false);
    });

    test('rejects query exceeding 100 characters', () => {
      const result = userSearchSchema.safeParse({
        query: 'A'.repeat(101),
      });

      expect(result.success).toBe(false);
    });

    test('rejects role exceeding 50 characters', () => {
      const result = userSearchSchema.safeParse({
        role: 'A'.repeat(51),
      });

      expect(result.success).toBe(false);
    });
  });
});
