// Story 13-6: Embassy/Consulate POA Execution Tracking Controller
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PoaExecutionService } from './poa-execution.service.js';
import { INDIAN_EMBASSIES } from './embassy-data.config.js';

export function poaExecutionRoutes(
  service: PoaExecutionService
): Router {
  const router = Router();

  // GET /api/v1/poa/execution/embassies
  router.get(
    '/embassies',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const country = req.query.country as string;
        const embassies = country
          ? INDIAN_EMBASSIES.filter((e) => e.country === country)
          : INDIAN_EMBASSIES;
        res.json({ success: true, data: embassies });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/poa/execution/update-status
  router.post(
    '/update-status',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z
          .object({
            poaDocumentId: z.string().uuid(),
            status: z.enum([
              'appointment_booked',
              'documents_submitted',
              'notarization_pending',
              'poa_received',
              'uploaded',
            ]),
            notes: z.string().optional(),
            embassyName: z.string().optional(),
            embassyCity: z.string().optional(),
            embassyCountry: z.string().optional(),
            appointmentDate: z.string().datetime().optional(),
          })
          .parse(req.body);
        const result = await service.updateExecutionStatus({
          ...body,
          appointmentDate: body.appointmentDate
            ? new Date(body.appointmentDate)
            : undefined,
        });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/poa/execution/timeline/:poaDocumentId
  router.get(
    '/timeline/:poaDocumentId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const timeline = await service.getExecutionTimeline(
          req.params.poaDocumentId
        );
        res.json({ success: true, data: timeline });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
