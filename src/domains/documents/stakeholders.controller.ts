// Story 6.11a + 6.11c: Stakeholder REST Controller
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { StakeholderService } from './stakeholders.service.js';

const addStakeholderSchema = z.object({
  service_instance_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  phone: z.string().regex(/^\+91\d{10}$/),
  relationship: z.enum(['co_heir', 'spouse', 'poa_holder']),
});

export function stakeholderRoutes(service: StakeholderService): Router {
  const router = Router();

  // POST /api/v1/stakeholders — add stakeholder (AC1)
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = addStakeholderSchema.parse(req.body);

      // Verify limit (AC7) — max 10 stakeholders per service
      const count = await service.getStakeholderCount(body.service_instance_id);
      if (count >= 10) {
        return res.status(422).json({
          success: false,
          error: { code: 'MAX_STAKEHOLDERS', message: 'Maximum 10 stakeholders allowed per service request' },
        });
      }

      const stakeholder = await service.addStakeholder({
        serviceInstanceId: body.service_instance_id,
        name: body.name,
        phone: body.phone,
        relationship: body.relationship,
        cityId: (req as any).user!.cityId,
      });

      res.status(201).json({ success: true, data: stakeholder });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/stakeholders?service_instance_id=X (AC6)
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serviceInstanceId = z.string().uuid().parse(req.query.service_instance_id);
      const stakeholders = await service.getStakeholders(serviceInstanceId);
      res.json({ success: true, data: stakeholders });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/stakeholders/accept — stakeholder accepts invitation (AC3)
  router.post('/accept', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { service_instance_id } = z.object({
        service_instance_id: z.string().uuid(),
      }).parse(req.body);

      const stakeholder = await service.acceptInvitation(
        service_instance_id,
        (req as any).user!.id,
        (req as any).user!.phone,
      );

      res.json({ success: true, data: stakeholder });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/stakeholders/:id/remind — manual reminder (AC4, Story 6.11c)
  router.post('/:id/remind', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const stakeholderId = req.params.id;
      await service.sendManualReminder(stakeholderId);
      res.json({ success: true, data: { message: 'Reminder sent' } });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
