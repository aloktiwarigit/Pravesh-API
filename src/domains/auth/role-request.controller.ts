import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { RoleRequestService } from './role-request.service';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';

const createRequestSchema = z.object({
  requestedRole: z.string().min(1),
  notes: z.string().max(1000).optional(),
});

const reviewRequestSchema = z.object({
  approved: z.boolean(),
  reviewNotes: z.string().max(1000).optional(),
});

export function createRoleRequestController(prisma: PrismaClient): Router {
  const router = Router();
  const service = new RoleRequestService(prisma);

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

  // POST /api/v1/auth/role-requests — any authenticated user requests a role
  router.post('/', authenticate, async (req: Request, res: Response) => {
    try {
      const input = createRequestSchema.parse(req.body);
      const userId = req.user!.id;

      // Look up user by Firebase UID to get platform ID
      const user = await prisma.user.findUnique({
        where: { firebaseUid: userId },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      const request = await service.createRequest(
        user.id,
        input.requestedRole,
        input.notes,
      );
      res.status(201).json({ success: true, data: request });
    } catch (error) {
      handleError(res, error);
    }
  });

  // GET /api/v1/auth/role-requests/mine — user sees their own requests
  router.get('/mine', authenticate, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;

      const user = await prisma.user.findUnique({
        where: { firebaseUid: userId },
      });

      if (!user) {
        return res.status(404).json({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      const requests = await service.getMyRequests(user.id);
      res.json({ success: true, data: requests });
    } catch (error) {
      handleError(res, error);
    }
  });

  // GET /api/v1/auth/role-requests — admin/ops lists all pending requests
  router.get(
    '/',
    authenticate,
    authorize('super_admin', 'ops', 'franchise_owner'),
    async (req: Request, res: Response) => {
      try {
        const userId = req.user!.id;

        const user = await prisma.user.findUnique({
          where: { firebaseUid: userId },
        });

        if (!user) {
          return res.status(404).json({
            success: false,
            error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          });
        }

        const requests = await service.listPendingRequests(user.id);
        res.json({ success: true, data: requests });
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  // PATCH /api/v1/auth/role-requests/:id — admin approves/rejects
  router.patch(
    '/:id',
    authenticate,
    authorize('super_admin', 'ops', 'franchise_owner'),
    async (req: Request, res: Response) => {
      try {
        const input = reviewRequestSchema.parse(req.body);
        const userId = req.user!.id;

        const user = await prisma.user.findUnique({
          where: { firebaseUid: userId },
        });

        if (!user) {
          return res.status(404).json({
            success: false,
            error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          });
        }

        const result = await service.reviewRequest(
          req.params.id,
          user.id,
          input.approved,
          input.reviewNotes,
        );
        res.json({ success: true, data: result });
      } catch (error) {
        handleError(res, error);
      }
    },
  );

  return router;
}
