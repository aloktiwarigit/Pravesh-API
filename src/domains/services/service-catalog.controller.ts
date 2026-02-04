import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

export function createServiceCatalogController(prisma: PrismaClient): Router {
  const router = Router();

  // GET /api/v1/services/catalog — List active service definitions
  router.get(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const category = req.query.category as string | undefined;
        const cityId = req.query.cityId as string | undefined;

        const where: any = { isActive: true };
        if (category) where.category = category;
        if (cityId) where.cityId = cityId;

        const definitions = await prisma.serviceDefinition.findMany({
          where,
          orderBy: [{ category: 'asc' }, { name: 'asc' }],
        });

        const catalog = definitions.map((d) => {
          const def = d.definition as any;
          return {
            id: d.id,
            code: d.code,
            name: d.name,
            category: d.category,
            estimatedDaysTotal: def?.estimatedDaysTotal,
            estimatedFees: def?.estimatedFees,
            tags: def?.tags || [],
          };
        });

        res.json({ success: true, data: catalog });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /api/v1/services/catalog/:serviceCode — Get service details by code
  router.get(
    '/:serviceCode',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const definition = await prisma.serviceDefinition.findFirst({
          where: { code: req.params.serviceCode, isActive: true },
        });

        if (!definition) {
          res.status(404).json({
            success: false,
            error: { code: 'SERVICE_NOT_FOUND', message: 'Service not found' },
          });
          return;
        }

        res.json({
          success: true,
          data: {
            id: definition.id,
            code: definition.code,
            name: definition.name,
            category: definition.category,
            definition: definition.definition,
            version: definition.version,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
