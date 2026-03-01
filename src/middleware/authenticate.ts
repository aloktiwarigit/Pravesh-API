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
 * For E2E testing, accepts x-test-auth-secret header when TEST_AUTH_SECRET env var is set.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // Two mechanisms for test/dev auth bypass:
    // 1. DEV_AUTH_BYPASS: only works in non-production (local dev)
    // 2. TEST_AUTH_SECRET: only works in non-production, requires matching secret header (for E2E tests)
    const isProduction = process.env.NODE_ENV === 'production';
    const testSecret = process.env.TEST_AUTH_SECRET;
    const hasSecretAuth = !isProduction && testSecret &&
      testSecret.length > 0 &&
      req.headers['x-test-auth-secret'] &&
      require('crypto').timingSafeEqual(
        Buffer.from(testSecret),
        Buffer.from(String(req.headers['x-test-auth-secret']).padEnd(testSecret.length).slice(0, testSecret.length)),
      ) &&
      String(req.headers['x-test-auth-secret']).length === testSecret.length;
    const hasDevBypass = !isProduction && process.env.DEV_AUTH_BYPASS === 'true';
    if (hasDevBypass || hasSecretAuth) {
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
