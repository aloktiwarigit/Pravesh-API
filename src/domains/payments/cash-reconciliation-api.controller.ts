/**
 * Cash reconciliation REST endpoints for the ops dashboard.
 *
 * Story 4.8: Cash Reconciliation Dashboard
 *
 * GET  /                   — Daily reconciliation summary + agent list
 * GET  /agent/:agentId     — Agent's cash receipts & deposits for a day
 * PATCH /:id/resolve       — Resolve a reconciliation discrepancy
 */
import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authorize } from '../../middleware/authorize';

export function createCashReconciliationApiController(prisma: PrismaClient): Router {
  const router = Router();

  // All endpoints require ops_manager or super_admin role
  router.use(authorize('ops_manager', 'super_admin'));

  // GET / — Daily reconciliation summary with per-agent breakdown
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dateStr = req.query.date as string | undefined;
      const date = dateStr ? new Date(dateStr) : new Date();
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Get all cash receipts for the day, grouped by agent
      const receipts = await prisma.cashReceipt.findMany({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
        select: {
          id: true,
          agentId: true,
          amountPaise: true,
          customerName: true,
          serviceName: true,
          isReconciled: true,
          depositId: true,
          createdAt: true,
        },
      });

      // Get all deposits for the day
      const deposits = await prisma.cashDeposit.findMany({
        where: {
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
        select: {
          id: true,
          agentId: true,
          amountPaise: true,
          status: true,
          createdAt: true,
        },
      });

      // Aggregate by agent
      const agentMap = new Map<string, {
        collectedPaise: number;
        depositedPaise: number;
        receiptIds: string[];
        depositIds: string[];
      }>();

      for (const r of receipts) {
        const entry = agentMap.get(r.agentId) ?? {
          collectedPaise: 0, depositedPaise: 0, receiptIds: [], depositIds: [],
        };
        entry.collectedPaise += Number(r.amountPaise);
        entry.receiptIds.push(r.id);
        agentMap.set(r.agentId, entry);
      }

      for (const d of deposits) {
        const entry = agentMap.get(d.agentId) ?? {
          collectedPaise: 0, depositedPaise: 0, receiptIds: [], depositIds: [],
        };
        entry.depositedPaise += Number(d.amountPaise);
        entry.depositIds.push(d.id);
        agentMap.set(d.agentId, entry);
      }

      // Build per-agent reconciliation rows
      let totalCollected = 0;
      let totalDeposited = 0;
      let discrepancyCount = 0;
      let pendingCount = 0;

      const agents: Array<Record<string, unknown>> = [];
      for (const [agentId, data] of agentMap.entries()) {
        const variance = data.collectedPaise - data.depositedPaise;
        const status = variance === 0 ? 'RECONCILED' : 'DISCREPANCY';
        if (variance !== 0) discrepancyCount++;
        if (data.depositedPaise === 0 && data.collectedPaise > 0) pendingCount++;
        totalCollected += data.collectedPaise;
        totalDeposited += data.depositedPaise;

        agents.push({
          id: `${agentId}_${dateStr ?? new Date().toISOString().slice(0, 10)}`,
          agentId,
          agentName: agentId, // Flutter can resolve display name
          collectedPaise: data.collectedPaise,
          depositedPaise: data.depositedPaise,
          variancePaise: variance,
          status,
        });
      }

      res.json({
        success: true,
        data: {
          date: dateStr ?? new Date().toISOString().slice(0, 10),
          summary: {
            totalCollectedPaise: totalCollected,
            totalDepositedPaise: totalDeposited,
            pendingReconciliationPaise: totalCollected - totalDeposited,
            discrepancyCount,
            pendingCount,
            totalAgents: agentMap.size,
          },
          agents,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /agent/:agentId — Agent's cash receipts & deposits for a day
  router.get('/agent/:agentId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { agentId } = req.params;
      const dateStr = req.query.date as string | undefined;
      const date = dateStr ? new Date(dateStr) : new Date();
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const cashReceipts = await prisma.cashReceipt.findMany({
        where: {
          agentId,
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
        select: {
          id: true,
          amountPaise: true,
          serviceName: true,
          customerName: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      const cashDeposits = await prisma.cashDeposit.findMany({
        where: {
          agentId,
          createdAt: { gte: startOfDay, lte: endOfDay },
        },
        select: {
          id: true,
          amountPaise: true,
          depositReference: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      });

      res.json({
        success: true,
        data: {
          cashReceipts: cashReceipts.map((r) => ({
            id: r.id,
            amountPaise: Number(r.amountPaise),
            serviceNameEn: r.serviceName,
            customerName: r.customerName,
            createdAt: r.createdAt.toISOString(),
          })),
          deposits: cashDeposits.map((d) => ({
            id: d.id,
            amountPaise: Number(d.amountPaise),
            bankReference: d.depositReference,
            createdAt: d.createdAt.toISOString(),
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // PATCH /:id/resolve — Resolve a reconciliation discrepancy
  router.patch('/:id/resolve', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { status, notes } = req.body as { status: string; notes: string };

      // Try to find an existing CashReconciliationLog record
      const existing = await prisma.cashReconciliationLog.findUnique({
        where: { id },
      });

      if (existing) {
        await prisma.cashReconciliationLog.update({
          where: { id },
          data: {
            status,
            reconciledBy: req.user!.id,
          },
        });
      }

      res.json({ success: true, data: { id, status, notes } });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
