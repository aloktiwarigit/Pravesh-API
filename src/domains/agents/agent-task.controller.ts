// Stories 3-3, 3-7, 3-12: Agent Task Controller
import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { AgentTaskService } from './agent-task.service.js';
import { logger } from '../../shared/utils/logger.js';

const updateStatusSchema = z.object({
  newStatus: z.enum([
    'pending_contact',
    'contacted',
    'scope_confirmed',
    'awaiting_payment',
    'in_progress',
    'completed',
  ]),
  gpsLat: z.number().optional(),
  gpsLng: z.number().optional(),
  notes: z.string().optional(),
  photos: z.array(z.string().url()).optional(),
  idempotencyKey: z.string().optional(),
});

const gpsEvidenceSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  accuracy: z.number().min(0),
  capturedAt: z.string().datetime(),
  photoUrl: z.string().url().optional(),
});

const syncBatchSchema = z.object({
  items: z.array(
    z.object({
      idempotencyKey: z.string().min(1),
      type: z.enum(['task_update', 'gps_evidence', 'cash_receipt']),
      payload: z.record(z.unknown()),
      clientTimestamp: z.string().datetime(),
    }),
  ),
});

/**
 * Resolves userId → Agent.id (UUID).
 * ServiceRequests store assignedAgentId as the Agent table PK,
 * but req.user.id is the auth userId — these must be resolved.
 */
async function resolveAgentId(prisma: PrismaClient, userId: string): Promise<string | null> {
  const agent = await prisma.agent.findUnique({
    where: { userId },
    select: { id: true },
  });
  return agent?.id ?? null;
}

export function agentTaskRoutes(service: AgentTaskService, prisma?: PrismaClient): Router {
  const router = Router();

  // Middleware to resolve userId → Agent UUID for all routes
  // Attaches resolved agentId to req for downstream handlers
  if (prisma) {
    router.use(async (req: Request, _res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user;
        if (user?.id) {
          const agentId = await resolveAgentId(prisma, user.id);
          if (agentId) {
            (req as any)._resolvedAgentId = agentId;
          }
        }
        next();
      } catch (error) {
        next(error);
      }
    });
  }

  /** Helper: get resolved agent ID or fall back to user.id */
  function getAgentId(req: Request): string {
    return (req as any)._resolvedAgentId || (req as any).user!.id;
  }

  // GET /api/v1/agents/tasks
  router.get(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user!;
        const result = await service.getAgentTasks(
          getAgentId(req),
          user.cityId,
          req.query.status as string | undefined,
          {
            cursor: req.query.cursor as string | undefined,
            limit: parseInt(req.query.limit as string, 10) || 20,
          },
        );
        res.json({ success: true, ...result });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /api/v1/agents/tasks/:taskId
  router.get(
    '/:taskId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const task = await service.getTaskById(req.params.taskId, getAgentId(req));
        res.json({ success: true, data: task });
      } catch (error) {
        next(error);
      }
    },
  );

  // PATCH /api/v1/agents/tasks/:taskId/status
  router.patch(
    '/:taskId/status',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = updateStatusSchema.parse(req.body);
        const agentId = getAgentId(req);
        logger.info({ taskId: req.params.taskId, agentId, newStatus: body.newStatus }, 'PATCH task status');
        const result = await service.updateTaskStatus({
          taskId: req.params.taskId,
          agentId,
          ...body,
        });
        res.json({ success: true, data: result });
      } catch (error: any) {
        logger.error({ err: error, taskId: req.params.taskId, agentId: getAgentId(req), stack: error?.stack }, 'Task status update failed');
        next(error);
      }
    },
  );

  // POST /api/v1/agents/tasks/:taskId/gps-evidence
  router.post(
    '/:taskId/gps-evidence',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = gpsEvidenceSchema.parse(req.body);
        const evidence = await service.recordGpsEvidence({
          taskId: req.params.taskId,
          agentId: getAgentId(req),
          ...body,
        });
        res.json({ success: true, data: evidence });
      } catch (error) {
        next(error);
      }
    },
  );

  // POST /api/v1/agents/tasks/sync
  router.post(
    '/sync',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = syncBatchSchema.parse(req.body);
        const result = await service.processSyncBatch(getAgentId(req), body.items);
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /api/v1/agents/tasks/sync/pull?since=ISO8601
  router.get(
    '/sync/pull',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const since = new Date(req.query.since as string);
        if (isNaN(since.getTime())) {
          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_INVALID_DATE',
              message: 'Invalid since parameter',
            },
          });
          return;
        }
        const tasks = await service.getTasksSince(getAgentId(req), since);
        res.json({ success: true, data: tasks });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
