import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { FeatureUsageService } from './feature-usage.service';
import { authorize } from '../../middleware/authorize';

/**
 * Story 14-12: Feature Usage Tracking Controller
 * Provides endpoints for tracking events and viewing adoption dashboards.
 */
export function createFeatureUsageController(service: FeatureUsageService): Router {
  const router = Router();

  // POST /api/v1/feature-usage/track — Track event (requires authentication)
  router.post(
    '/track',
    authorize('super_admin', 'ops_manager', 'franchise_owner', 'support', 'agent', 'customer', 'lawyer', 'system'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z.object({
          eventName: z.string().min(1).max(100),
          metadata: z.record(z.string(), z.any()).optional(),
        }).parse(req.body);

        const event = await service.trackEvent({
          eventName: body.eventName,
          userId: req.user?.id,
          userRole: req.user?.role,
          cityId: req.user?.cityId,
          metadata: body.metadata,
        });
        res.status(201).json({ success: true, data: event });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/feature-usage/adoption — Feature adoption dashboard (AC5)
  router.get(
    '/adoption',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const dateRange = req.query.start && req.query.end
          ? { start: req.query.start as string, end: req.query.end as string }
          : undefined;
        const adoption = await service.getFeatureAdoption(dateRange);
        res.json({ success: true, data: adoption });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/feature-usage/:eventName/by-role — Usage by role (AC9)
  router.get(
    '/:eventName/by-role',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const data = await service.getUsageByRole(req.params.eventName);
        res.json({ success: true, data });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/feature-usage/:eventName/by-city — Usage by city
  router.get(
    '/:eventName/by-city',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const data = await service.getUsageByCity(req.params.eventName);
        res.json({ success: true, data });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/feature-usage/:eventName/trend — Daily usage trend
  router.get(
    '/:eventName/trend',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const days = parseInt(req.query.days as string || '30', 10);
        const data = await service.getDailyUsageTrend(req.params.eventName, days);
        res.json({ success: true, data });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
