import { Request, Response, NextFunction } from 'express';
import { runWithTenantContext } from '../shared/prisma/tenant-middleware';

/**
 * Layer 3: Scope middleware
 * Injects city_id from user context into tenant middleware using AsyncLocalStorage.
 * Super Admin bypasses city scoping.
 */
export function scope(req: Request, _res: Response, next: NextFunction) {
  const isSuperAdmin = req.user?.role === 'super_admin';

  runWithTenantContext(
    {
      cityId: req.user?.cityId,
      isSuperAdmin,
    },
    () => next(),
  );
}
