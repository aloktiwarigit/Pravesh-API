import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DealerManagementService } from './dealer-management.service';
import { dealerTierConfigSchema } from './franchise.types';
import { authorize } from '../../middleware/authorize';
import { cityScope, cityScopeByEntity } from '../../middleware/city-scope';

const createDealerSchema = z.object({
  userId: z.string(),
  cityId: z.string().uuid(),
  name: z.string().min(2).max(200),
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/),
  email: z.string().email().optional(),
  kycDocuments: z.record(z.string(), z.any()).optional(),
});

const dealerCityLookup = (service: DealerManagementService) =>
  async (entityId: string) => {
    const dealer = await service.getDealer(entityId);
    return dealer?.cityId;
  };

export function createDealerManagementController(service: DealerManagementService): Router {
  const router = Router();

  // POST /api/v1/franchise-dealers — Create dealer
  router.post(
    '/',
    authorize('franchise_owner', 'super_admin'),
    cityScope({ bodyField: 'cityId' }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = createDealerSchema.parse(req.body);
        const dealer = await service.createDealer(body);
        res.status(201).json({ success: true, data: dealer });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/franchise-dealers/:cityId — List dealers for city
  router.get(
    '/:cityId',
    authorize('franchise_owner', 'super_admin'),
    cityScope(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const dealers = await service.listDealers(req.params.cityId, {
          isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
          tier: req.query.tier as string,
          kycStatus: req.query.kycStatus as string,
        });
        res.json({ success: true, data: dealers });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/franchise-dealers/detail/:id — Get dealer details
  router.get(
    '/detail/:id',
    authorize('franchise_owner', 'super_admin'),
    cityScopeByEntity(dealerCityLookup(service)),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const dealer = await service.getDealer(req.params.id);
        res.json({ success: true, data: dealer });
      } catch (error) {
        next(error);
      }
    }
  );

  // PATCH /api/v1/franchise-dealers/:id/kyc — Update KYC status
  router.patch(
    '/:id/kyc',
    authorize('franchise_owner', 'super_admin'),
    cityScopeByEntity(dealerCityLookup(service)),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z.object({
          status: z.enum(['approved', 'rejected']),
          notes: z.string().optional(),
        }).parse(req.body);
        const dealer = await service.updateKycStatus(req.params.id, body.status, body.notes);
        res.json({ success: true, data: dealer });
      } catch (error) {
        next(error);
      }
    }
  );

  // PATCH /api/v1/franchise-dealers/:id/tier — Update commission tier
  router.patch(
    '/:id/tier',
    authorize('franchise_owner', 'super_admin'),
    cityScopeByEntity(dealerCityLookup(service)),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z.object({ tier: z.enum(['BRONZE', 'SILVER', 'GOLD']) }).parse(req.body);
        const dealer = await service.updateTier(req.params.id, body.tier);
        res.json({ success: true, data: dealer });
      } catch (error) {
        next(error);
      }
    }
  );

  // PUT /api/v1/franchise-dealers/:id/tier-config — Set tier config
  router.put(
    '/:id/tier-config',
    authorize('franchise_owner', 'super_admin'),
    cityScopeByEntity(dealerCityLookup(service)),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z.object({ tierConfig: dealerTierConfigSchema }).parse(req.body);
        const dealer = await service.setTierConfig(req.params.id, body.tierConfig);
        res.json({ success: true, data: dealer });
      } catch (error) {
        next(error);
      }
    }
  );

  // PATCH /api/v1/franchise-dealers/:id/deactivate — Deactivate dealer
  router.patch(
    '/:id/deactivate',
    authorize('franchise_owner', 'super_admin'),
    cityScopeByEntity(dealerCityLookup(service)),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z.object({ reason: z.string().min(5) }).parse(req.body);
        const dealer = await service.deactivateDealer(req.params.id, body.reason);
        res.json({ success: true, data: dealer });
      } catch (error) {
        next(error);
      }
    }
  );

  // PATCH /api/v1/franchise-dealers/:id/activate — Activate dealer
  router.patch(
    '/:id/activate',
    authorize('franchise_owner', 'super_admin'),
    cityScopeByEntity(dealerCityLookup(service)),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const dealer = await service.activateDealer(req.params.id);
        res.json({ success: true, data: dealer });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
