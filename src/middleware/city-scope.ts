import { Request, Response, NextFunction } from 'express';

/**
 * City isolation middleware.
 * Validates that the cityId in route params or request body matches
 * the authenticated user's cityId. Super_admin and ops roles bypass
 * this check.
 *
 * Usage:
 *   router.get('/:cityId', cityScope(), handler)
 *   router.post('/', cityScope({ bodyField: 'cityId' }), handler)
 */

const BYPASS_ROLES = ['super_admin', 'ops'];

export function cityScope(options?: { bodyField?: string }) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_TOKEN_INVALID',
          message: 'Not authenticated',
        },
      });
      return;
    }

    // Bypass for super_admin and ops
    const userRoles = req.user.roles || [req.user.role];
    if (userRoles.some((r) => BYPASS_ROLES.includes(r))) {
      return next();
    }

    const userCityId = req.user.cityId;
    if (!userCityId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'AUTH_CITY_MISSING',
          message: 'User does not have a city assignment',
        },
      });
      return;
    }

    // Check route param
    const paramCityId = req.params.cityId;
    if (paramCityId && paramCityId !== userCityId) {
      res.status(403).json({
        success: false,
        error: {
          code: 'AUTH_CITY_MISMATCH',
          message: 'Access denied: city does not match your assignment',
        },
      });
      return;
    }

    // Check body field
    if (options?.bodyField && req.body) {
      const bodyCityId = req.body[options.bodyField];
      if (bodyCityId && bodyCityId !== userCityId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'AUTH_CITY_MISMATCH',
            message: 'Access denied: city in request body does not match your assignment',
          },
        });
        return;
      }
    }

    next();
  };
}

/**
 * Middleware that enforces city isolation on entity detail/update routes.
 * Accepts a lookup function that resolves entityId -> cityId.
 * Used for routes like /:id where cityId is not in the URL.
 *
 * Usage:
 *   router.get('/detail/:id', cityScopeByEntity(async (id, prisma) => {
 *     const agent = await prisma.agent.findUnique({ where: { id }, select: { cityId: true } });
 *     return agent?.cityId;
 *   }), handler)
 */
export function cityScopeByEntity(
  lookupCityId: (entityId: string, req: Request) => Promise<string | undefined | null>,
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: { code: 'AUTH_TOKEN_INVALID', message: 'Not authenticated' },
      });
      return;
    }

    const userRoles = req.user.roles || [req.user.role];
    if (userRoles.some((r) => BYPASS_ROLES.includes(r))) {
      return next();
    }

    const userCityId = req.user.cityId;
    if (!userCityId) {
      res.status(403).json({
        success: false,
        error: { code: 'AUTH_CITY_MISSING', message: 'User does not have a city assignment' },
      });
      return;
    }

    const entityId = req.params.id;
    if (!entityId) {
      return next();
    }

    try {
      const entityCityId = await lookupCityId(entityId, req);
      if (entityCityId && entityCityId !== userCityId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'AUTH_CITY_MISMATCH',
            message: 'Access denied: entity belongs to a different city',
          },
        });
        return;
      }
    } catch {
      // Entity not found — let the handler deal with the 404
    }

    next();
  };
}
