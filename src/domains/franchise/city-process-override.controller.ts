import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CityProcessOverrideService } from './city-process-override.service';
import { customStepsSchema, conditionalRuleSchema } from './franchise.types';
import { authorize } from '../../middleware/authorize';

const createOverrideSchema = z.object({
  cityId: z.string().uuid(),
  serviceDefinitionId: z.string().uuid(),
  customSteps: customStepsSchema,
  conditionalRules: z.array(conditionalRuleSchema).optional(),
});

export function createCityProcessOverrideController(service: CityProcessOverrideService): Router {
  const router = Router();

  // POST /api/v1/city-process-overrides — Create process override
  router.post(
    '/',
    authorize('franchise_owner', 'super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = createOverrideSchema.parse(req.body);
        const override = await service.createProcessOverride({
          ...body,
          createdBy: req.user!.id,
        });
        res.status(201).json({ success: true, data: override });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/city-process-overrides/:cityId — List overrides for a city
  router.get(
    '/:cityId',
    authorize('franchise_owner', 'super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const overrides = await service.listProcessOverrides(req.params.cityId);
        res.json({ success: true, data: overrides });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/city-process-overrides/pending-approvals — List pending (Super Admin)
  router.get(
    '/pending-approvals',
    authorize('super_admin'),
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const pending = await service.listPendingApprovals();
        res.json({ success: true, data: pending });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/city-process-overrides/:id/approve — Approve (Super Admin)
  router.post(
    '/:id/approve',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const override = await service.approveProcessOverride(req.params.id, req.user!.id);
        res.json({ success: true, data: override });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/city-process-overrides/:id/reject — Reject (Super Admin)
  router.post(
    '/:id/reject',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { reason } = z.object({ reason: z.string().min(5) }).parse(req.body);
        const override = await service.rejectProcessOverride(req.params.id, req.user!.id, reason);
        res.json({ success: true, data: override });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/city-process-overrides/steps — Get process steps with context
  router.post(
    '/steps',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z.object({
          cityId: z.string().uuid(),
          serviceDefinitionId: z.string().uuid(),
          context: z.record(z.string(), z.string()).optional(),
        }).parse(req.body);

        const steps = await service.getProcessSteps(
          body.cityId,
          body.serviceDefinitionId,
          body.context
        );
        res.json({ success: true, data: steps });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
