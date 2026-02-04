/**
 * BigInt serialization utilities for the Property Legal Agent API.
 * All monetary values are stored as BigInt paise (1 INR = 100 paise).
 * This module provides the ONLY approved conversion functions.
 *
 * Story 4.14: Money Storage as Paise Integers
 */

/**
 * Serializes an object containing BigInt values to JSON-safe format.
 * BigInt values are converted to strings.
 * This is the ONLY approved way to serialize BigInt for API responses.
 */
export function serializeBigInt<T extends Record<string, unknown>>(
  obj: T,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'bigint') {
      result[key] = value.toString();
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = serializeBigInt(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'bigint'
          ? item.toString()
          : item !== null && typeof item === 'object'
            ? serializeBigInt(item as Record<string, unknown>)
            : item,
      );
    } else {
      result[key] = value;
    }
  }

  return result;
}

/**
 * Deserializes a BigInt string from JSON input.
 * Throws if the string is not a valid BigInt.
 */
export function parseBigIntString(value: string, fieldName: string): bigint {
  try {
    const parsed = BigInt(value);
    if (parsed < 0n) {
      throw new Error(`${fieldName} must be non-negative`);
    }
    return parsed;
  } catch {
    throw new Error(`${fieldName} must be a valid non-negative integer string`);
  }
}

/**
 * Converts a rupees input (from customer) to paise.
 * Uses Math.round to handle floating-point edge cases at the API boundary.
 * This is the ONLY approved place for rupees-to-paise conversion.
 */
export function rupeesToPaise(rupees: number): bigint {
  return BigInt(Math.round(rupees * 100));
}

/**
 * Converts paise BigInt to Number for Razorpay API.
 * This is the ONLY approved place for BigInt-to-Number conversion.
 * Throws if the value exceeds Number.MAX_SAFE_INTEGER.
 */
export function paiseToRazorpayAmount(paise: bigint): number {
  if (paise > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Amount exceeds safe integer range for Razorpay');
  }
  return Number(paise);
}
