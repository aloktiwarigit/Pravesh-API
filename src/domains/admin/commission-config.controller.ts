import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authorize } from '../../middleware/authorize';
import { validate } from '../../middleware/validate';
import { CommissionConfigService } from './commission-config.service';
import { upsertCommissionConfigSchema } from './commission-config.validation';

export function createCommissionConfigController(prisma: PrismaClient): Router {
  const router = Router();
  const service = new CommissionConfigService(prisma);

  // GET /api/v1/admin/commission-config — list all configs
  router.get(
    '/',
    authorize('super_admin'),
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const configs = await service.list();
        res.json({ success: true, data: configs });
      } catch (error) {
        next(error);
      }
    },
  );

  // PUT /api/v1/admin/commission-config — upsert a config
  router.put(
    '/',
    authorize('super_admin'),
    validate(upsertCommissionConfigSchema, 'body'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const config = await service.upsert(req.body, req.user?.id);
        res.json({ success: true, data: config });
      } catch (error) {
        next(error);
      }
    },
  );

  // DELETE /api/v1/admin/commission-config/:id — remove a config
  router.delete(
    '/:id',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await service.remove(req.params.id);
        res.json({ success: true, data: { deleted: true } });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
