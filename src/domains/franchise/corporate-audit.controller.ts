import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CorporateAuditService } from './corporate-audit.service';
import { correctiveActionSchema } from './franchise.types';
import { authorize } from '../../middleware/authorize';

export function createCorporateAuditController(service: CorporateAuditService): Router {
  const router = Router();

  // POST /api/v1/corporate-audits — Create audit (Super Admin)
  router.post(
    '/',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z.object({
          franchiseId: z.string().uuid(),
          cityId: z.string().uuid(),
          auditType: z.enum(['financial', 'operational', 'quality']),
          scheduledDate: z.string(),
          auditorName: z.string().min(2),
          isRecurring: z.boolean().default(false),
          recurringSchedule: z.enum(['quarterly', 'annual']).optional(),
        }).parse(req.body);

        const audit = await service.createAudit({
          ...body,
          createdBy: req.user!.id,
        });
        res.status(201).json({ success: true, data: audit });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/corporate-audits — List all audits (Super Admin)
  router.get(
    '/',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const audits = await service.listAllAudits({
          status: req.query.status as string,
          cityId: req.query.cityId as string,
        });
        res.json({ success: true, data: audits });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/corporate-audits/:id — Get audit details
  router.get(
    '/:id',
    authorize('super_admin', 'franchise_owner'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const audit = await service.getAudit(req.params.id);
        res.json({ success: true, data: audit });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/corporate-audits/franchise/:franchiseId — Audits for franchise
  router.get(
    '/franchise/:franchiseId',
    authorize('super_admin', 'franchise_owner'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const audits = await service.listAuditsForFranchise(req.params.franchiseId);
        res.json({ success: true, data: audits });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/corporate-audits/franchise/:franchiseId/summary — Audit summary
  router.get(
    '/franchise/:franchiseId/summary',
    authorize('super_admin', 'franchise_owner'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const summary = await service.getAuditSummary(req.params.franchiseId);
        res.json({ success: true, data: summary });
      } catch (error) {
        next(error);
      }
    }
  );

  // PATCH /api/v1/corporate-audits/:id/status — Update status
  router.patch(
    '/:id/status',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z.object({
          status: z.enum(['scheduled', 'in_progress', 'findings_shared', 'corrective_actions', 'closed']),
        }).parse(req.body);
        const audit = await service.updateStatus(req.params.id, body.status);
        res.json({ success: true, data: audit });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/corporate-audits/:id/findings — Upload findings
  router.post(
    '/:id/findings',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z.object({
          findings: z.array(z.record(z.string(), z.any())),
          findingsReportUrl: z.string().url(),
        }).parse(req.body);
        const audit = await service.uploadFindings(req.params.id, body);
        res.json({ success: true, data: audit });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/corporate-audits/:id/respond — Franchise response
  router.post(
    '/:id/respond',
    authorize('franchise_owner'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z.object({ response: z.string().min(10) }).parse(req.body);
        const audit = await service.respondToFindings(req.params.id, body.response);
        res.json({ success: true, data: audit });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/corporate-audits/:id/corrective-actions — Set corrective actions
  router.post(
    '/:id/corrective-actions',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z.object({
          actions: z.array(correctiveActionSchema),
        }).parse(req.body);
        const audit = await service.setCorrectiveActions(req.params.id, body.actions);
        res.json({ success: true, data: audit });
      } catch (error) {
        next(error);
      }
    }
  );

  // PUT /api/v1/corporate-audits/:id/checklist — Update checklist
  router.put(
    '/:id/checklist',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z.object({
          checklist: z.array(z.object({
            item: z.string(),
            status: z.enum(['pending', 'pass', 'fail', 'not_applicable']),
            notes: z.string().optional(),
          })),
        }).parse(req.body);
        const audit = await service.updateChecklist(req.params.id, body.checklist);
        res.json({ success: true, data: audit });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
