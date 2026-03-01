import { Request, Response, NextFunction } from 'express';
import { runWithTenantContext } from '../shared/prisma/tenant-middleware';

/**
 * Layer 3: Scope middleware
 * Injects city_id from user context into tenant middleware using AsyncLocalStorage.
 * Super Admin, ops, and ops_manager bypass city scoping.
 */
const BYPASS_ROLES = ['super_admin', 'ops', 'ops_manager'];

export function scope(req: Request, _res: Response, next: NextFunction) {
  const userRoles: string[] = req.user?.roles || (req.user?.role ? [req.user.role] : []);
  const isSuperAdmin = userRoles.some((r) => BYPASS_ROLES.includes(r));

  runWithTenantContext(
    {
      cityId: req.user?.cityId,
      isSuperAdmin,
    },
    () => next(),
  );
}
