/**
 * Tests for date utilities.
 */
import { describe, test, expect, vi, afterEach } from 'vitest';
import {
  getCurrentMonth,
  getMonthRange,
  isDateInFuture,
  toISO,
} from '../date';

describe('Date Utilities', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  // ============================================================
  // getCurrentMonth
  // ============================================================

  describe('getCurrentMonth', () => {
    test('returns current month in YYYY-MM format', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 5, 15)); // June 2025

      const result = getCurrentMonth();

      expect(result).toBe('2025-06');
    });

    test('pads single-digit months with leading zero', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 0, 1)); // January 2025

      const result = getCurrentMonth();

      expect(result).toBe('2025-01');
    });

    test('handles December correctly', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2025, 11, 31)); // December 2025

      const result = getCurrentMonth();

      expect(result).toBe('2025-12');
    });
  });

  // ============================================================
  // getMonthRange
  // ============================================================

  describe('getMonthRange', () => {
    test('returns start and end of given month', () => {
      const result = getMonthRange('2025-06');

      expect(result.start).toEqual(new Date(2025, 5, 1));
      // End should be last day of June
      expect(result.end.getMonth()).toBe(5); // June
      expect(result.end.getDate()).toBe(30); // June has 30 days
    });

    test('handles January correctly', () => {
      const result = getMonthRange('2025-01');

      expect(result.start).toEqual(new Date(2025, 0, 1));
      expect(result.end.getDate()).toBe(31); // January has 31 days
    });

    test('handles February in non-leap year', () => {
      const result = getMonthRange('2025-02');

      expect(result.start).toEqual(new Date(2025, 1, 1));
      expect(result.end.getDate()).toBe(28); // 2025 is not a leap year
    });

    test('handles February in leap year', () => {
      const result = getMonthRange('2024-02');

      expect(result.start).toEqual(new Date(2024, 1, 1));
      expect(result.end.getDate()).toBe(29); // 2024 is a leap year
    });

    test('end date has time set to end of day', () => {
      const result = getMonthRange('2025-06');

      expect(result.end.getHours()).toBe(23);
      expect(result.end.getMinutes()).toBe(59);
      expect(result.end.getSeconds()).toBe(59);
    });

    test('start date is beginning of month', () => {
      const result = getMonthRange('2025-06');

      expect(result.start.getDate()).toBe(1);
      expect(result.start.getHours()).toBe(0);
      expect(result.start.getMinutes()).toBe(0);
    });
  });

  // ============================================================
  // isDateInFuture
  // ============================================================

  describe('isDateInFuture', () => {
    test('returns true for future date', () => {
      const futureDate = new Date(Date.now() + 86400000); // +1 day
      expect(isDateInFuture(futureDate)).toBe(true);
    });

    test('returns false for past date', () => {
      const pastDate = new Date(Date.now() - 86400000); // -1 day
      expect(isDateInFuture(pastDate)).toBe(false);
    });

    test('returns false for current date (effectively past by execution time)', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-06-15T12:00:00Z'));

      expect(isDateInFuture('2025-06-15T12:00:00Z')).toBe(false);
    });

    test('accepts string date format', () => {
      const futureDate = '2099-12-31T23:59:59Z';
      expect(isDateInFuture(futureDate)).toBe(true);
    });

    test('accepts Date object', () => {
      const futureDate = new Date('2099-12-31');
      expect(isDateInFuture(futureDate)).toBe(true);
    });
  });

  // ============================================================
  // toISO
  // ============================================================

  describe('toISO', () => {
    test('converts Date to ISO string', () => {
      const date = new Date('2025-06-15T12:30:00Z');
      const result = toISO(date);

      expect(result).toBe('2025-06-15T12:30:00.000Z');
    });

    test('returns string type', () => {
      const result = toISO(new Date());
      expect(typeof result).toBe('string');
    });

    test('output can be parsed back to equivalent Date', () => {
      const original = new Date('2025-01-01T00:00:00Z');
      const iso = toISO(original);
      const parsed = new Date(iso);

      expect(parsed.getTime()).toBe(original.getTime());
    });
  });
});
