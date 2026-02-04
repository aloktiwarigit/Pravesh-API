// Story 13-13: Video Consultation Booking Controller
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ConsultationService } from './consultation.service.js';

export function consultationRoutes(
  service: ConsultationService
): Router {
  const router = Router();

  // GET /api/v1/consultations/available-slots
  router.get(
    '/available-slots',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const query = z
          .object({
            consultantId: z.string().uuid(),
            date: z.string(),
            customerTimezone: z.string(),
          })
          .parse(req.query);
        const slots = await service.getAvailableSlots({
          ...query,
          date: new Date(query.date),
        });
        res.json({ success: true, data: slots });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/consultations/book
  router.post(
    '/book',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z
          .object({
            serviceRequestId: z.string().uuid().optional(),
            consultantId: z.string().uuid(),
            consultantType: z.enum(['agent', 'lawyer']),
            scheduledAtUtc: z.string().datetime(),
            customerTimezone: z.string(),
          })
          .parse(req.body);
        const result = await service.bookConsultation({
          ...body,
          scheduledAtUtc: new Date(body.scheduledAtUtc),
          customerId: (req as any).user!.id,
          cityId: (req as any).user!.cityId,
        });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/consultations/reschedule
  router.post(
    '/reschedule',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z
          .object({
            consultationId: z.string().uuid(),
            newScheduledAtUtc: z.string().datetime(),
          })
          .parse(req.body);
        const result = await service.reschedule({
          ...body,
          newScheduledAtUtc: new Date(body.newScheduledAtUtc),
          rescheduledByUserId: (req as any).user!.id,
        });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
