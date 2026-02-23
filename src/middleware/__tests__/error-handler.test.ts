/**
 * Tests for the global error handler middleware.
 * Covers ZodError, BusinessError, Prisma errors, and unknown errors.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodIssue } from 'zod';
import { errorHandler } from '../error-handler';
import { BusinessError } from '../../shared/errors/business-error';

vi.mock('../../shared/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { logger } from '../../shared/utils/logger';

describe('Error Handler Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {};

    const jsonMock = vi.fn().mockReturnThis();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    mockNext = vi.fn();

    // Reset logger mock between tests
    vi.mocked(logger.error).mockReset();
  });

  // ============================================================
  // ZodError handling
  // ============================================================

  describe('ZodError handling', () => {
    test('returns 400 with validation details for ZodError', () => {
      // Given: a ZodError
      const zodIssues: ZodIssue[] = [
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['phone'],
          message: 'Required',
        },
      ];
      const zodError = new ZodError(zodIssues);

      // When
      errorHandler(
        zodError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'VALIDATION_INVALID_INPUT',
          message: 'Invalid input data',
          details: [
            { path: 'phone', message: 'Required' },
          ],
        },
      });
    });

    test('handles multiple ZodError issues', () => {
      // Given
      const zodIssues: ZodIssue[] = [
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'undefined',
          path: ['phone'],
          message: 'Required',
        },
        {
          code: 'too_small',
          minimum: 1,
          type: 'string',
          inclusive: true,
          exact: false,
          path: ['displayName'],
          message: 'String must contain at least 1 character(s)',
        },
      ];
      const zodError = new ZodError(zodIssues);

      // When
      errorHandler(
        zodError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      const responseBody = (mockResponse.json as any).mock.calls[0][0];
      expect(responseBody.error.details).toHaveLength(2);
    });

    test('joins nested path with dots', () => {
      // Given
      const zodIssues: ZodIssue[] = [
        {
          code: 'invalid_type',
          expected: 'string',
          received: 'number',
          path: ['address', 'city', 'name'],
          message: 'Expected string, received number',
        },
      ];
      const zodError = new ZodError(zodIssues);

      // When
      errorHandler(
        zodError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Then
      const responseBody = (mockResponse.json as any).mock.calls[0][0];
      expect(responseBody.error.details[0].path).toBe('address.city.name');
    });
  });

  // ============================================================
  // BusinessError handling
  // ============================================================

  describe('BusinessError handling', () => {
    test('returns correct status code and error details', () => {
      // Given
      const error = new BusinessError('USER_NOT_FOUND', 'User not found', 404);

      // When
      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
          details: undefined,
        },
      });
    });

    test('includes details when provided', () => {
      // Given
      const error = new BusinessError(
        'BUSINESS_INVALID_CONFIG',
        'Invalid configuration',
        422,
        { field: 'maxAgents', reason: 'Must be positive' },
      );

      // When
      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(422);
      const responseBody = (mockResponse.json as any).mock.calls[0][0];
      expect(responseBody.error.details).toEqual({
        field: 'maxAgents',
        reason: 'Must be positive',
      });
    });

    test('defaults to 422 status when not specified', () => {
      // Given
      const error = new BusinessError('BUSINESS_ERROR', 'Something went wrong');

      // When
      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(422);
    });
  });

  // ============================================================
  // Prisma error handling
  // ============================================================

  describe('Prisma error handling', () => {
    test('returns 409 for unique constraint violation (P2002)', () => {
      // Given
      const prismaError: any = new Error('Unique constraint failed');
      prismaError.name = 'PrismaClientKnownRequestError';
      prismaError.code = 'P2002';
      prismaError.meta = { target: ['email'] };

      // When
      errorHandler(
        prismaError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(409);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'BUSINESS_DUPLICATE_ENTRY',
          message: 'A record with these values already exists',
          details: { fields: ['email'] },
        },
      });
    });

    test('returns 404 for record not found (P2025)', () => {
      // Given
      const prismaError: any = new Error('Record not found');
      prismaError.name = 'PrismaClientKnownRequestError';
      prismaError.code = 'P2025';

      // When
      errorHandler(
        prismaError,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'BUSINESS_NOT_FOUND',
          message: 'Record not found',
        },
      });
    });
  });

  // ============================================================
  // Unknown error handling
  // ============================================================

  describe('Unknown error handling', () => {
    test('returns 500 for unknown errors', () => {
      // Given
      const error = new Error('Something unexpected happened');

      // When
      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'SYSTEM_INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      });
    });

    test('logs unknown errors via logger', () => {
      // Given
      const error = new Error('Unexpected error');

      // When
      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Then: the error handler calls logger.error (not console.error)
      expect(logger.error).toHaveBeenCalledWith(
        { err: error, requestId: (mockRequest as Request).id },
        'Unhandled error',
      );
    });

    test('does not expose internal error details', () => {
      // Given
      const error = new Error('Database connection string: postgres://user:pass@host/db');

      // When
      errorHandler(
        error,
        mockRequest as Request,
        mockResponse as Response,
        mockNext,
      );

      // Then: the actual error message is not exposed
      const responseBody = (mockResponse.json as any).mock.calls[0][0];
      expect(responseBody.error.message).toBe('An unexpected error occurred');
      expect(responseBody.error.message).not.toContain('postgres');
    });
  });
});
