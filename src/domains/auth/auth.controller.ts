// ============================================================
// Auth Domain — Controller
// Registration, profile, role management, status, claims sync
// Request handling, Zod validation, standard { success, data } response
// ============================================================

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthService } from './auth.service';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import {
  registerSchema,
  setRoleSchema,
  updateStatusSchema,
  refreshClaimsSchema,
} from './auth.validation';

export function createAuthController(prisma: PrismaClient): Router {
  const router = Router();
  const authService = new AuthService(prisma);

  // Helper: standard error handler
  function handleError(res: Response, error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.errors },
      });
    }
    const statusCode = error.statusCode || 500;
    const code = error.code || 'SYSTEM_ERROR';
    const message = error.message || 'An unexpected error occurred';
    return res.status(statusCode).json({ success: false, error: { code, message } });
  }

  // ==========================================================
  // POST /register — No auth required
  // Called after Firebase phone auth succeeds on client
  // ==========================================================

  router.post('/register', async (req: Request, res: Response) => {
    try {
      const input = registerSchema.parse(req.body);
      const result = await authService.registerOrLogin({
        firebaseUid: input.firebaseUid,
        phone: input.phone,
        displayName: input.displayName,
        email: req.body.email,
        languagePref: input.languagePref,
      });
      res.status(result.isNewUser ? 201 : 200).json({ success: true, data: result });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ==========================================================
  // GET /me — Requires auth. Returns current user profile.
  // ==========================================================

  router.get('/me', authenticate, async (req: Request, res: Response) => {
    try {
      const firebaseUid = req.user!.id;
      const user = await authService.getUserByFirebaseUid(firebaseUid);
      res.json({ success: true, data: user });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ==========================================================
  // POST /set-roles — Requires auth + super_admin or ops
  // Sets roles on target user + updates Firebase custom claims
  // ==========================================================

  router.post(
    '/set-roles',
    authenticate,
    authorize('super_admin', 'ops'),
    async (req: Request, res: Response) => {
      try {
        const input = setRoleSchema.parse(req.body);
        const adminUserId = req.user!.id;

        // Look up admin by Firebase UID to get platform ID
        const adminUser = await authService.getUserByFirebaseUid(adminUserId);

        const updatedUser = await authService.setUserRoles(
          adminUser.id,
          input.userId,
          input.roles,
          input.cityId,
          input.primaryRole,
        );
        res.json({ success: true, data: updatedUser });
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  // ==========================================================
  // PUT /status — Requires auth + super_admin
  // Suspend, activate, or deactivate a user
  // ==========================================================

  router.put(
    '/status',
    authenticate,
    authorize('super_admin'),
    async (req: Request, res: Response) => {
      try {
        const input = updateStatusSchema.parse(req.body);
        const adminUserId = req.user!.id;

        // Look up admin by Firebase UID to get platform ID
        const adminUser = await authService.getUserByFirebaseUid(adminUserId);

        const updatedUser = await authService.updateUserStatus(
          adminUser.id,
          input.userId,
          input.status,
        );
        res.json({ success: true, data: updatedUser });
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  // ==========================================================
  // GET /pending — Requires auth + super_admin, ops, or franchise_owner
  // List users awaiting role assignment
  // ==========================================================

  router.get(
    '/pending',
    authenticate,
    authorize('super_admin', 'ops', 'franchise_owner'),
    async (req: Request, res: Response) => {
      try {
        const cityId = req.query.cityId as string | undefined;
        const users = await authService.listPendingUsers(cityId);
        res.json({ success: true, data: users });
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  // ==========================================================
  // POST /refresh-claims — Requires auth + super_admin or ops
  // Re-syncs Firebase custom claims from DB
  // ==========================================================

  router.post(
    '/refresh-claims',
    authenticate,
    authorize('super_admin', 'ops'),
    async (req: Request, res: Response) => {
      try {
        const input = refreshClaimsSchema.parse(req.body);
        const targetUser = await authService.getUserById(input.userId);
        const result = await authService.refreshClaims(targetUser.firebaseUid);
        res.json({ success: true, data: result });
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  return router;
}
