/**
 * Tests for BusinessError class.
 */
import { describe, test, expect } from 'vitest';
import { BusinessError } from '../business-error';

describe('BusinessError', () => {
  test('creates error with code, message, and statusCode', () => {
    const error = new BusinessError('USER_NOT_FOUND', 'User not found', 404);

    expect(error.code).toBe('USER_NOT_FOUND');
    expect(error.message).toBe('User not found');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('BusinessError');
  });

  test('defaults statusCode to 422', () => {
    const error = new BusinessError('BUSINESS_ERROR', 'Something went wrong');

    expect(error.statusCode).toBe(422);
  });

  test('includes details when provided', () => {
    const details = { field: 'email', reason: 'Already exists' };
    const error = new BusinessError('DUPLICATE', 'Duplicate entry', 409, details);

    expect(error.details).toEqual(details);
  });

  test('details is undefined when not provided', () => {
    const error = new BusinessError('ERROR', 'An error');

    expect(error.details).toBeUndefined();
  });

  test('extends Error class', () => {
    const error = new BusinessError('TEST', 'Test error');

    expect(error instanceof Error).toBe(true);
    expect(error instanceof BusinessError).toBe(true);
  });

  test('has a stack trace', () => {
    const error = new BusinessError('TEST', 'Test error');

    expect(error.stack).toBeDefined();
    expect(error.stack).toContain('BusinessError');
  });

  test('can be caught as Error', () => {
    try {
      throw new BusinessError('THROWN', 'Thrown error', 400);
    } catch (err) {
      expect(err instanceof Error).toBe(true);
      expect((err as BusinessError).code).toBe('THROWN');
      expect((err as BusinessError).statusCode).toBe(400);
    }
  });

  test('supports various HTTP status codes', () => {
    const codes = [400, 401, 403, 404, 409, 422, 429, 500];

    for (const statusCode of codes) {
      const error = new BusinessError('TEST', 'Test', statusCode);
      expect(error.statusCode).toBe(statusCode);
    }
  });
});
