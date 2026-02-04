/**
 * JSON replacer that converts BigInt values to strings.
 * Use with JSON.stringify when serializing objects containing BigInt.
 *
 * Story 4.5 / 4.14: BigInt JSON serialization
 */

export function bigIntReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}

/**
 * Safely stringify an object that may contain BigInt values.
 */
export function jsonStringifyBigInt(obj: unknown): string {
  return JSON.stringify(obj, bigIntReplacer);
}
