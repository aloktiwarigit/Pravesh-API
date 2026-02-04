/**
 * Zod validators for BigInt string fields.
 * All monetary values are transmitted as JSON strings and validated here.
 *
 * Story 4.14: Money Storage as Paise Integers
 */
import { z } from 'zod';

/**
 * Zod schema for BigInt string fields.
 * Validates that the string is a valid non-negative integer.
 * Use this for ALL monetary fields in request/response schemas.
 */
export const bigIntStringSchema = z
  .string()
  .refine(
    (val) => {
      try {
        return BigInt(val) >= 0n;
      } catch {
        return false;
      }
    },
    { message: 'Must be a valid non-negative integer string' },
  );

/**
 * Zod schema for positive BigInt string fields (amount > 0).
 */
export const positiveBigIntStringSchema = z
  .string()
  .refine(
    (val) => {
      try {
        return BigInt(val) > 0n;
      } catch {
        return false;
      }
    },
    { message: 'Must be a valid positive integer string' },
  );

/**
 * Zod schema for rupees input from customer (converted to paise at API boundary).
 * Accepts a number, validates it is positive, returns as-is for conversion layer.
 */
export const rupeesInputSchema = z
  .number()
  .positive('Amount must be positive')
  .finite('Amount must be finite');
