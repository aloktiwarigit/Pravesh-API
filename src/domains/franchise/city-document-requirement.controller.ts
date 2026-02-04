import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { CityDocumentRequirementService } from './city-document-requirement.service';
import { documentRequirementSchema } from './franchise.types';
import { authorize } from '../../middleware/authorize';

const upsertDocReqSchema = z.object({
  cityId: z.string().uuid(),
  serviceDefinitionId: z.string().uuid(),
  documents: z.array(documentRequirementSchema).min(1),
});

const validateSubmissionSchema = z.object({
  cityId: z.string().uuid(),
  serviceDefinitionId: z.string().uuid(),
  submittedDocuments: z.array(z.object({
    documentName: z.string(),
    format: z.string(),
    fileSizeMb: z.number(),
  })),
});

export function createCityDocumentRequirementController(
  service: CityDocumentRequirementService
): Router {
  const router = Router();

  // POST /api/v1/city-document-requirements — Create/update document requirements
  router.post(
    '/',
    authorize('franchise_owner', 'super_admin'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = upsertDocReqSchema.parse(req.body);
        const result = await service.upsertDocumentRequirements({
          ...body,
          createdBy: req.user!.id,
        });
        res.status(201).json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/city-document-requirements/:cityId — List all for a city
  router.get(
    '/:cityId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const docs = await service.listAllForCity(req.params.cityId);
        res.json({ success: true, data: docs });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/city-document-requirements/:cityId/:serviceDefinitionId — Get specific
  router.get(
    '/:cityId/:serviceDefinitionId',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const docs = await service.getDocumentRequirements(
          req.params.cityId,
          req.params.serviceDefinitionId
        );
        res.json({ success: true, data: docs });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/city-document-requirements/validate — Validate document submission
  router.post(
    '/validate',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const body = validateSubmissionSchema.parse(req.body);
        const result = await service.validateDocumentSubmission(
          body.cityId,
          body.serviceDefinitionId,
          body.submittedDocuments
        );
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
