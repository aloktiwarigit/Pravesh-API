import { Request, Response, NextFunction } from 'express';

/**
 * Layer 2: Authorization middleware
 * Checks user's roles against endpoint permission map.
 * Supports both multi-role (roles array) and single-role (role string) checks.
 */
export function authorize(...allowedRoles: string[]) {
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

    // Check if any of the user's roles match the allowed roles
    const userRoles = req.user.roles || [req.user.role];
    const hasRole = userRoles.some((r) => allowedRoles.includes(r));

    if (!hasRole) {
      res.status(403).json({
        success: false,
        error: {
          code: 'AUTH_INSUFFICIENT_ROLE',
          message: `Required role: ${allowedRoles.join(' or ')}. Current roles: ${userRoles.join(', ')}`,
        },
      });
      return;
    }

    next();
  };
}
