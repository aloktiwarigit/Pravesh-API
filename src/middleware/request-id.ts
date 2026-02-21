import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

declare global {
  namespace Express {
    interface Request {
      id: string;
    }
  }
}

/**
 * Assigns a unique request ID to each incoming request.
 * Uses the X-Request-ID header if provided by the client/load-balancer,
 * otherwise generates a new UUID v4.
 */
export function requestId(req: Request, res: Response, next: NextFunction): void {
  const id = (req.headers['x-request-id'] as string) || randomUUID();
  req.id = id;
  res.setHeader('X-Request-ID', id);
  next();
}
