import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AgentManagementService } from './agent-management.service';
import { authorize } from '../../middleware/authorize';
import { cityScope, cityScopeByEntity } from '../../middleware/city-scope';

const createAgentSchema = z.object({
  userId: z.string(),
  cityId: z.string().uuid(),
  name: z.string().min(2).max(200),
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/),
  photoUrl: z.string().url().optional(),
  serviceAreas: z.record(z.string(), z.any()).optional(),
  expertiseTags: z.array(z.string()).optional(),
  maxConcurrentTasks: z.number().int().min(1).max(50).optional(),
});

const updateAgentSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  phone: z.string().regex(/^\+?[1-9]\d{9,14}$/).optional(),
  photoUrl: z.string().url().optional(),
  serviceAreas: z.record(z.string(), z.any()).optional(),
  expertiseTags: z.array(z.string()).optional(),
  maxConcurrentTasks: z.number().int().min(1).max(50).optional(),
});

const agentCityLookup = (service: AgentManagementService) =>
  async (entityId: string) => {
    const agent = await service.getAgent(entityId);
    return agent?.cityId;
  };

export function createAgentManagementController(service: AgentManagementService): Router {
  const router = Router();

  // POST /api/v1/franchise-agents — Create agent (Franchise Owner)
  router.post(
    '/',
    authorize('franchise_owner', 'super_admin'),
    cityScope({ bodyField: 'cityId' }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = createAgentSchema.parse(req.body);
        const agent = await service.createAgent(body);
        res.status(201).json({ success: true, data: agent });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/franchise-agents/:cityId — List agents for city
  router.get(
    '/:cityId',
    authorize('franchise_owner', 'super_admin', 'ops', 'ops_manager'),
    cityScope(),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const isActive = req.query.isActive !== undefined
          ? req.query.isActive === 'true'
          : undefined;
        const agents = await service.listAgents(req.params.cityId, { isActive });
        res.json({ success: true, data: agents });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/franchise-agents/detail/:id — Get agent details
  router.get(
    '/detail/:id',
    authorize('franchise_owner', 'super_admin', 'ops', 'ops_manager'),
    cityScopeByEntity(agentCityLookup(service)),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const agent = await service.getAgent(req.params.id);
        res.json({ success: true, data: agent });
      } catch (error) {
        next(error);
      }
    }
  );

  // PUT /api/v1/franchise-agents/:id — Update agent
  router.put(
    '/:id',
    authorize('franchise_owner', 'super_admin'),
    cityScopeByEntity(agentCityLookup(service)),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = updateAgentSchema.parse(req.body);
        const agent = await service.updateAgent(req.params.id, body);
        res.json({ success: true, data: agent });
      } catch (error) {
        next(error);
      }
    }
  );

  // PATCH /api/v1/franchise-agents/:id/activate — Activate agent
  router.patch(
    '/:id/activate',
    authorize('franchise_owner', 'super_admin'),
    cityScopeByEntity(agentCityLookup(service)),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const agent = await service.activateAgent(req.params.id);
        res.json({ success: true, data: agent });
      } catch (error) {
        next(error);
      }
    }
  );

  // PATCH /api/v1/franchise-agents/:id/deactivate — Deactivate agent
  router.patch(
    '/:id/deactivate',
    authorize('franchise_owner', 'super_admin'),
    cityScopeByEntity(agentCityLookup(service)),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const agent = await service.deactivateAgent(req.params.id);
        res.json({ success: true, data: agent });
      } catch (error) {
        next(error);
      }
    }
  );

  // PATCH /api/v1/franchise-agents/:id/training-completed — Mark training done
  router.patch(
    '/:id/training-completed',
    authorize('franchise_owner', 'super_admin'),
    cityScopeByEntity(agentCityLookup(service)),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const agent = await service.markTrainingCompleted(req.params.id);
        res.json({ success: true, data: agent });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
