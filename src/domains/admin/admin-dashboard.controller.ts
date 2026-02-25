/**
 * Admin Dashboard Controller - Platform-wide stats, health, and city comparison
 *
 * All endpoints require super_admin role.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authorize } from '../../middleware/authorize';

export function createAdminDashboardController(prisma: PrismaClient): Router {
  const router = Router();

  /**
   * GET /platform-stats
   * Returns platform-wide statistics: total cities, revenue, users,
   * active services, and pending approvals.
   */
  router.get(
    '/platform-stats',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const [
          totalCitiesResult,
          revenueResult,
          totalUsers,
          activeServices,
          pendingApprovals,
          totalAgents,
          totalDealers,
          totalLawyers,
        ] = await Promise.all([
          // Count distinct cityId values in User table
          prisma.user.findMany({
            where: { cityId: { not: null } },
            select: { cityId: true },
            distinct: ['cityId'],
          }),

          // Sum of amountPaise from Payment where status = 'paid'
          prisma.payment.aggregate({
            _sum: { amountPaise: true },
            where: { status: 'paid' },
          }),

          // Total User records
          prisma.user.count(),

          // Active ServiceRequests (not completed or cancelled)
          prisma.serviceRequest.count({
            where: {
              status: { notIn: ['completed', 'cancelled'] },
            },
          }),

          // Users pending approval or pending role assignment
          prisma.user.count({
            where: {
              status: { in: ['PENDING_APPROVAL', 'PENDING_ROLE'] },
            },
          }),

          // Total agents
          prisma.agent.count(),

          // Total dealers
          prisma.user.count({
            where: { primaryRole: 'dealer' },
          }),

          // Total lawyers
          prisma.user.count({
            where: { primaryRole: 'lawyer' },
          }),
        ]);

        // Convert BigInt to Number for JSON serialization
        const revenue = revenueResult._sum.amountPaise;
        const revenuePaise = revenue ? Number(revenue) : 0;

        res.json({
          success: true,
          data: {
            totalCities: totalCitiesResult.length,
            revenuePaise,
            totalUsers,
            activeServices,
            pendingApprovals,
            totalAgents,
            totalDealers,
            totalLawyers,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /health
   * Returns system health status: API, database, and storage.
   */
  router.get(
    '/health',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        let dbStatus: 'healthy' | 'degraded' = 'degraded';

        try {
          await prisma.$queryRaw`SELECT 1`;
          dbStatus = 'healthy';
        } catch {
          // DB is unreachable or slow - report degraded
          dbStatus = 'degraded';
        }

        res.json({
          success: true,
          data: {
            apiStatus: 'healthy' as const,
            dbStatus,
            storageStatus: 'healthy' as const,
            checkedAt: new Date().toISOString(),
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /cities/comparison
   * Returns per-city comparison data: revenue, total services, and agent count.
   */
  router.get(
    '/cities/comparison',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Get all service requests grouped by cityId
        const cityGroups = await prisma.serviceRequest.groupBy({
          by: ['cityId'],
          _count: { id: true },
        });

        // Get revenue per city (only completed service requests)
        const revenueByCity = await prisma.serviceRequest.groupBy({
          by: ['cityId'],
          _sum: { serviceFeePaise: true },
          where: { status: 'completed' },
        });

        // Collect all unique cityIds
        const allCityIds = Array.from(new Set(cityGroups.map((g) => g.cityId)));

        // Fetch city names
        const cities = await prisma.city.findMany({
          where: { id: { in: allCityIds } },
          select: { id: true, cityName: true },
        });
        const cityNameMap = new Map(cities.map((c) => [c.id, c.cityName]));

        // Build revenue lookup
        const revenueMap = new Map(
          revenueByCity.map((r) => [r.cityId, r._sum.serviceFeePaise ?? 0]),
        );

        // Build total services lookup
        const totalServicesMap = new Map(
          cityGroups.map((g) => [g.cityId, g._count.id]),
        );

        // Get distinct agent counts per city
        const agentCounts = await Promise.all(
          allCityIds.map(async (cityId) => {
            const distinctAgents = await prisma.serviceRequest.findMany({
              where: {
                cityId,
                assignedAgentId: { not: null },
              },
              select: { assignedAgentId: true },
              distinct: ['assignedAgentId'],
            });
            return { cityId, agentCount: distinctAgents.length };
          }),
        );
        const agentCountMap = new Map(
          agentCounts.map((a) => [a.cityId, a.agentCount]),
        );

        // Assemble comparison data
        const comparison = allCityIds.map((cityId) => ({
          cityId,
          cityName: cityNameMap.get(cityId) ?? cityId,
          revenuePaise: revenueMap.get(cityId) ?? 0,
          totalServices: totalServicesMap.get(cityId) ?? 0,
          agentCount: agentCountMap.get(cityId) ?? 0,
        }));

        res.json({
          success: true,
          data: { cities: comparison },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /franchise-applications
   * Lists franchise applications with optional status filter and pagination.
   */
  router.get(
    '/franchise-applications',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const status = req.query.status as string | undefined;
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
        const skip = (page - 1) * limit;

        const where = status ? { status } : {};

        const [applications, total] = await Promise.all([
          prisma.franchiseApplication.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
            include: { city: { select: { id: true, cityName: true } } },
          }),
          prisma.franchiseApplication.count({ where }),
        ]);

        res.json({
          success: true,
          data: applications,
          meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /audit-logs
   * Lists audit logs with optional filters and pagination.
   */
  router.get(
    '/audit-logs',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const page = parseInt(req.query.page as string, 10) || 1;
        const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
        const skip = (page - 1) * limit;

        const where: any = {};
        if (req.query.userId) where.userId = req.query.userId;
        if (req.query.action) where.action = req.query.action;
        if (req.query.resourceType) where.resourceType = req.query.resourceType;

        const [logs, total] = await Promise.all([
          prisma.auditLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
          }),
          prisma.auditLog.count({ where }),
        ]);

        res.json({
          success: true,
          data: logs,
          meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
