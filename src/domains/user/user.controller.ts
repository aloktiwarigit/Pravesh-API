// ============================================================
// User Domain — Controller
// Profile management, admin user search
// Request handling, Zod validation, standard { success, data } response
// ============================================================

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { UserService } from './user.service';
import { updateProfileSchema, userSearchSchema } from './user.validation';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';

export function createUserController(prisma: PrismaClient): Router {
  const router = Router();
  const userService = new UserService(prisma);

  // All routes require authentication
  router.use(authenticate);

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
  // GET /me — Get current user's profile
  // ==========================================================

  router.get('/me', async (req: Request, res: Response) => {
    try {
      const firebaseUid = (req as any).user?.id;
      const user = await userService.getProfile(firebaseUid);
      res.json({ success: true, data: user });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ==========================================================
  // PUT /me — Update current user's profile
  // ==========================================================

  router.put('/me', async (req: Request, res: Response) => {
    try {
      const firebaseUid = (req as any).user?.id;
      const input = updateProfileSchema.parse(req.body);
      const user = await userService.updateProfile(firebaseUid, input);
      res.json({ success: true, data: user });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ==========================================================
  // GET /search — Admin: search / list users with filters
  // ==========================================================

  router.get(
    '/search',
    authorize('super_admin', 'ops', 'franchise_owner'),
    async (req: Request, res: Response) => {
      try {
        const filters = userSearchSchema.parse(req.query);
        const result = await userService.searchUsers(filters);
        res.json({ success: true, data: result });
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  // ==========================================================
  // GET /:userId — Admin: get any user by ID
  // ==========================================================

  router.get(
    '/:userId',
    authorize('super_admin', 'ops'),
    async (req: Request, res: Response) => {
      try {
        const user = await userService.getUserById(req.params.userId);
        res.json({ success: true, data: user });
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  return router;
}
