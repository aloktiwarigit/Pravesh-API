import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CityServiceFeeService } from './city-service-fee.service';
import { feeConfigSchema } from './franchise.types';
import { authorize } from '../../middleware/authorize';

const createFeeScheduleSchema = z.object({
  cityId: z.string().uuid(),
  serviceDefinitionId: z.string().uuid(),
  feeConfig: feeConfigSchema,
  effectiveFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}/),
  effectiveTo: z.string().regex(/^\d{4}-\d{2}-\d{2}/).optional(),
});

const calculateFeeSchema = z.object({
  cityId: z.string().uuid(),
  serviceDefinitionId: z.string().uuid(),
  propertyValuePaise: z.number().int().min(0),
});

export function createCityServiceFeeController(service: CityServiceFeeService): Router {
  const router = Router();

  // POST /api/v1/city-service-fees — Create fee schedule (Franchise Owner, Super Admin)
  router.post(
    '/',
    authorize('franchise_owner', 'super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = createFeeScheduleSchema.parse(req.body);
        const fee = await service.createFeeSchedule({
          ...body,
          createdBy: req.user!.id,
        });
        res.status(201).json({ success: true, data: fee });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/city-service-fees/:cityId — List fee schedules for a city
  router.get(
    '/:cityId',
    authorize('franchise_owner', 'super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const fees = await service.listFeeSchedules(req.params.cityId);
        res.json({ success: true, data: fees });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/city-service-fees/calculate — Calculate fee for a service (any authenticated user)
  router.post(
    '/calculate',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = calculateFeeSchema.parse(req.body);
        const calculation = await service.calculateFee(
          body.cityId,
          body.serviceDefinitionId,
          body.propertyValuePaise
        );
        res.json({ success: true, data: calculation });
      } catch (error) {
        next(error);
      }
    }
  );

  // PATCH /api/v1/city-service-fees/:id/deactivate — Deactivate fee schedule
  router.patch(
    '/:id/deactivate',
    authorize('franchise_owner', 'super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const fee = await service.deactivateFeeSchedule(req.params.id);
        res.json({ success: true, data: fee });
      } catch (error) {
        next(error);
      }
    }
  );

  // PUT /api/v1/city-service-fees/:id/override — Super Admin override
  router.put(
    '/:id/override',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z.object({ feeConfig: feeConfigSchema }).parse(req.body);
        const fee = await service.overrideFeeSchedule(
          req.params.id,
          body.feeConfig,
          req.user!.id
        );
        res.json({ success: true, data: fee });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
