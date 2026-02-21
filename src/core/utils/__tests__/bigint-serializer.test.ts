/**
 * Tests for BigInt serialization utilities.
 */
import { describe, test, expect } from 'vitest';
import {
  serializeBigInt,
  parseBigIntString,
  rupeesToPaise,
  paiseToRazorpayAmount,
} from '../bigint-serializer';

describe('BigInt Serializer Utilities', () => {
  // ============================================================
  // serializeBigInt
  // ============================================================

  describe('serializeBigInt', () => {
    test('converts BigInt values to strings', () => {
      const input = { amount: 100000n, name: 'Test' };
      const result = serializeBigInt(input);

      expect(result.amount).toBe('100000');
      expect(result.name).toBe('Test');
    });

    test('handles nested objects with BigInt values', () => {
      const input = {
        payment: {
          amountPaise: 50000n,
          currency: 'INR',
        },
      };
      const result = serializeBigInt(input);

      expect((result.payment as any).amountPaise).toBe('50000');
      expect((result.payment as any).currency).toBe('INR');
    });

    test('handles arrays with BigInt values', () => {
      const input = {
        amounts: [100n, 200n, 300n],
      };
      const result = serializeBigInt(input);

      expect(result.amounts).toEqual(['100', '200', '300']);
    });

    test('handles arrays of objects with BigInt values', () => {
      const input = {
        items: [
          { id: 1, amountPaise: 1000n },
          { id: 2, amountPaise: 2000n },
        ],
      };
      const result = serializeBigInt(input);

      expect((result.items as any)[0].amountPaise).toBe('1000');
      expect((result.items as any)[1].amountPaise).toBe('2000');
    });

    test('preserves non-BigInt values', () => {
      const input = {
        name: 'Test',
        count: 42,
        active: true,
        tags: ['a', 'b'],
        nullVal: null,
      };
      const result = serializeBigInt(input);

      expect(result.name).toBe('Test');
      expect(result.count).toBe(42);
      expect(result.active).toBe(true);
      expect(result.tags).toEqual(['a', 'b']);
      expect(result.nullVal).toBeNull();
    });

    test('handles empty object', () => {
      const result = serializeBigInt({});

      expect(result).toEqual({});
    });

    test('handles deeply nested BigInt values', () => {
      const input = {
        level1: {
          level2: {
            level3: {
              amount: 999n,
            },
          },
        },
      };
      const result = serializeBigInt(input);

      expect((result.level1 as any).level2.level3.amount).toBe('999');
    });

    test('handles zero BigInt', () => {
      const input = { amount: 0n };
      const result = serializeBigInt(input);

      expect(result.amount).toBe('0');
    });

    test('handles very large BigInt values', () => {
      const large = BigInt('99999999999999999999');
      const input = { amount: large };
      const result = serializeBigInt(input);

      expect(result.amount).toBe('99999999999999999999');
    });
  });

  // ============================================================
  // parseBigIntString
  // ============================================================

  describe('parseBigIntString', () => {
    test('parses valid non-negative integer string', () => {
      const result = parseBigIntString('100000', 'amount');

      expect(result).toBe(100000n);
    });

    test('parses zero', () => {
      const result = parseBigIntString('0', 'amount');

      expect(result).toBe(0n);
    });

    test('parses large values', () => {
      const result = parseBigIntString('99999999999999999999', 'amount');

      expect(result).toBe(BigInt('99999999999999999999'));
    });

    test('throws for negative values', () => {
      expect(() => parseBigIntString('-100', 'amount')).toThrow(
        'amount must be a valid non-negative integer string',
      );
    });

    test('throws for non-numeric strings', () => {
      expect(() => parseBigIntString('abc', 'amount')).toThrow(
        'amount must be a valid non-negative integer string',
      );
    });

    test('throws for floating point strings', () => {
      expect(() => parseBigIntString('100.50', 'amount')).toThrow(
        'amount must be a valid non-negative integer string',
      );
    });

    test('returns 0n for empty string (BigInt("") === 0n in Node 22+)', () => {
      expect(parseBigIntString('', 'amount')).toBe(0n);
    });

    test('includes field name in error message', () => {
      expect(() => parseBigIntString('abc', 'serviceFeePaise')).toThrow(
        'serviceFeePaise',
      );
    });
  });

  // ============================================================
  // rupeesToPaise (BigInt version)
  // ============================================================

  describe('rupeesToPaise', () => {
    test('converts whole rupees to paise', () => {
      expect(rupeesToPaise(100)).toBe(10000n);
    });

    test('converts rupees with paise', () => {
      expect(rupeesToPaise(99.99)).toBe(9999n);
    });

    test('converts zero', () => {
      expect(rupeesToPaise(0)).toBe(0n);
    });

    test('rounds floating point correctly', () => {
      // 10.005 * 100 = 1000.5 -> rounds to 1001
      expect(rupeesToPaise(10.005)).toBe(1001n);
    });

    test('returns BigInt type', () => {
      const result = rupeesToPaise(500);
      expect(typeof result).toBe('bigint');
    });
  });

  // ============================================================
  // paiseToRazorpayAmount
  // ============================================================

  describe('paiseToRazorpayAmount', () => {
    test('converts BigInt paise to number', () => {
      const result = paiseToRazorpayAmount(50000n);

      expect(result).toBe(50000);
      expect(typeof result).toBe('number');
    });

    test('converts zero', () => {
      expect(paiseToRazorpayAmount(0n)).toBe(0);
    });

    test('throws for amounts exceeding MAX_SAFE_INTEGER', () => {
      const tooLarge = BigInt(Number.MAX_SAFE_INTEGER) + 1n;

      expect(() => paiseToRazorpayAmount(tooLarge)).toThrow(
        'Amount exceeds safe integer range for Razorpay',
      );
    });

    test('handles MAX_SAFE_INTEGER exactly', () => {
      const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);

      // Should not throw
      const result = paiseToRazorpayAmount(maxSafe);
      expect(result).toBe(Number.MAX_SAFE_INTEGER);
    });
  });
});
