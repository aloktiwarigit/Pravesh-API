// ============================================================
// Epic 9: Dealer Commissions — Controller
// Stories 9.7, 9.9, 9.14, 9.16
// Earnings summary, commission history, CSV export, forecast, payouts
// ============================================================

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { CommissionService } from './commissions.service';
import { PayoutService } from './payouts.service';

export function createCommissionController(prisma: PrismaClient): Router {
  const router = Router();
  const commissionService = new CommissionService(prisma);
  const payoutService = new PayoutService(prisma);

  // Helper: standard error handler
  function handleError(res: Response, error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.errors },
      });
    }
    const statusCode = error.statusCode || 500;
    const code = error.code || 'SYSTEM_ERROR';
    const message = error.message || 'An unexpected error occurred';
    return res.status(statusCode).json({ success: false, error: { code, message } });
  }

  // Helper: resolve dealerId from auth
  async function getDealerId(req: Request): Promise<string | null> {
    const userId = (req as any).user?.id;
    if (!userId) return null;
    const dealer = await prisma.dealer.findUnique({
      where: { userId },
      select: { id: true },
    });
    return dealer?.id ?? null;
  }

  // ==========================================================
  // Story 9.9: Earnings Summary
  // ==========================================================

  // GET /api/v1/dealer-commissions/earnings — Earnings summary
  router.get('/earnings', async (req: Request, res: Response) => {
    try {
      const dealerId = await getDealerId(req);
      if (!dealerId) {
        return res.status(403).json({
          success: false,
          error: { code: 'DEALER_NOT_FOUND', message: 'Dealer not found' },
        });
      }
      const summary = await commissionService.getEarningsSummary(dealerId);
      res.json({ success: true, data: summary });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ==========================================================
  // Story 9.9: Commission History
  // ==========================================================

  // GET /api/v1/dealer-commissions/history — Commission history (cursor-paginated)
  router.get('/history', async (req: Request, res: Response) => {
    try {
      const dealerId = await getDealerId(req);
      if (!dealerId) {
        return res.status(403).json({
          success: false,
          error: { code: 'DEALER_NOT_FOUND', message: 'Dealer not found' },
        });
      }
      const filters = {
        status: req.query.status as string | undefined,
        startDate: req.query.startDate as string | undefined,
        endDate: req.query.endDate as string | undefined,
      };
      const cursor = req.query.cursor as string | undefined;
      const limit = Math.min(Number(req.query.limit) || 20, 100);

      const commissions = await commissionService.getCommissionHistory(
        dealerId,
        filters,
        cursor,
        limit,
      );
      res.json({
        success: true,
        data: commissions,
        meta: {
          nextCursor: commissions.length === limit ? commissions[commissions.length - 1]?.id : null,
          limit,
        },
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ==========================================================
  // Story 9.9: CSV Export
  // ==========================================================

  // GET /api/v1/dealer-commissions/export — CSV export
  router.get('/export', async (req: Request, res: Response) => {
    try {
      const dealerId = await getDealerId(req);
      if (!dealerId) {
        return res.status(403).json({
          success: false,
          error: { code: 'DEALER_NOT_FOUND', message: 'Dealer not found' },
        });
      }
      await commissionService.exportCommissionsCsv(dealerId, res);
    } catch (error) {
      handleError(res, error);
    }
  });

  // ==========================================================
  // Story 9.16: Earnings Forecast
  // ==========================================================

  // GET /api/v1/dealer-commissions/forecast — Projected earnings
  router.get('/forecast', async (req: Request, res: Response) => {
    try {
      const dealerId = await getDealerId(req);
      if (!dealerId) {
        return res.status(403).json({
          success: false,
          error: { code: 'DEALER_NOT_FOUND', message: 'Dealer not found' },
        });
      }
      const forecast = await commissionService.getEarningsForecast(dealerId);
      res.json({ success: true, data: forecast });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ==========================================================
  // Story 9.9: Pending Commissions
  // ==========================================================

  // GET /api/v1/dealer-commissions/pending — Approved, awaiting payout
  router.get('/pending', async (req: Request, res: Response) => {
    try {
      const dealerId = await getDealerId(req);
      if (!dealerId) {
        return res.status(403).json({
          success: false,
          error: { code: 'DEALER_NOT_FOUND', message: 'Dealer not found' },
        });
      }
      const pending = await commissionService.getDealerPendingCommissions(dealerId);
      const serialized = pending.map((c) => ({
        id: c.id,
        commissionAmountPaise: c.commissionAmountPaise.toString(),
        commissionRate: c.commissionRate,
        status: c.status,
        earnedDate: c.earnedDate.toISOString(),
      }));
      res.json({ success: true, data: serialized });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ==========================================================
  // Story 9.14: Payout History
  // ==========================================================

  // GET /api/v1/dealer-commissions/payouts — Payout history
  router.get('/payouts', async (req: Request, res: Response) => {
    try {
      const dealerId = await getDealerId(req);
      if (!dealerId) {
        return res.status(403).json({
          success: false,
          error: { code: 'DEALER_NOT_FOUND', message: 'Dealer not found' },
        });
      }
      const cursor = req.query.cursor as string | undefined;
      const limit = Math.min(Number(req.query.limit) || 20, 100);
      const payouts = await payoutService.getPayoutHistory(dealerId, cursor, limit);
      const serialized = payouts.map((p: any) => ({
        id: p.id,
        totalAmountPaise: p.totalAmountPaise.toString(),
        status: p.status,
        transactionId: p.transactionId,
        bankAccount: p.bankAccount,
        payoutDate: p.payoutDate.toISOString(),
        processedAt: p.processedAt?.toISOString() ?? null,
      }));
      res.json({ success: true, data: serialized });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ==========================================================
  // Story 9.14: Ops Payout Dashboard
  // ==========================================================

  // GET /api/v1/dealer-commissions/ops/payout-dashboard — Ops reconciliation
  router.get('/ops/payout-dashboard', async (req: Request, res: Response) => {
    try {
      const cityId = req.query.cityId as string | undefined;
      const dashboard = await payoutService.getPayoutDashboard(cityId);
      res.json({ success: true, data: dashboard });
    } catch (error) {
      handleError(res, error);
    }
  });

  return router;
}
