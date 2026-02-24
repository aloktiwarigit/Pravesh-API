import { Request, Response, NextFunction } from 'express';
import admin from 'firebase-admin';

// Extend Express Request to include user context
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: string;       // Primary/active role (backward compat)
        roles: string[];    // All assigned roles
        cityId?: string;
        email?: string;
        permissions?: string[];
      };
    }
  }
}

/**
 * Layer 1: Authentication middleware
 * Verifies Firebase ID token and extracts user identity.
 * Supports both `roles` (array) and legacy `role` (string) claim formats.
 * For development, accepts x-dev-user-id header only when DEV_AUTH_BYPASS is explicitly set.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // Dev/test mode: accept test headers only with explicit opt-in
    // DEV_AUTH_BYPASS works in any environment (including production for QA testing)
    if (process.env.DEV_AUTH_BYPASS === 'true') {
      const devUserId = req.headers['x-dev-user-id'] as string;
      const devRole = req.headers['x-dev-role'] as string;
      const devCityId = req.headers['x-dev-city-id'] as string;

      if (devUserId && devRole) {
        req.user = {
          id: devUserId,
          role: devRole,
          roles: [devRole],
          cityId: devCityId || undefined,
          email: req.headers['x-dev-email'] as string,
        };
        return next();
      }
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTH_TOKEN_INVALID',
          message: 'Missing or invalid authorization header',
        },
      });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    const claims = decodedToken as any;

    // Support both array `roles` and legacy singular `role` formats
    let roles: string[] = [];
    if (Array.isArray(claims.roles) && claims.roles.length > 0) {
      roles = claims.roles;
    } else if (claims.role) {
      roles = [claims.role];
    }

    // Primary role: from claims or first in array
    const primaryRole = claims.primaryRole || roles[0] || '';

    req.user = {
      id: decodedToken.uid,
      role: primaryRole,
      roles,
      cityId: claims.cityId || undefined,
      email: decodedToken.email,
      permissions: claims.permissions || [],
    };

    // Allow requests without roles for /auth/register and /auth/me endpoints
    // Other endpoints will check roles via authorize() middleware
    if (!req.user.role && !req.path.startsWith('/auth/')) {
      res.status(403).json({
        success: false,
        error: {
          code: 'AUTH_NO_ROLE',
          message: 'User has no assigned role. Please contact admin for role assignment.',
        },
      });
      return;
    }

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTH_TOKEN_INVALID',
        message: 'Token verification failed',
      },
    });
  }
}
