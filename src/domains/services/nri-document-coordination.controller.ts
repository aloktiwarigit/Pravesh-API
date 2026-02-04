// Story 13-15: NRI Document Coordination Workflow Controller
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { NriDocumentCoordinationService } from './nri-document-coordination.service.js';

export function nriDocumentRoutes(
  service: NriDocumentCoordinationService
): Router {
  const router = Router();

  // POST /api/v1/nri-documents/upload-scan
  router.post(
    '/upload-scan',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z
          .object({
            serviceRequestId: z.string().uuid(),
            documentType: z.string(),
            scannedCopyUrl: z.string(),
          })
          .parse(req.body);
        const result = await service.uploadScannedCopy({
          ...body,
          customerId: (req as any).user!.id,
          cityId: (req as any).user!.cityId,
        });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/nri-documents/verify-scan (Agent)
  router.post(
    '/verify-scan',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z
          .object({
            submissionId: z.string().uuid(),
            approved: z.boolean(),
            notes: z.string().optional(),
          })
          .parse(req.body);
        const result = await service.verifyScannedCopy({
          ...body,
          agentId: (req as any).user!.id,
        });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/nri-documents/courier-instructions
  router.get(
    '/courier-instructions',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const instructions = service.getCourierInstructions(
          (req as any).user!.cityId
        );
        res.json({ success: true, data: instructions });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/nri-documents/courier-tracking
  router.post(
    '/courier-tracking',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z
          .object({
            submissionId: z.string().uuid(),
            courierService: z.string(),
            trackingNumber: z.string(),
            shippedDate: z.string().datetime(),
          })
          .parse(req.body);
        const result = await service.updateCourierTracking({
          ...body,
          shippedDate: new Date(body.shippedDate),
        });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/nri-documents/confirm-receipt (Agent)
  router.post(
    '/confirm-receipt',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z
          .object({
            submissionId: z.string().uuid(),
            matchesScan: z.boolean(),
            mismatchNotes: z.string().optional(),
          })
          .parse(req.body);
        const result = await service.confirmOriginalReceipt({
          ...body,
          agentId: (req as any).user!.id,
        });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/nri-documents/provisional-completion (Ops)
  router.post(
    '/provisional-completion',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = z
          .object({
            serviceRequestId: z.string().uuid(),
          })
          .parse(req.body);
        const result = await service.grantProvisionalCompletion({
          ...body,
          opsUserId: (req as any).user!.id,
        });
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/nri-documents/timeline/:serviceRequestId
  router.get(
    '/timeline/:serviceRequestId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const timeline = await service.getDocumentTimeline(
          req.params.serviceRequestId
        );
        res.json({ success: true, data: timeline });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
