// Story 3-18: Training Controller
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { TrainingService } from './training.service.js';

const submitQuizSchema = z.object({
  answers: z.array(z.number().int().min(0)),
});

export function trainingRoutes(service: TrainingService): Router {
  const router = Router();

  // GET /api/v1/agents/training/modules
  router.get(
    '/modules',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user!;
        const modules = await service.getModules(user.id);
        res.json({ success: true, data: modules });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /api/v1/agents/training/modules/:moduleId
  router.get(
    '/modules/:moduleId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const content = await service.getModuleContent(req.params.moduleId);
        res.json({ success: true, data: content });
      } catch (error) {
        next(error);
      }
    },
  );

  // POST /api/v1/agents/training/modules/:moduleId/quiz
  router.post(
    '/modules/:moduleId/quiz',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = submitQuizSchema.parse(req.body);
        const user = (req as any).user!;
        const result = await service.submitQuiz({
          moduleId: req.params.moduleId,
          agentId: user.id,
          answers: body.answers,
        });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /api/v1/agents/training/progress
  router.get(
    '/progress',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user!;
        const summary = await service.getProgressSummary(user.id);
        res.json({ success: true, data: summary });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
