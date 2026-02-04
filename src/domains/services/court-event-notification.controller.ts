// Story 13-12: Court Case Progress Notifications Controller
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CourtEventNotificationService } from './court-event-notification.service.js';

export function courtEventRoutes(
  service: CourtEventNotificationService
): Router {
  const router = Router();

  // POST /api/v1/court-events/record
  router.post(
    '/record',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z
          .object({
            serviceRequestId: z.string().uuid(),
            caseNumber: z.string(),
            eventType: z.string(),
            eventDate: z.string().datetime(),
            description: z.string(),
            nextAction: z.string().optional(),
            isMilestone: z.boolean().optional(),
          })
          .parse(req.body);
        const result = await service.recordAndNotify({
          ...body,
          eventDate: new Date(body.eventDate),
          createdByUserId: (req as any).user!.id,
        });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/court-events/custom-update
  router.post(
    '/custom-update',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z
          .object({
            serviceRequestId: z.string().uuid(),
            message: z.string().min(1),
          })
          .parse(req.body);
        const result = await service.sendCustomUpdate({
          ...body,
          agentId: (req as any).user!.id,
        });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/court-events/history/:serviceRequestId
  router.get(
    '/history/:serviceRequestId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const events = await service.getEventHistory(
          req.params.serviceRequestId
        );
        res.json({ success: true, data: events });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
