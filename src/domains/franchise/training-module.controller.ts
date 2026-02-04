import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { TrainingModuleService } from './training-module.service';
import { quizDataSchema } from './franchise.types';
import { authorize } from '../../middleware/authorize';

const createModuleSchema = z.object({
  cityId: z.string().uuid().optional(),
  moduleName: z.string().min(2).max(200),
  description: z.string().optional(),
  contentType: z.enum(['video', 'pdf', 'quiz']),
  contentUrl: z.string().url().optional(),
  quizData: quizDataSchema.optional(),
  learningPath: z.string().optional(),
  isMandatory: z.boolean().default(false),
  sortOrder: z.number().int().min(0).optional(),
});

export function createTrainingModuleController(service: TrainingModuleService): Router {
  const router = Router();

  // POST /api/v1/training-modules — Create module
  router.post(
    '/',
    authorize('franchise_owner', 'super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = createModuleSchema.parse(req.body);
        const module = await service.createModule({
          ...body,
          createdBy: req.user!.id,
        });
        res.status(201).json({ success: true, data: module });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/training-modules/:cityId — Get modules for city
  router.get(
    '/:cityId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const modules = await service.getModulesForCity(req.params.cityId);
        res.json({ success: true, data: modules });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/training-modules/:cityId/paths — Get learning paths
  router.get(
    '/:cityId/paths',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const paths = await service.getLearningPaths(req.params.cityId);
        res.json({ success: true, data: paths });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/training-modules/:moduleId/quiz-submit — Submit quiz
  router.post(
    '/:moduleId/quiz-submit',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z.object({
          agentId: z.string().uuid(),
          score: z.number().int().min(0).max(100),
        }).parse(req.body);

        const result = await service.submitQuizResult(
          body.agentId,
          req.params.moduleId,
          body.score
        );
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/training-modules/:moduleId/complete — Mark module complete
  router.post(
    '/:moduleId/complete',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z.object({ agentId: z.string().uuid() }).parse(req.body);
        const result = await service.markModuleCompleted(body.agentId, req.params.moduleId);
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/training-modules/progress/:agentId/:cityId — Agent progress
  router.get(
    '/progress/:agentId/:cityId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const progress = await service.getAgentProgress(req.params.agentId, req.params.cityId);
        res.json({ success: true, data: progress });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/training-modules/dashboard/:cityId — Training dashboard
  router.get(
    '/dashboard/:cityId',
    authorize('franchise_owner', 'super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const dashboard = await service.getTrainingDashboard(req.params.cityId);
        res.json({ success: true, data: dashboard });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
