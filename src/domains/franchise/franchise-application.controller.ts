import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { FranchiseApplicationService } from './franchise-application.service';
import { franchiseApplicationCreateSchema, contractTermsSchema } from './franchise.types';
import { authorize } from '../../middleware/authorize';

export function createFranchiseApplicationController(
  service: FranchiseApplicationService
): Router {
  const router = Router();

  // POST /api/v1/franchise-applications — Submit application
  router.post(
    '/',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = franchiseApplicationCreateSchema.parse(req.body);
        const application = await service.submitApplication(body);
        res.status(201).json({ success: true, data: application });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/franchise-applications — List applications (Super Admin)
  router.get(
    '/',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const cursor = req.query.cursor as string | undefined;
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
        const applications = await service.listApplications(
          {
            status: req.query.status as string,
            cityId: req.query.cityId as string,
          },
          cursor,
          limit,
        );
        res.json({ success: true, data: applications });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/franchise-applications/:id — Get application details
  router.get(
    '/:id',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const application = await service.getApplication(req.params.id);
        res.json({ success: true, data: application });
      } catch (error) {
        next(error);
      }
    }
  );

  // PATCH /api/v1/franchise-applications/:id/status — Update status (Super Admin)
  router.patch(
    '/:id/status',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z.object({
          status: z.enum([
            'pending_review', 'info_requested', 'interview_scheduled',
            'approved', 'rejected', 'agreement_sent', 'onboarded',
          ]),
          reviewNotes: z.string().optional(),
          reviewChecklist: z.record(z.string(), z.any()).optional(),
        }).parse(req.body);

        const application = await service.updateStatus(
          req.params.id,
          body.status,
          req.user!.id,
          body.reviewNotes,
          body.reviewChecklist
        );
        res.json({ success: true, data: application });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/franchise-applications/:id/send-agreement — Send agreement doc
  router.post(
    '/:id/send-agreement',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z.object({ agreementDocUrl: z.string().url() }).parse(req.body);
        const application = await service.approveAndSendAgreement(
          req.params.id,
          body.agreementDocUrl,
          req.user!.id
        );
        res.json({ success: true, data: application });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/franchise-applications/:id/onboard — Complete onboarding
  router.post(
    '/:id/onboard',
    authorize('super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z.object({
          signedAgreementUrl: z.string().url(),
          ownerUserId: z.string(),
          contractTerms: contractTermsSchema,
        }).parse(req.body);

        const result = await service.completeOnboarding(
          req.params.id,
          body.signedAgreementUrl,
          body.ownerUserId,
          body.contractTerms
        );
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
