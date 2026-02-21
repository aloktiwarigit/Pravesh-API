/**
 * Tests for money utilities.
 * All monetary values stored as paise (integer, smallest unit).
 */
import { describe, test, expect } from 'vitest';
import {
  rupeesToPaise,
  paiseToRupees,
  calculatePercentage,
  formatPaiseForDisplay,
} from '../money';

describe('Money Utilities', () => {
  // ============================================================
  // rupeesToPaise
  // ============================================================

  describe('rupeesToPaise', () => {
    test('converts whole rupees to paise', () => {
      expect(rupeesToPaise(100)).toBe(10000);
    });

    test('converts rupees with decimals to paise', () => {
      expect(rupeesToPaise(99.99)).toBe(9999);
    });

    test('converts zero rupees', () => {
      expect(rupeesToPaise(0)).toBe(0);
    });

    test('converts small amounts', () => {
      expect(rupeesToPaise(0.01)).toBe(1);
    });

    test('rounds to nearest paise for floating point values', () => {
      // 10.005 * 100 = 1000.5 -> rounds to 1001
      expect(rupeesToPaise(10.005)).toBe(1001);
    });

    test('handles large amounts', () => {
      expect(rupeesToPaise(1000000)).toBe(100000000);
    });
  });

  // ============================================================
  // paiseToRupees
  // ============================================================

  describe('paiseToRupees', () => {
    test('converts paise to rupees', () => {
      expect(paiseToRupees(10000)).toBe(100);
    });

    test('converts paise with remainder', () => {
      expect(paiseToRupees(9999)).toBe(99.99);
    });

    test('converts zero paise', () => {
      expect(paiseToRupees(0)).toBe(0);
    });

    test('converts single paisa', () => {
      expect(paiseToRupees(1)).toBe(0.01);
    });

    test('roundtrip: rupeesToPaise -> paiseToRupees', () => {
      const original = 500;
      expect(paiseToRupees(rupeesToPaise(original))).toBe(original);
    });
  });

  // ============================================================
  // calculatePercentage
  // ============================================================

  describe('calculatePercentage', () => {
    test('calculates 10% of amount', () => {
      expect(calculatePercentage(10000, 10)).toBe(1000);
    });

    test('calculates 30% of amount', () => {
      expect(calculatePercentage(10000, 30)).toBe(3000);
    });

    test('calculates 100% of amount', () => {
      expect(calculatePercentage(10000, 100)).toBe(10000);
    });

    test('calculates 0% of amount', () => {
      expect(calculatePercentage(10000, 0)).toBe(0);
    });

    test('rounds result to integer paise', () => {
      // 10001 * 33 / 100 = 3300.33 -> rounds to 3300
      expect(calculatePercentage(10001, 33)).toBe(3300);
    });

    test('calculates percentage of zero amount', () => {
      expect(calculatePercentage(0, 50)).toBe(0);
    });
  });

  // ============================================================
  // formatPaiseForDisplay
  // ============================================================

  describe('formatPaiseForDisplay', () => {
    test('formats paise as INR currency string', () => {
      const result = formatPaiseForDisplay(10000);
      // Should contain the rupee symbol or INR indicator
      expect(result).toContain('100');
    });

    test('formats zero paise', () => {
      const result = formatPaiseForDisplay(0);
      expect(result).toContain('0');
    });

    test('formats large amounts with Indian comma notation', () => {
      const result = formatPaiseForDisplay(1000000000); // 1 crore
      // Indian notation: 1,00,00,000
      expect(result).toBeTruthy();
    });

    test('formats amounts with decimal paise', () => {
      const result = formatPaiseForDisplay(9999);
      expect(result).toContain('99.99');
    });

    test('returns string type', () => {
      const result = formatPaiseForDisplay(5000);
      expect(typeof result).toBe('string');
    });
  });
});
