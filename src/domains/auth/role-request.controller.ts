import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { RoleRequestService } from './role-request.service';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';

// Role-specific metadata schemas
const agentMetadataSchema = z.object({
  cityId: z.string().uuid(),
});

const dealerMetadataSchema = z.object({
  cityId: z.string().uuid(),
  businessName: z.string().min(2).max(200),
});

const lawyerMetadataSchema = z.object({
  cityId: z.string().uuid(),
  barCouncilNumber: z.string().min(5).max(30),
  stateBarCouncil: z.string().min(2).max(50),
  admissionYear: z.number().int().min(1950).max(new Date().getFullYear()),
  practicingCertUrl: z.string().url(),
});

const builderMetadataSchema = z.object({
  cityId: z.string().uuid(),
  companyName: z.string().min(2).max(200),
  reraNumber: z.string().min(8).max(30),
  gstNumber: z.string().regex(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/, 'Invalid GST number format'),
  contactPhone: z.string().regex(/^\+91\d{10}$/, 'Phone must be +91 followed by 10 digits'),
});

const createRequestSchema = z.discriminatedUnion('requestedRole', [
  z.object({
    requestedRole: z.literal('agent'),
    notes: z.string().max(1000).optional(),
    roleMetadata: agentMetadataSchema,
  }),
  z.object({
    requestedRole: z.literal('dealer'),
    notes: z.string().max(1000).optional(),
    roleMetadata: dealerMetadataSchema,
  }),
  z.object({
    requestedRole: z.literal('lawyer'),
    notes: z.string().max(1000).optional(),
    roleMetadata: lawyerMetadataSchema,
  }),
  z.object({
    requestedRole: z.literal('builder'),
    notes: z.string().max(1000).optional(),
    roleMetadata: builderMetadataSchema,
  }),
]);

const reviewRequestSchema = z.object({
  approved: z.boolean(),
  reviewNotes: z.string().max(1000).optional(),
});

export function createRoleRequestController(prisma: PrismaClient): Router {
  const router = Router();
  const service = new RoleRequestService(prisma);

  // POST /api/v1/auth/role-requests — any authenticated user requests a role
  router.post('/', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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
        input.roleMetadata,
      );
      res.status(201).json({ success: true, data: request });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/auth/role-requests/mine — user sees their own requests
  router.get('/mine', authenticate, async (req: Request, res: Response, next: NextFunction) => {
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
      next(error);
    }
  });

  // GET /api/v1/auth/role-requests — admin/ops lists all pending requests
  router.get(
    '/',
    authenticate,
    authorize('super_admin', 'ops', 'franchise_owner'),
    async (req: Request, res: Response, next: NextFunction) => {
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
        next(error);
      }
    },
  );

  // PATCH /api/v1/auth/role-requests/:id — admin approves/rejects
  router.patch(
    '/:id',
    authenticate,
    authorize('super_admin', 'ops', 'franchise_owner'),
    async (req: Request, res: Response, next: NextFunction) => {
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
        next(error);
      }
    },
  );

  return router;
}
