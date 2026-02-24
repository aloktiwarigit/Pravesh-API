import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authorize } from '../../middleware/authorize';
import { CustomerDashboardService } from './customer-dashboard.service';

export function createCustomerDashboardController(
  prisma: PrismaClient,
): Router {
  const router = Router();
  const service = new CustomerDashboardService(prisma);

  // GET /api/v1/customers/me/dashboard
  router.get(
    '/',
    authorize('customer'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user!;
        const data = await service.getDashboard(user.id);
        res.json({ success: true, data });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
