// Story 13-9: Court Hearing Date Tracking Controller
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CourtHearingService } from './court-hearing.service.js';

const addHearingSchema = z.object({
  serviceRequestId: z.string().uuid(),
  caseNumber: z.string().min(1),
  hearingDate: z.string().datetime(),
  courtName: z.string().min(1),
  courtAddress: z.string().optional(),
  hearingType: z.enum([
    'preliminary',
    'regular',
    'final',
    'adjournment',
  ]),
  notes: z.string().optional(),
});

export function courtHearingRoutes(
  service: CourtHearingService
): Router {
  const router = Router();

  // POST /api/v1/court-hearings
  router.post(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = addHearingSchema.parse(req.body);
        const result = await service.addHearing({
          ...body,
          hearingDate: new Date(body.hearingDate),
          createdByUserId: (req as any).user!.id,
          cityId: (req as any).user!.cityId,
        });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/court-hearings/service/:serviceRequestId
  router.get(
    '/service/:serviceRequestId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const hearings = await service.getHearingsForService(
          req.params.serviceRequestId
        );
        res.json({ success: true, data: hearings });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/court-hearings/upcoming
  router.get(
    '/upcoming',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const hearings = await service.getUpcomingHearings(
          (req as any).user!.cityId
        );
        res.json({ success: true, data: hearings });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/court-hearings/:hearingId/calendar
  router.get(
    '/:hearingId/calendar',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const ics = await service.generateCalendarEvent(
          req.params.hearingId
        );
        res.setHeader('Content-Type', 'text/calendar');
        res.setHeader(
          'Content-Disposition',
          'attachment; filename=hearing.ics'
        );
        res.send(ics);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
