/**
 * Ops Dashboard Controller - HTTP endpoints for operational metrics
 *
 * Story 5.1: Unified Operational Dashboard
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { DashboardService } from './dashboard.service';
import { authorize } from '../../middleware/authorize';

const dateRangeSchema = z.object({
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

export function createDashboardController(prisma: PrismaClient): Router {
  const router = Router();
  const dashboardService = new DashboardService(prisma);

  /**
   * GET /api/v1/ops/dashboard
   * Get full dashboard summary.
   * Roles: ops_manager, super_admin
   */
  router.get(
    '/',
    authorize('ops_manager', 'super_admin'),
    async (req, res, next) => {
      try {
        const { startDate, endDate } = dateRangeSchema.parse(req.query);
        const user = (req as any).user!;
        const cityId = user.role === 'super_admin' ? undefined : user.cityId;

        const dateRange = startDate && endDate ? { startDate, endDate } : undefined;
        const summary = await dashboardService.getDashboardSummary(cityId, dateRange);

        // Convert BigInt to string for JSON serialization
        const serialized = {
          ...summary,
          payments: {
            ...summary.payments,
            totalCollected: summary.payments.totalCollected.toString(),
            pending: summary.payments.pending.toString(),
            refunded: summary.payments.refunded.toString(),
          },
        };

        res.json({ success: true, data: serialized });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/ops/dashboard/services
   * Get service metrics breakdown.
   * Roles: ops_manager, super_admin
   */
  router.get(
    '/services',
    authorize('ops_manager', 'super_admin'),
    async (req, res, next) => {
      try {
        const { startDate, endDate } = dateRangeSchema.parse(req.query);
        const user = (req as any).user!;
        const cityId = user.role === 'super_admin' ? undefined : user.cityId;

        const dateRange = startDate && endDate ? { startDate, endDate } : undefined;
        const [metrics, breakdown] = await Promise.all([
          dashboardService.getServiceMetrics(cityId, dateRange),
          dashboardService.getServiceBreakdown(cityId),
        ]);

        res.json({ success: true, data: { metrics, breakdown } });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/ops/dashboard/agents
   * Get agent performance metrics.
   * Roles: ops_manager, super_admin
   */
  router.get(
    '/agents',
    authorize('ops_manager', 'super_admin'),
    async (req, res, next) => {
      try {
        const { startDate, endDate } = dateRangeSchema.parse(req.query);
        const user = (req as any).user!;
        const cityId = user.role === 'super_admin' ? undefined : user.cityId;

        const dateRange = startDate && endDate ? { startDate, endDate } : undefined;
        const [metrics, leaderboard] = await Promise.all([
          dashboardService.getAgentMetrics(cityId, dateRange),
          dashboardService.getAgentLeaderboard(cityId),
        ]);

        res.json({ success: true, data: { metrics, leaderboard } });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/ops/dashboard/lawyers
   * Get lawyer workload metrics.
   * Roles: ops_manager, super_admin
   */
  router.get(
    '/lawyers',
    authorize('ops_manager', 'super_admin'),
    async (req, res, next) => {
      try {
        const { startDate, endDate } = dateRangeSchema.parse(req.query);
        const user = (req as any).user!;
        const cityId = user.role === 'super_admin' ? undefined : user.cityId;

        const dateRange = startDate && endDate ? { startDate, endDate } : undefined;
        const metrics = await dashboardService.getLawyerMetrics(cityId, dateRange);

        res.json({ success: true, data: metrics });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/ops/dashboard/sla-alerts
   * Get SLA alerts for at-risk and breached services.
   * Roles: ops_manager, super_admin
   */
  router.get(
    '/sla-alerts',
    authorize('ops_manager', 'super_admin'),
    async (req, res, next) => {
      try {
        const limit = parseInt(req.query.limit as string) || 20;
        const user = (req as any).user!;
        const cityId = user.role === 'super_admin' ? undefined : user.cityId;

        const alerts = await dashboardService.getSlaAlerts(cityId, limit);

        res.json({ success: true, data: alerts });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/ops/dashboard/sla-report
   * Get SLA compliance report.
   * Roles: ops_manager, super_admin
   */
  router.get(
    '/sla-report',
    authorize('ops_manager', 'super_admin'),
    async (req, res, next) => {
      try {
        const user = (req as any).user!;
        const cityId = user.role === 'super_admin' ? undefined : user.cityId;

        const metrics = await dashboardService.getSlaMetrics(cityId);

        res.json({ success: true, data: metrics });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/ops/dashboard/payments
   * Get payment metrics.
   * Roles: ops_manager, super_admin
   */
  router.get(
    '/payments',
    authorize('ops_manager', 'super_admin'),
    async (req, res, next) => {
      try {
        const { startDate, endDate } = dateRangeSchema.parse(req.query);
        const user = (req as any).user!;
        const cityId = user.role === 'super_admin' ? undefined : user.cityId;

        const dateRange = startDate && endDate ? { startDate, endDate } : undefined;
        const metrics = await dashboardService.getPaymentMetrics(cityId, dateRange);

        res.json({
          success: true,
          data: {
            ...metrics,
            totalCollected: metrics.totalCollected.toString(),
            pending: metrics.pending.toString(),
            refunded: metrics.refunded.toString(),
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/ops/dashboard/trend
   * Get daily service trend for charts.
   * Roles: ops_manager, super_admin
   */
  router.get(
    '/trend',
    authorize('ops_manager', 'super_admin'),
    async (req, res, next) => {
      try {
        const days = parseInt(req.query.days as string) || 30;
        const user = (req as any).user!;
        const cityId = user.role === 'super_admin' ? undefined : user.cityId;

        const trend = await dashboardService.getDailyServiceTrend(cityId, days);

        res.json({ success: true, data: trend });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
