import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CityService } from './city.service';
import { cityConfigSchema } from './franchise.types';
import { authorize } from '../../middleware/authorize';

const createCitySchema = z.object({
  cityName: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  configData: cityConfigSchema,
});

const updateCityConfigSchema = z.object({
  configData: cityConfigSchema,
});

export function createCityController(service: CityService): Router {
  const router = Router();

  // POST /api/v1/cities — Create new city (Super Admin only) (AC1, AC2, AC3)
  router.post(
    '/',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = createCitySchema.parse(req.body);
        const city = await service.createCity({
          ...body,
          createdBy: req.user!.id,
        });
        res.status(201).json({ success: true, data: city });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/cities — List active cities (AC4)
  router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const cities = await service.listActiveCities();
      res.json({ success: true, data: cities });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/cities/all — List all cities including inactive (Super Admin only)
  router.get(
    '/all',
    authorize('super_admin'),
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const cities = await service.listAllCities();
        res.json({ success: true, data: cities });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/cities/:id — Get city config (AC6)
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const city = await service.getCityConfig(req.params.id);
      res.json({ success: true, data: city });
    } catch (error) {
      next(error);
    }
  });

  // PUT /api/v1/cities/:id/config — Update city config (Super Admin only) (AC6, AC7)
  router.put(
    '/:id/config',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = updateCityConfigSchema.parse(req.body);
        const city = await service.updateCityConfig(req.params.id, body.configData);
        res.json({ success: true, data: city });
      } catch (error) {
        next(error);
      }
    }
  );

  // PATCH /api/v1/cities/:id/deactivate — Deactivate city (Super Admin only)
  router.patch(
    '/:id/deactivate',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const city = await service.deactivateCity(req.params.id);
        res.json({ success: true, data: city });
      } catch (error) {
        next(error);
      }
    }
  );

  // PATCH /api/v1/cities/:id/activate — Activate city (Super Admin only)
  router.patch(
    '/:id/activate',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const city = await service.activateCity(req.params.id);
        res.json({ success: true, data: city });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
