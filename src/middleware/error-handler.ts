import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { BusinessError } from '../shared/errors/business-error';
import { AppError } from '../core/errors/app-error';
import { logger } from '../shared/utils/logger';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  // Zod validation errors -> 400
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_INVALID_INPUT',
        message: 'Invalid input data',
        details: err.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  // AppError -> custom status (used by 14+ services)
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Business errors -> custom status
  if (err instanceof BusinessError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
    return;
  }

  // Prisma known request errors
  if (err.name === 'PrismaClientKnownRequestError') {
    const prismaErr = err as any;
    if (prismaErr.code === 'P2002') {
      res.status(409).json({
        success: false,
        error: {
          code: 'BUSINESS_DUPLICATE_ENTRY',
          message: 'A record with these values already exists',
          details: { fields: prismaErr.meta?.target },
        },
      });
      return;
    }
    if (prismaErr.code === 'P2003') {
      res.status(409).json({
        success: false,
        error: {
          code: 'BUSINESS_FK_CONSTRAINT',
          message: 'Operation violates a foreign key constraint',
          details: { field: prismaErr.meta?.field_name },
        },
      });
      return;
    }
    if (prismaErr.code === 'P2025') {
      res.status(404).json({
        success: false,
        error: {
          code: 'BUSINESS_NOT_FOUND',
          message: 'Record not found',
        },
      });
      return;
    }
  }

  // Prisma validation errors (invalid query shape) -> 400
  if (err.name === 'PrismaClientValidationError') {
    logger.warn({ err, requestId: req.id }, 'Prisma validation error');
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_INVALID_QUERY',
        message: 'Invalid request parameters',
      },
    });
    return;
  }

  // Unknown errors -> 500
  logger.error({ err, requestId: req.id }, 'Unhandled error');
  res.status(500).json({
    success: false,
    error: {
      code: 'SYSTEM_INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    },
  });
}
