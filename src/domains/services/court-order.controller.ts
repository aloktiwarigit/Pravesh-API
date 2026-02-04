// Story 13-11: Court Order Upload & Delivery Controller
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CourtOrderService } from './court-order.service.js';

export function courtOrderRoutes(
  service: CourtOrderService
): Router {
  const router = Router();

  // POST /api/v1/court-orders/upload
  router.post(
    '/upload',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z
          .object({
            serviceRequestId: z.string().uuid(),
            hearingId: z.string().uuid().optional(),
            caseNumber: z.string(),
            orderDate: z.string().datetime(),
            orderType: z.enum([
              'interim',
              'final',
              'dismissal',
              'appeal_allowed',
            ]),
            outcome: z.enum(['favorable', 'adverse', 'partial']),
            documentUrl: z.string(),
            summary: z.string().optional(),
          })
          .parse(req.body);
        const result = await service.uploadCourtOrder({
          ...body,
          orderDate: new Date(body.orderDate),
          uploadedByUserId: (req as any).user!.id,
          cityId: (req as any).user!.cityId,
        });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/court-orders/customer-decision
  router.post(
    '/customer-decision',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z
          .object({
            courtOrderId: z.string().uuid(),
            decision: z.enum(['appeal', 'close_case']),
          })
          .parse(req.body);
        const result = await service.recordCustomerDecision({
          ...body,
          customerId: (req as any).user!.id,
        });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/court-orders/service/:serviceRequestId
  router.get(
    '/service/:serviceRequestId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const orders = await service.getOrdersForService(
          req.params.serviceRequestId
        );
        res.json({ success: true, data: orders });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
