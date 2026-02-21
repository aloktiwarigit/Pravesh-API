import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';

type ValidationSource = 'body' | 'query' | 'params';

/**
 * Reusable Zod validation middleware.
 *
 * Usage:
 *   router.get('/items', validate(listSchema, 'query'), handler);
 *   router.post('/items', validate(createSchema, 'body'), handler);
 *   router.get('/items/:id', validate(idSchema, 'params'), handler);
 *
 * On success, replaces req[source] with the parsed (and coerced) data.
 * On failure, returns 400 with structured error details.
 */
export function validate(schema: ZodSchema, source: ValidationSource) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const error = result.error as ZodError;
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid ${source} parameters`,
          details: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
            code: e.code,
          })),
        },
      });
      return;
    }

    // Replace raw input with validated + coerced data
    (req as any)[source] = result.data;
    next();
  };
}
