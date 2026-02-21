/**
 * Customer Services Controller
 * Routes for customer-facing service lifecycle operations.
 *
 * GET  /api/v1/services/my-services     — List customer's active services
 * GET  /api/v1/services/recommendations  — Service recommendations
 * GET  /api/v1/services/:id              — Single service detail
 * POST /api/v1/services/:id/cancel       — Cancel a service
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { CustomerServicesService } from './customer-services.service';
import { authorize } from '../../middleware/authorize';

const cancelSchema = z.object({
  reason: z.string().min(1),
});

export function createCustomerServicesController(prisma: PrismaClient): Router {
  const router = Router();
  const service = new CustomerServicesService(prisma);

  /**
   * GET /my-services
   * List customer's active services.
   */
  router.get(
    '/my-services',
    authorize('customer'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user!;
        const result = await service.getMyServices(user.id);
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /recommendations
   * Get service recommendations with optional filters.
   */
  router.get(
    '/recommendations',
    authorize('customer'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const filters = {
          propertyType: req.query.propertyType as string | undefined,
          ownershipStatus: req.query.ownershipStatus as string | undefined,
          category: req.query.category as string | undefined,
        };
        const result = await service.getRecommendations(filters);
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /:id
   * Get single service detail.
   */
  router.get(
    '/:id',
    authorize('customer'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user!;
        const result = await service.getServiceById(req.params.id, user.id);
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /:id/cancel
   * Cancel a service.
   */
  router.post(
    '/:id/cancel',
    authorize('customer'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user!;
        const { reason } = cancelSchema.parse(req.body);
        const result = await service.cancelService(req.params.id, user.id, reason);
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
