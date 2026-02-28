/**
 * Ops Service Requests Controller
 * GET /api/v1/ops/service-requests — paginated listing for ops managers
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { authorize } from '../../middleware/authorize';

const querySchema = z.object({
  status: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export function createOpsServiceRequestsController(prisma: PrismaClient): Router {
  const router = Router();

  /**
   * GET /api/v1/ops/service-requests
   * Roles: ops_manager (scoped to cityId), super_admin (all)
   */
  router.get(
    '/',
    authorize('ops_manager', 'super_admin'),
    async (req, res, next) => {
      try {
        const { status, page, limit } = querySchema.parse(req.query);
        const user = (req as any).user!;
        const skip = (page - 1) * limit;

        const where: any = {};

        // ops_manager sees own city only; super_admin sees all
        if (user.role !== 'super_admin' && user.cityId) {
          where.cityId = user.cityId;
        }

        if (status) {
          where.status = status;
        }

        const [requests, total] = await Promise.all([
          prisma.serviceRequest.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            include: {
              serviceInstance: {
                select: {
                  propertyType: true,
                  propertyAddress: true,
                  propertyLat: true,
                  propertyLng: true,
                },
              },
            },
          }),
          prisma.serviceRequest.count({ where }),
        ]);

        const data = requests.map((r) => ({
          id: r.id,
          requestNumber: r.requestNumber,
          status: r.status,
          customerName: r.customerName,
          customerPhone: r.customerPhone,
          serviceName: r.serviceName,
          serviceCode: r.serviceCode,
          propertyAddress: r.propertyAddress ?? r.serviceInstance?.propertyAddress,
          assignedAgentId: r.assignedAgentId,
          propertyType: r.serviceInstance?.propertyType ?? null,
          propertyLat: r.serviceInstance?.propertyLat ?? null,
          propertyLng: r.serviceInstance?.propertyLng ?? null,
          serviceFeePaise: r.serviceFeePaise,
          createdAt: r.createdAt,
          updatedAt: r.updatedAt,
        }));

        res.json({
          success: true,
          data,
          meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
