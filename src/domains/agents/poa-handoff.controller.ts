// Story 13-8: POA-Linked Service Workflow Handoff Controller
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PoaHandoffService } from './poa-handoff.service.js';

export function poaHandoffRoutes(
  service: PoaHandoffService
): Router {
  const router = Router();

  // GET /api/v1/agents/poa/service/:serviceRequestId/poa
  router.get(
    '/service/:serviceRequestId/poa',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.getServiceWithPoaDetails(
          req.params.serviceRequestId
        );
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/agents/poa/notify-attorney
  router.post(
    '/notify-attorney',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z
          .object({
            serviceRequestId: z.string().uuid(),
            message: z.string().min(1),
            actionRequired: z.string(),
          })
          .parse(req.body);
        await service.notifyAttorney(body);
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/agents/poa/notify-nri-milestone
  router.post(
    '/notify-nri-milestone',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z
          .object({
            serviceRequestId: z.string().uuid(),
            milestone: z.string(),
            description: z.string(),
          })
          .parse(req.body);
        await service.notifyNriCustomerMilestone(body);
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/agents/poa/flag-issue
  router.post(
    '/flag-issue',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z
          .object({
            serviceRequestId: z.string().uuid(),
            issueType: z.enum([
              'unresponsive_attorney',
              'insufficient_scope',
            ]),
            notes: z.string(),
          })
          .parse(req.body);
        await service.flagPoaIssue({
          ...body,
          agentId: (req as any).user!.id,
        });
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
