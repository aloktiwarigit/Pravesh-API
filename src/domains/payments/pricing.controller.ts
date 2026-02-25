/**
 * Pricing Controller — HTTP endpoints for pricing calculation.
 *
 * Story 4.4: Dynamic Pricing by Property Value Slabs
 */
import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { PricingService } from './pricing.service';
import { calculatePricingSchema, getSlabsQuerySchema } from './pricing.validation';

export function createPricingController(prisma: PrismaClient): Router {
  const router = Router();
  const pricingService = new PricingService(prisma);

  /**
   * GET /api/v1/pricing/calculate?serviceId=X&propertyValuePaise=Y&cityId=Z
   * Calculates service fee based on property value slab.
   */
  router.get('/calculate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user!;
      const input = calculatePricingSchema.parse({
        serviceId: req.query.service_id || req.query.serviceId,
        propertyValuePaise: req.query.property_value_paise || req.query.propertyValuePaise,
        cityId: req.query.city_id || req.query.cityId || user.cityId,
      });

      const result = await pricingService.calculateServiceFee({
        serviceId: input.serviceId,
        propertyValuePaise: Number(input.propertyValuePaise),
        cityId: input.cityId,
      });

      res.json({
        success: true,
        data: {
          serviceFeePaise: result.serviceFeePaise.toString(),
          slabId: result.slabId,
          slabName: result.slabName,
          isBaseFee: result.isBaseFee,
        },
      });
    } catch (err) {
      next(err);
    }
  });

  /**
   * GET /api/v1/pricing/slabs?serviceId=X&cityId=Y
   * Gets all pricing slabs for a service in a city.
   */
  router.get('/slabs', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user!;
      const input = getSlabsQuerySchema.parse({
        serviceId: req.query.service_id || req.query.serviceId,
        cityId: req.query.city_id || req.query.cityId || user.cityId,
      });

      const slabs = await pricingService.getSlabs(input.serviceId, input.cityId);

      res.json({ success: true, data: slabs });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
