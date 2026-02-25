import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

export function createPackagesController(prisma: PrismaClient): Router {
  const router = Router();

  // GET /api/v1/packages — list all active packages
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const packages = await prisma.package.findMany({
        where: { isActive: true },
        include: {
          packageItems: {
            include: {
              serviceDefinition: {
                select: { id: true, code: true, name: true },
              },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ success: true, data: packages });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/packages/:id — package detail
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const pkg = await prisma.package.findUnique({
        where: { id: req.params.id },
        include: {
          packageItems: {
            include: {
              serviceDefinition: {
                select: { id: true, code: true, name: true, category: true },
              },
            },
            orderBy: { sortOrder: 'asc' },
          },
        },
      });

      if (!pkg) {
        return res.status(404).json({
          success: false,
          error: { code: 'PACKAGE_NOT_FOUND', message: 'Package not found' },
        });
      }

      res.json({ success: true, data: pkg });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
