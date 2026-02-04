import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AnalyticsService } from './analytics.service';
import { authorize } from '../../middleware/authorize';

export function createAnalyticsController(service: AnalyticsService): Router {
  const router = Router();

  // ===== STORY 14-9: City-Level Analytics =====

  // GET /api/v1/analytics/city/:cityId/kpis — City KPIs
  router.get(
    '/city/:cityId/kpis',
    authorize('franchise_owner', 'super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const dateRange = req.query.start && req.query.end
          ? { start: req.query.start as string, end: req.query.end as string }
          : undefined;
        const kpis = await service.getCityKpis(req.params.cityId, dateRange);
        res.json({ success: true, data: kpis });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/analytics/city/:cityId/agent-leaderboard
  router.get(
    '/city/:cityId/agent-leaderboard',
    authorize('franchise_owner', 'super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const limit = parseInt(req.query.limit as string || '10', 10);
        const leaderboard = await service.getAgentLeaderboard(req.params.cityId, limit);
        res.json({ success: true, data: leaderboard });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/analytics/city/:cityId/dealer-leaderboard
  router.get(
    '/city/:cityId/dealer-leaderboard',
    authorize('franchise_owner', 'super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const limit = parseInt(req.query.limit as string || '10', 10);
        const leaderboard = await service.getDealerLeaderboard(req.params.cityId, limit);
        res.json({ success: true, data: leaderboard });
      } catch (error) {
        next(error);
      }
    }
  );

  // ===== STORY 14-10a: Cross-City KPI Overview =====

  // GET /api/v1/analytics/platform/kpis — Platform-wide KPIs
  router.get(
    '/platform/kpis',
    authorize('super_admin'),
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const kpis = await service.getPlatformKpis();
        res.json({ success: true, data: kpis });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/analytics/platform/city-comparison — City comparison table
  router.get(
    '/platform/city-comparison',
    authorize('super_admin'),
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const comparison = await service.getCityComparisonTable();
        res.json({ success: true, data: comparison });
      } catch (error) {
        next(error);
      }
    }
  );

  // ===== STORY 14-10b: City Comparison & Benchmarking =====

  // GET /api/v1/analytics/compare-cities — Side-by-side city comparison
  router.get(
    '/compare-cities',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const params = z.object({
          cityIdA: z.string().uuid(),
          cityIdB: z.string().uuid(),
        }).parse(req.query);

        const comparison = await service.compareCities(params.cityIdA, params.cityIdB);
        res.json({ success: true, data: comparison });
      } catch (error) {
        next(error);
      }
    }
  );

  // ===== STORY 14-10c: Geographic Heatmap & Trends =====

  // GET /api/v1/analytics/platform/heatmap — Geographic heatmap data
  router.get(
    '/platform/heatmap',
    authorize('super_admin'),
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const data = await service.getGeographicHeatmapData();
        res.json({ success: true, data });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/analytics/platform/trends — Platform-wide trends
  router.get(
    '/platform/trends',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const months = parseInt(req.query.months as string || '12', 10);
        const trends = await service.getTrendData(months);
        res.json({ success: true, data: trends });
      } catch (error) {
        next(error);
      }
    }
  );

  // ===== STORY 14-11: Market Intelligence Reports =====

  // GET /api/v1/analytics/market-intelligence/:cityId
  router.get(
    '/market-intelligence/:cityId',
    authorize('franchise_owner', 'super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const report = await service.generateMarketIntelligenceReport(req.params.cityId);
        res.json({ success: true, data: report });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
