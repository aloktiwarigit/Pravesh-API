import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authorize } from '../../middleware/authorize';

/**
 * Resolves the authenticated user's userId to their Agent record UUID.
 * ServiceRequests store assignedAgentId as the Agent table PK (UUID),
 * but req.user.id is the userId string — these must be resolved.
 */
async function resolveAgentId(prisma: PrismaClient, userId: string): Promise<string | null> {
  const agent = await prisma.agent.findUnique({
    where: { userId },
    select: { id: true },
  });
  return agent?.id ?? null;
}

export function createAgentDashboardController(prisma: PrismaClient): Router {
  const router = Router();

  // GET /agents/tasks/summary
  // Returns task counts for the authenticated agent's dashboard.
  router.get(
    '/tasks/summary',
    authorize('agent'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const agentId = await resolveAgentId(prisma, req.user!.id);
        if (!agentId) {
          return res.json({
            success: true,
            data: { pending: 0, inProgress: 0, completedToday: 0, slaBreaching: 0 },
          });
        }

        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const [pending, inProgress, completedToday, slaBreaching] =
          await Promise.all([
            prisma.serviceRequest.count({
              where: {
                assignedAgentId: agentId,
                status: { in: ['pending', 'assigned', 'pending_contact', 'contacted', 'scope_confirmed'] },
              },
            }),
            prisma.serviceRequest.count({
              where: {
                assignedAgentId: agentId,
                status: 'in_progress',
              },
            }),
            prisma.serviceRequest.count({
              where: {
                assignedAgentId: agentId,
                status: 'completed',
                updatedAt: { gte: todayStart },
              },
            }),
            // SLA breaching: assigned > 48h ago and not completed
            prisma.serviceRequest.count({
              where: {
                assignedAgentId: agentId,
                status: { notIn: ['completed', 'cancelled'] },
                createdAt: {
                  lt: new Date(Date.now() - 48 * 60 * 60 * 1000),
                },
              },
            }),
          ]);

        res.json({
          success: true,
          data: { pending, inProgress, completedToday, slaBreaching },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /agents/me — Agent profile
  router.get(
    '/me',
    authorize('agent'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.user!.id;
        let agent = await prisma.agent.findUnique({
          where: { userId },
          include: { city: { select: { id: true, cityName: true } } },
        });

        // Dev auto-provision if DEV_AUTH_BYPASS is active and no agent found
        if (!agent && process.env.DEV_AUTH_BYPASS === 'true') {
          const city = await prisma.city.findFirst();
          agent = await prisma.agent.create({
            data: {
              userId,
              cityId: city?.id ?? 'dev-city',
              name: 'Dev Agent',
              phone: '+910000000000',
            },
            include: { city: { select: { id: true, cityName: true } } },
          });
        }

        if (!agent) {
          return res.status(404).json({
            success: false,
            error: { code: 'AGENT_NOT_FOUND', message: 'Agent profile not found' },
          });
        }

        res.json({
          success: true,
          data: {
            id: agent.id,
            userId: agent.userId,
            name: agent.name,
            phone: agent.phone,
            photoUrl: agent.photoUrl,
            cityId: agent.cityId,
            cityName: agent.city?.cityName ?? null,
            isActive: agent.isActive,
            trainingCompleted: agent.trainingCompleted,
            maxConcurrentTasks: agent.maxConcurrentTasks,
            expertiseTags: agent.expertiseTags,
            createdAt: agent.createdAt.toISOString(),
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /agents/me/stats — Agent task stats
  router.get(
    '/me/stats',
    authorize('agent'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const agentId = await resolveAgentId(prisma, req.user!.id);
        if (!agentId) {
          return res.json({
            success: true,
            data: { totalAssigned: 0, completed: 0, inProgress: 0, pending: 0 },
          });
        }

        const [totalAssigned, completed, inProgress] = await Promise.all([
          prisma.serviceRequest.count({
            where: { assignedAgentId: agentId },
          }),
          prisma.serviceRequest.count({
            where: { assignedAgentId: agentId, status: 'completed' },
          }),
          prisma.serviceRequest.count({
            where: { assignedAgentId: agentId, status: 'in_progress' },
          }),
        ]);

        res.json({
          success: true,
          data: {
            totalAssigned,
            completed,
            inProgress,
            pending: totalAssigned - completed - inProgress,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /agents/me/earnings
  // Returns earnings aggregation for today, this week, and this month.
  router.get(
    '/me/earnings',
    authorize('agent'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const agentId = await resolveAgentId(prisma, req.user!.id);
        if (!agentId) {
          return res.json({
            success: true,
            data: { todayPaise: 0, weekPaise: 0, monthPaise: 0 },
          });
        }

        const now = new Date();
        const todayStart = new Date(now);
        todayStart.setHours(0, 0, 0, 0);

        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);

        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        // Query completed service requests with fees for this agent
        const [todayAgg, weekAgg, monthAgg] = await Promise.all([
          prisma.serviceRequest.aggregate({
            where: {
              assignedAgentId: agentId,
              status: 'completed',
              updatedAt: { gte: todayStart },
            },
            _sum: { serviceFeePaise: true },
          }),
          prisma.serviceRequest.aggregate({
            where: {
              assignedAgentId: agentId,
              status: 'completed',
              updatedAt: { gte: weekStart },
            },
            _sum: { serviceFeePaise: true },
          }),
          prisma.serviceRequest.aggregate({
            where: {
              assignedAgentId: agentId,
              status: 'completed',
              updatedAt: { gte: monthStart },
            },
            _sum: { serviceFeePaise: true },
          }),
        ]);

        res.json({
          success: true,
          data: {
            todayPaise: todayAgg._sum.serviceFeePaise ?? 0,
            weekPaise: weekAgg._sum.serviceFeePaise ?? 0,
            monthPaise: monthAgg._sum.serviceFeePaise ?? 0,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
