// Stories 3-5, 3-10a/b/c, 3-19: Checklist Controller
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ChecklistService } from './checklist.service.js';

const completeStepSchema = z.object({
  stepIndex: z.number().int().min(0),
  gpsLat: z.number().min(-90).max(90).optional(),
  gpsLng: z.number().min(-180).max(180).optional(),
  photoUrls: z.array(z.string().url()).optional(),
  documentId: z.string().uuid().optional(),
  notes: z.string().optional(),
  idempotencyKey: z.string().optional(),
});

const undoStepSchema = z.object({
  stepIndex: z.number().int().min(0),
});

export function checklistRoutes(service: ChecklistService): Router {
  const router = Router();

  // GET /api/v1/agents/checklists/template/:serviceCode
  router.get(
    '/template/:serviceCode',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const template = await service.getTemplate(req.params.serviceCode);
        if (!template) {
          res.status(404).json({
            success: false,
            error: {
              code: 'BUSINESS_NO_CHECKLIST_TEMPLATE',
              message: 'Template not found',
            },
          });
          return;
        }
        res.json({ success: true, data: template });
      } catch (error) {
        next(error);
      }
    },
  );

  // POST /api/v1/agents/checklists/initialize
  router.post(
    '/initialize',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z
          .object({
            taskId: z.string().uuid(),
            serviceCode: z.string().min(1),
          })
          .parse(req.body);
        const result = await service.initializeChecklist(
          body.taskId,
          body.serviceCode,
        );
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /api/v1/agents/checklists/:taskId/progress
  router.get(
    '/:taskId/progress',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const progress = await service.getChecklistProgress(
          req.params.taskId,
        );
        if (!progress) {
          res.status(404).json({
            success: false,
            error: {
              code: 'BUSINESS_CHECKLIST_NOT_FOUND',
              message: 'No checklist found for this task',
            },
          });
          return;
        }
        res.json({ success: true, data: progress });
      } catch (error) {
        next(error);
      }
    },
  );

  // POST /api/v1/agents/checklists/:checklistId/complete-step
  router.post(
    '/:checklistId/complete-step',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = completeStepSchema.parse(req.body);
        const user = (req as any).user!;
        const result = await service.completeStep({
          checklistId: req.params.checklistId,
          agentId: user.id,
          ...body,
        });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  // POST /api/v1/agents/checklists/:checklistId/undo-step
  router.post(
    '/:checklistId/undo-step',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = undoStepSchema.parse(req.body);
        const user = (req as any).user!;
        const result = await service.undoStep(
          req.params.checklistId,
          body.stepIndex,
          user.id,
        );
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
