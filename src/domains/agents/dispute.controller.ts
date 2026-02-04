// Story 3-17: Dispute Controller
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DisputeService } from './dispute.service.js';

const createDisputeSchema = z.object({
  taskId: z.string().uuid(),
  serviceRequestId: z.string().uuid(),
  category: z.enum([
    'document_discrepancy',
    'boundary_dispute',
    'ownership_conflict',
    'customer_uncooperative',
    'government_office_issue',
    'payment_dispute',
    'other',
  ]),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  title: z.string().min(1).max(200),
  description: z.string().min(1),
  gpsLat: z.number().optional(),
  gpsLng: z.number().optional(),
  photoUrls: z.array(z.string().url()).optional(),
  documentIds: z.array(z.string().uuid()).optional(),
});

const addCommentSchema = z.object({
  content: z.string().min(1),
});

const updateStatusSchema = z.object({
  status: z.enum(['under_review', 'escalated', 'resolved', 'dismissed']),
});

const resolveSchema = z.object({
  resolution: z.string().min(1),
  newStatus: z.enum(['resolved', 'dismissed']),
});

export function disputeRoutes(service: DisputeService): Router {
  const router = Router();

  // POST /api/v1/agents/disputes
  router.post(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = createDisputeSchema.parse(req.body);
        const user = (req as any).user!;
        const dispute = await service.createDispute({
          ...body,
          agentId: user.id,
          cityId: user.cityId,
        });
        res.status(201).json({ success: true, data: dispute });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /api/v1/agents/disputes
  router.get(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user!;
        const disputes = await service.getAgentDisputes(
          user.id,
          req.query.status as any,
        );
        res.json({ success: true, data: disputes });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /api/v1/agents/disputes/service/:serviceRequestId
  router.get(
    '/service/:serviceRequestId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const disputes = await service.getServiceDisputes(
          req.params.serviceRequestId,
        );
        res.json({ success: true, data: disputes });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /api/v1/agents/disputes/:disputeId
  router.get(
    '/:disputeId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const dispute = await service.getDisputeById(req.params.disputeId);
        res.json({ success: true, data: dispute });
      } catch (error) {
        next(error);
      }
    },
  );

  // POST /api/v1/agents/disputes/:disputeId/comments
  router.post(
    '/:disputeId/comments',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = addCommentSchema.parse(req.body);
        const user = (req as any).user!;
        const comment = await service.addComment(
          req.params.disputeId,
          user.id,
          user.role,
          body.content,
        );
        res.status(201).json({ success: true, data: comment });
      } catch (error) {
        next(error);
      }
    },
  );

  // PATCH /api/v1/agents/disputes/:disputeId/status
  router.patch(
    '/:disputeId/status',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = updateStatusSchema.parse(req.body);
        const user = (req as any).user!;
        const updated = await service.updateStatus(
          req.params.disputeId,
          body.status,
          user.id,
        );
        res.json({ success: true, data: updated });
      } catch (error) {
        next(error);
      }
    },
  );

  // POST /api/v1/agents/disputes/:disputeId/resolve
  router.post(
    '/:disputeId/resolve',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = resolveSchema.parse(req.body);
        const user = (req as any).user!;
        const resolved = await service.resolveDispute({
          disputeId: req.params.disputeId,
          resolvedBy: user.id,
          ...body,
        });
        res.json({ success: true, data: resolved });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
