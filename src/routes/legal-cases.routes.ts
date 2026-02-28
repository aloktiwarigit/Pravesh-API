import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { LawyerController } from '../domains/lawyers/lawyers.controller';
import { LawyerService } from '../domains/lawyers/lawyers.service';
import { prisma } from '../shared/prisma/client';
import { authorize } from '../middleware/authorize';

const router = Router();

// Initialize service and controller
const lawyerService = new LawyerService(prisma as unknown as PrismaClient);
const lawyerController = new LawyerController(lawyerService);

// ============================================================
// Story 12-3: Case Routing
// ============================================================

// POST /api/v1/legal-cases — Ops creates a legal case (ops role)
router.post('/', authorize('ops_manager'), lawyerController.createLegalCase);

// ============================================================
// Story 12-4: Case Accept/Decline
// ============================================================

// GET /api/v1/legal-cases/:caseId — Lawyer views case details (lawyer role)
router.get('/:caseId', authorize('lawyer', 'ops_manager'), lawyerController.getCaseDetails);

// POST /api/v1/legal-cases/:caseId/accept — Lawyer accepts case (lawyer role)
router.post('/:caseId/accept', authorize('lawyer'), lawyerController.acceptCase);

// POST /api/v1/legal-cases/:caseId/decline — Lawyer declines case (lawyer role)
router.post('/:caseId/decline', authorize('lawyer'), lawyerController.declineCase);

// ============================================================
// Story 12-5: Document Access (Scoped)
// ============================================================

// GET /api/v1/legal-cases/:caseId/documents — Lawyer views case documents (lawyer role)
router.get('/:caseId/documents', authorize('lawyer'), lawyerController.getCaseDocuments);

// POST /api/v1/legal-cases/:caseId/documents/:documentId/access — Log document access (lawyer role)
router.post('/:caseId/documents/:documentId/access', authorize('lawyer'), lawyerController.logDocumentAccess);

// POST /api/v1/legal-cases/:caseId/document-requests — Lawyer requests additional docs (lawyer role)
router.post('/:caseId/document-requests', authorize('lawyer'), lawyerController.requestDocument);

// ============================================================
// Story 12-8: Case Completion (triggers payout)
// ============================================================

// POST /api/v1/legal-cases/:caseId/complete — Ops marks case completed (ops role)
router.post('/:caseId/complete', authorize('ops_manager'), lawyerController.completeCase);

// ============================================================
// Story 12-11: Case Reassignment
// ============================================================

// POST /api/v1/legal-cases/:caseId/reassign — Ops reassigns case (ops role)
router.post('/:caseId/reassign', authorize('ops_manager'), lawyerController.reassignCase);

export default router;
