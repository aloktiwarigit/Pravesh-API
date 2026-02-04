// Stories 3-3, 3-7, 3-12: Agent Task Controller
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AgentTaskService } from './agent-task.service.js';

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

export function agentTaskRoutes(service: AgentTaskService): Router {
  const router = Router();

  // GET /api/v1/agents/tasks
  router.get(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user!;
        const result = await service.getAgentTasks(
          user.id,
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
        const user = (req as any).user!;
        const task = await service.getTaskById(req.params.taskId, user.id);
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
        const user = (req as any).user!;
        const result = await service.updateTaskStatus({
          taskId: req.params.taskId,
          agentId: user.id,
          ...body,
        });
        res.json({ success: true, data: result });
      } catch (error) {
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
        const user = (req as any).user!;
        const evidence = await service.recordGpsEvidence({
          taskId: req.params.taskId,
          agentId: user.id,
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
        const user = (req as any).user!;
        const result = await service.processSyncBatch(user.id, body.items);
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
        const user = (req as any).user!;
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
        const tasks = await service.getTasksSince(user.id, since);
        res.json({ success: true, data: tasks });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
