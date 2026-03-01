// ============================================================
// User Domain — Controller
// Profile management, admin user search
// Request handling, Zod validation, standard { success, data } response
// ============================================================

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { UserService } from './user.service';
import { updateProfileSchema, patchProfileSchema, userSearchSchema } from './user.validation';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';

export function createUserController(prisma: PrismaClient): Router {
  const router = Router();
  const userService = new UserService(prisma);

  // All routes require authentication
  router.use(authenticate);

  // ==========================================================
  // GET /me — Get current user's profile
  // ==========================================================

  router.get('/me', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const firebaseUid = (req as any).user?.id;
      const user = await userService.getProfile(firebaseUid);
      res.json({ success: true, data: {
        ...user,
        name: user.displayName,
        preferredLanguage: user.languagePref,
      }});
    } catch (error) {
      next(error);
    }
  });

  // ==========================================================
  // PUT /me — Update current user's profile
  // ==========================================================

  router.put('/me', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const firebaseUid = (req as any).user?.id;
      const input = updateProfileSchema.parse(req.body);
      const user = await userService.updateProfile(firebaseUid, input);
      res.json({ success: true, data: {
        ...user,
        name: user.displayName,
        preferredLanguage: user.languagePref,
      }});
    } catch (error) {
      next(error);
    }
  });

  // ==========================================================
  // PATCH /me — Partial profile update (Flutter sends PATCH)
  // ==========================================================

  router.patch('/me', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const firebaseUid = (req as any).user?.id;
      const input = patchProfileSchema.parse(req.body);
      // Map Flutter field names to Prisma field names
      const mapped = {
        ...(input.name !== undefined && { displayName: input.name }),
        ...(input.displayName !== undefined && { displayName: input.displayName }),
        ...(input.preferredLanguage !== undefined && { languagePref: input.preferredLanguage as 'en' | 'hi' }),
        ...(input.languagePref !== undefined && { languagePref: input.languagePref as 'en' | 'hi' }),
        ...(input.email !== undefined && { email: input.email }),
      };
      const user = await userService.updateProfile(firebaseUid, mapped);
      res.json({ success: true, data: {
        ...user,
        name: user.displayName,
        preferredLanguage: user.languagePref,
      }});
    } catch (error) {
      next(error);
    }
  });

  // ==========================================================
  // GET /search — Admin: search / list users with filters
  // ==========================================================

  router.get(
    '/search',
    authorize('super_admin', 'ops', 'franchise_owner'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const filters = userSearchSchema.parse(req.query);
        const result = await userService.searchUsers(filters);
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  // ==========================================================
  // GET /:userId — Admin: get any user by ID
  // ==========================================================

  router.get(
    '/:userId',
    authorize('super_admin', 'ops'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = await userService.getUserById(req.params.userId);
        res.json({ success: true, data: user });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
