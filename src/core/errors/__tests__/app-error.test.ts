/**
 * Tests for AppError class.
 */
import { describe, test, expect } from 'vitest';
import { AppError } from '../app-error';

describe('AppError', () => {
  test('creates error with code, message, and statusCode', () => {
    const error = new AppError('SERVICE_NOT_FOUND', 'Service not found', 404);

    expect(error.code).toBe('SERVICE_NOT_FOUND');
    expect(error.message).toBe('Service not found');
    expect(error.statusCode).toBe(404);
    expect(error.name).toBe('AppError');
  });

  test('defaults statusCode to 500', () => {
    const error = new AppError('INTERNAL', 'Internal error');

    expect(error.statusCode).toBe(500);
  });

  test('includes details when provided', () => {
    const details = { resource: 'payment', id: 'pay-001' };
    const error = new AppError('NOT_FOUND', 'Not found', 404, details);

    expect(error.details).toEqual(details);
  });

  test('details is undefined when not provided', () => {
    const error = new AppError('ERROR', 'Error');

    expect(error.details).toBeUndefined();
  });

  test('toJSON returns structured error object', () => {
    const error = new AppError('TEST_CODE', 'Test message', 400);
    const json = error.toJSON();

    expect(json).toEqual({
      success: false,
      error: {
        code: 'TEST_CODE',
        message: 'Test message',
      },
    });
  });

  test('toJSON includes details when present', () => {
    const error = new AppError('TEST', 'Test', 422, { field: 'name' });
    const json = error.toJSON();

    expect(json).toEqual({
      success: false,
      error: {
        code: 'TEST',
        message: 'Test',
        details: { field: 'name' },
      },
    });
  });

  test('toJSON omits details when not present', () => {
    const error = new AppError('TEST', 'Test');
    const json = error.toJSON();

    expect(json.error).not.toHaveProperty('details');
  });

  test('extends Error class', () => {
    const error = new AppError('TEST', 'Test');

    expect(error instanceof Error).toBe(true);
    expect(error instanceof AppError).toBe(true);
  });

  test('has a stack trace', () => {
    const error = new AppError('TEST', 'Test');

    expect(error.stack).toBeDefined();
  });
});
