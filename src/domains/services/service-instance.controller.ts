// Story 5-6: Service Instance Controller
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ServiceInstanceService } from './service-instance.service.js';

const createInstanceSchema = z.object({
  customerId: z.string().uuid(),
  serviceDefinitionId: z.string().uuid(),
  metadata: z.record(z.unknown()).optional(),
});

const transitionSchema = z.object({
  newState: z.string().min(1),
  reason: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export function serviceInstanceRoutes(
  service: ServiceInstanceService,
): Router {
  const router = Router();

  // POST /api/v1/services/instances
  router.post(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = createInstanceSchema.parse(req.body);
        const user = (req as any).user!;
        const instance = await service.createInstance({
          ...body,
          cityId: user.cityId,
          createdBy: user.id,
        });
        res.status(201).json({ success: true, data: instance });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /api/v1/services/instances/:instanceId
  router.get(
    '/:instanceId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user!;
        const instance = await service.getInstance(req.params.instanceId);

        // Ownership check: customers see only their own, agents their assigned
        const isOpsOrAdmin = ['ops_manager', 'ops_executive', 'admin'].includes(user.role);
        const isOwner = instance.customerId === user.id;
        const isAssignedAgent = instance.assignedAgentId === user.id;
        if (!isOpsOrAdmin && !isOwner && !isAssignedAgent) {
          return res.status(403).json({ success: false, error: { code: 'AUTH_FORBIDDEN', message: 'You do not have access to this service instance' } });
        }

        res.json({ success: true, data: instance });
      } catch (error) {
        next(error);
      }
    },
  );

  // POST /api/v1/services/instances/:instanceId/transition
  router.post(
    '/:instanceId/transition',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = transitionSchema.parse(req.body);
        const user = (req as any).user!;
        const result = await service.transitionState(
          req.params.instanceId,
          body.newState,
          user.id,
          body.reason,
          body.metadata,
        );
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /api/v1/services/instances/:instanceId/history
  router.get(
    '/:instanceId/history',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const history = await service.getHistory(req.params.instanceId);
        res.json({ success: true, data: history });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /api/v1/services/instances (city-scoped list)
  router.get(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user!;
        const result = await service.getInstancesByCityId(
          user.cityId,
          req.query.status as string | undefined,
          {
            cursor: req.query.cursor as string | undefined,
            limit: parseInt(req.query.limit as string, 10) || 20,
          },
        );
        res.json({ success: true, ...result });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
