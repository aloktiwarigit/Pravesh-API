// Story 13-7: POA Document Upload & Validity Verification Controller
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { PoaVerificationService } from './poa-verification.service.js';

export function poaVerificationRoutes(
  service: PoaVerificationService
): Router {
  const router = Router();

  // POST /api/v1/poa/verification/upload-notarized
  router.post(
    '/upload-notarized',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z
          .object({
            poaDocumentId: z.string().uuid(),
            notarizedPoaUrl: z.string(),
          })
          .parse(req.body);
        await service.uploadNotarizedPoa({
          ...body,
          customerId: (req as any).user!.id,
        });
        res.json({ success: true });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/poa/verification/verify (Ops-only)
  router.post(
    '/verify',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z
          .object({
            poaDocumentId: z.string().uuid(),
            approved: z.boolean(),
            verificationChecks: z.object({
              embassySeal: z.boolean(),
              notarizationDateValid: z.boolean(),
              attorneyDetailsMatch: z.boolean(),
              scopeAdequate: z.boolean(),
              validityConfirmed: z.boolean(),
            }),
            notes: z.string().optional(),
            rejectionReason: z.string().optional(),
          })
          .parse(req.body);
        const result = await service.verifyPoa({
          ...body,
          opsUserId: (req as any).user!.id,
        });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/poa/verification/pending (Ops-only)
  router.get(
    '/pending',
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const pending = await service.getPendingVerifications();
        res.json({ success: true, data: pending });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
