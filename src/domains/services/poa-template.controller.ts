// Story 13-5: POA Template Generation Controller
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PoaTemplateService } from './poa-template.service.js';

const generatePoaSchema = z.object({
  serviceRequestId: z.string().uuid().optional(),
  attorneyName: z.string().min(2),
  attorneyAddress: z.string().min(5),
  attorneyPhone: z.string().min(10),
  scopeOfAuthority: z.array(z.string()),
  serviceType: z.enum(['mutation', 'registry', 'tax_payment', 'general']),
  validityStartDate: z.string().datetime(),
  validityEndDate: z.string().datetime(),
});

export function poaTemplateRoutes(service: PoaTemplateService): Router {
  const router = Router();

  // POST /api/v1/poa/generate
  router.post(
    '/generate',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = generatePoaSchema.parse(req.body);
        const result = await service.generatePoa({
          ...body,
          validityStartDate: new Date(body.validityStartDate),
          validityEndDate: new Date(body.validityEndDate),
          customerId: (req as any).user!.id,
          cityId: (req as any).user!.cityId,
        });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/poa/my-poas
  router.get(
    '/my-poas',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const poas = await service.getCustomerPoas(
          (req as any).user!.id
        );
        res.json({ success: true, data: poas });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
