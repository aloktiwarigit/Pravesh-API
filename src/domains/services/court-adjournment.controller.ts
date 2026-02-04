// Story 13-10: Court Adjournment Tracking Controller
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CourtAdjournmentService } from './court-adjournment.service.js';

export function courtAdjournmentRoutes(
  service: CourtAdjournmentService
): Router {
  const router = Router();

  // POST /api/v1/court-hearings/adjournments/adjourn
  router.post(
    '/adjourn',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z
          .object({
            hearingId: z.string().uuid(),
            newHearingDate: z.string().datetime(),
            adjournmentReason: z.string().min(1),
            notes: z.string().optional(),
          })
          .parse(req.body);
        const result = await service.recordAdjournment({
          ...body,
          newHearingDate: new Date(body.newHearingDate),
          agentId: (req as any).user!.id,
        });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/court-hearings/adjournments/history/:serviceRequestId
  router.get(
    '/history/:serviceRequestId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const result = await service.getAdjournmentHistory(
          req.params.serviceRequestId
        );
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
