// Story 3-2: Agent Assignment Controller
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AgentAssignmentService } from './agent-assignment.service';

const autoAssignSchema = z.object({
  serviceRequestId: z.string().uuid(),
  propertyLat: z.number().min(-90).max(90),
  propertyLng: z.number().min(-180).max(180),
});

const manualAssignSchema = z.object({
  serviceRequestId: z.string().uuid(),
  agentId: z.string().uuid(),
  propertyLat: z.number().min(-90).max(90).optional(),
  propertyLng: z.number().min(-180).max(180).optional(),
});

const reassignSchema = z.object({
  newAgentId: z.string().uuid(),
  reason: z.string().min(1),
});

export function agentAssignmentRoutes(
  service: AgentAssignmentService,
): Router {
  const router = Router();

  // POST /api/v1/agents/assignments/auto
  router.post(
    '/auto',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = autoAssignSchema.parse(req.body);
        const user = (req as any).user!;
        const result = await service.autoAssign({
          ...body,
          cityId: user.cityId,
          assignedBy: user.id,
        });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  // POST /api/v1/agents/assignments/manual
  router.post(
    '/manual',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = manualAssignSchema.parse(req.body);
        const user = (req as any).user!;
        const result = await service.manualAssign({
          serviceRequestId: body.serviceRequestId,
          manualAgentId: body.agentId,
          cityId: user.cityId,
          propertyLat: body.propertyLat,
          propertyLng: body.propertyLng,
          assignedBy: user.id,
        });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  // POST /api/v1/agents/assignments/:serviceRequestId/reassign
  router.post(
    '/:serviceRequestId/reassign',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = reassignSchema.parse(req.body);
        const user = (req as any).user!;
        const result = await service.reassign(
          req.params.serviceRequestId,
          body.newAgentId,
          user.id,
          body.reason,
        );
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /api/v1/agents/assignments/:serviceRequestId/history
  router.get(
    '/:serviceRequestId/history',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const history = await service.getAssignmentHistory(
          req.params.serviceRequestId,
        );
        res.json({ success: true, data: history });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
