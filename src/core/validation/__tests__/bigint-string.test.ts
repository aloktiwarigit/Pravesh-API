/**
 * Tests for BigInt string Zod validation schemas.
 */
import { describe, test, expect } from 'vitest';
import {
  bigIntStringSchema,
  positiveBigIntStringSchema,
  rupeesInputSchema,
} from '../bigint-string';

describe('BigInt String Validation Schemas', () => {
  // ============================================================
  // bigIntStringSchema
  // ============================================================

  describe('bigIntStringSchema', () => {
    test('accepts valid non-negative integer string', () => {
      expect(bigIntStringSchema.safeParse('100000').success).toBe(true);
    });

    test('accepts zero', () => {
      expect(bigIntStringSchema.safeParse('0').success).toBe(true);
    });

    test('accepts large values', () => {
      expect(bigIntStringSchema.safeParse('99999999999999999999').success).toBe(true);
    });

    test('rejects negative values', () => {
      expect(bigIntStringSchema.safeParse('-100').success).toBe(false);
    });

    test('rejects non-numeric strings', () => {
      expect(bigIntStringSchema.safeParse('abc').success).toBe(false);
    });

    test('rejects floating point strings', () => {
      expect(bigIntStringSchema.safeParse('100.50').success).toBe(false);
    });

    test('accepts empty string (BigInt("") === 0n in Node 22+)', () => {
      expect(bigIntStringSchema.safeParse('').success).toBe(true);
    });

    test('rejects non-string types', () => {
      expect(bigIntStringSchema.safeParse(100).success).toBe(false);
      expect(bigIntStringSchema.safeParse(null).success).toBe(false);
      expect(bigIntStringSchema.safeParse(undefined).success).toBe(false);
    });
  });

  // ============================================================
  // positiveBigIntStringSchema
  // ============================================================

  describe('positiveBigIntStringSchema', () => {
    test('accepts positive integer string', () => {
      expect(positiveBigIntStringSchema.safeParse('100').success).toBe(true);
    });

    test('accepts large positive values', () => {
      expect(positiveBigIntStringSchema.safeParse('99999999999999999999').success).toBe(true);
    });

    test('rejects zero', () => {
      expect(positiveBigIntStringSchema.safeParse('0').success).toBe(false);
    });

    test('rejects negative values', () => {
      expect(positiveBigIntStringSchema.safeParse('-1').success).toBe(false);
    });

    test('rejects non-numeric strings', () => {
      expect(positiveBigIntStringSchema.safeParse('abc').success).toBe(false);
    });

    test('rejects empty string', () => {
      expect(positiveBigIntStringSchema.safeParse('').success).toBe(false);
    });
  });

  // ============================================================
  // rupeesInputSchema
  // ============================================================

  describe('rupeesInputSchema', () => {
    test('accepts positive numbers', () => {
      expect(rupeesInputSchema.safeParse(100).success).toBe(true);
    });

    test('accepts decimal amounts', () => {
      expect(rupeesInputSchema.safeParse(99.99).success).toBe(true);
    });

    test('accepts small positive amounts', () => {
      expect(rupeesInputSchema.safeParse(0.01).success).toBe(true);
    });

    test('rejects zero', () => {
      expect(rupeesInputSchema.safeParse(0).success).toBe(false);
    });

    test('rejects negative amounts', () => {
      expect(rupeesInputSchema.safeParse(-100).success).toBe(false);
    });

    test('rejects Infinity', () => {
      expect(rupeesInputSchema.safeParse(Infinity).success).toBe(false);
    });

    test('rejects -Infinity', () => {
      expect(rupeesInputSchema.safeParse(-Infinity).success).toBe(false);
    });

    test('rejects NaN', () => {
      expect(rupeesInputSchema.safeParse(NaN).success).toBe(false);
    });

    test('rejects string input', () => {
      expect(rupeesInputSchema.safeParse('100').success).toBe(false);
    });
  });
});
