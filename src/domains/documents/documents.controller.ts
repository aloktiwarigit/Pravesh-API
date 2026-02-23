// Story 6.2 + 6.6 + 6.8 + 6.11b + 6.14: Document Management REST Controller
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DocumentsService } from './documents.service.js';
import { createDocumentSchema, queryDocumentsSchema, overrideSchema } from './documents.validation.js';
import { auditLog } from '../../middleware/audit-logger.js';

export function documentsRoutes(service: DocumentsService): Router {
  const router = Router();

  // ================================================================
  // Story 6.2: POST /api/v1/documents — create document record after upload
  // ================================================================
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = createDocumentSchema.parse(req.body);
      const document = await service.createDocument({
        ...body,
        uploadedByUserId: (req as any).user!.id,
        cityId: (req as any).user!.cityId,
      });

      // Audit log
      await auditLog({
        userId: (req as any).user!.id,
        userRole: (req as any).user!.role,
        action: 'document_upload',
        resourceType: 'document',
        resourceId: document.id,
        serviceInstanceId: body.serviceInstanceId,
        metadata: {
          doc_type: body.docType,
          file_size: body.fileSize,
          uploaded_by: body.uploadedBy,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.status(201).json({ success: true, data: document });
    } catch (error) {
      next(error);
    }
  });

  // ================================================================
  // Story 6.2: GET /api/v1/documents/checklist — get document checklist
  // ================================================================
  router.get('/checklist', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { service_instance_id } = queryDocumentsSchema.parse(req.query);
      const checklist = await service.getDocumentChecklist(service_instance_id);
      res.json({ success: true, data: checklist });
    } catch (error) {
      next(error);
    }
  });

  // ================================================================
  // Story 6.8: GET /api/v1/documents/my-vault — customer document vault
  // ================================================================
  router.get('/my-vault', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const documents = await service.getDocumentsForUser((req as any).user!.id);
      res.json({ success: true, data: documents });
    } catch (error) {
      next(error);
    }
  });

  // ================================================================
  // Story 6.6: GET /api/v1/documents/review-queue — ops review queue
  // ================================================================
  router.get('/review-queue', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queue = await service.getReviewQueue((req as any).user!.cityId);
      res.json({ success: true, data: queue });
    } catch (error) {
      next(error);
    }
  });

  // ================================================================
  // Story 6.11b: GET /api/v1/documents/stakeholder-checklist
  // ================================================================
  router.get('/stakeholder-checklist', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serviceInstanceId = z.string().uuid().parse(req.query.service_instance_id);
      const userId = (req as any).user!.id;

      // Use shared prisma singleton for stakeholder lookup
      const { prisma: sharedPrisma } = await import('../../shared/prisma/client');
      const stakeholder = await sharedPrisma.serviceStakeholder.findFirst({
        where: { serviceInstanceId, userId },
      });

      if (!stakeholder) {
        return res.status(403).json({ success: false, error: 'Not a stakeholder on this service' });
      }

      const checklist = await service.getStakeholderChecklist(
        serviceInstanceId,
        stakeholder.id,
        stakeholder.relationship,
      );

      res.json({ success: true, data: checklist });
    } catch (error) {
      next(error);
    }
  });

  // ================================================================
  // Story 6.11b: GET /api/v1/documents/stakeholder-status
  // ================================================================
  router.get('/stakeholder-status', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const serviceInstanceId = z.string().uuid().parse(req.query.service_instance_id);
      const statuses = await service.getPerStakeholderStatus(serviceInstanceId);
      res.json({ success: true, data: statuses });
    } catch (error) {
      next(error);
    }
  });

  // ================================================================
  // Story 6.2: GET /api/v1/documents — list documents for a service instance
  // ================================================================
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { service_instance_id } = queryDocumentsSchema.parse(req.query);
      const documents = await service.getDocumentsByServiceInstance(service_instance_id);
      res.json({ success: true, data: documents });
    } catch (error) {
      next(error);
    }
  });

  // ================================================================
  // Story 6.2: GET /api/v1/documents/:id — get single document
  // ================================================================
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const document = await service.getDocumentById(req.params.id);
      if (!document) {
        return res.status(404).json({ success: false, error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' } });
      }

      // Audit log for view (Story 6.10, 6.13)
      await auditLog({
        userId: (req as any).user!.id,
        userRole: (req as any).user!.role,
        action: 'document_view',
        resourceType: 'document',
        resourceId: document.id,
        serviceInstanceId: document.serviceInstanceId,
        metadata: {
          role: (req as any).user!.role,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        deviceInfo: req.headers['x-device-info'] as string,
      });

      res.json({ success: true, data: document });
    } catch (error) {
      next(error);
    }
  });

  // ================================================================
  // Story 6.6: PUT /api/v1/documents/:id/override — human override
  // ================================================================
  router.put('/:id/override', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { action, reason_category, notes, flag_ai_incorrect } = overrideSchema.parse(req.body);
      const documentId = req.params.id;

      const document = await service.overrideVerification({
        documentId,
        action,
        reasonCategory: reason_category,
        notes,
        overriddenBy: (req as any).user!.id,
        flagAiIncorrect: flag_ai_incorrect,
      });

      // Audit log
      await auditLog({
        userId: (req as any).user!.id,
        userRole: (req as any).user!.role,
        action: 'document_verification_override',
        resourceType: 'document',
        resourceId: documentId,
        metadata: { override_action: action, reason_category, notes },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ success: true, data: document });
    } catch (error) {
      next(error);
    }
  });

  // ================================================================
  // Story 6.14: POST /api/v1/documents/:id/request-retrieval
  // ================================================================
  router.post('/:id/request-retrieval', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const document = await service.getDocumentById(req.params.id);
      if (!document) {
        return res.status(404).json({ success: false, error: { code: 'DOCUMENT_NOT_FOUND', message: 'Document not found' } });
      }

      if (!document.archivedAt) {
        return res.status(400).json({
          success: false,
          error: { code: 'DOCUMENT_NOT_ARCHIVED', message: 'Document is not archived — available for immediate access' },
        });
      }

      await service.requestRetrieval(document.id);

      res.json({
        success: true,
        data: { message: 'Retrieval request submitted. Document will be available within 24 hours.' },
      });
    } catch (error) {
      next(error);
    }
  });

  // ================================================================
  // Story 6.2: DELETE /api/v1/documents/:id — delete document
  // ================================================================
  router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      await service.deleteDocument(req.params.id);

      await auditLog({
        userId: (req as any).user!.id,
        userRole: (req as any).user!.role,
        action: 'document_delete',
        resourceType: 'document',
        resourceId: req.params.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });

      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
