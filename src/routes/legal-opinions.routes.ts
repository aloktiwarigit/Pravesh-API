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
// Story 12-6: Legal Opinion Upload
// ============================================================

// POST /api/v1/legal-opinions — Lawyer submits opinion (lawyer role)
router.post('/', authorize('lawyer'), lawyerController.submitOpinion);

// POST /api/v1/legal-opinions/review — Ops reviews opinion (ops role)
router.post('/review', authorize('ops_manager'), lawyerController.reviewOpinion);

// ============================================================
// Story 12-7: Opinion Delivery
// ============================================================

// POST /api/v1/legal-opinions/:opinionId/deliver — Ops delivers approved opinion (ops role)
router.post('/:opinionId/deliver', authorize('ops_manager'), lawyerController.deliverOpinion);

// ============================================================
// Story 12-9: Customer Rates Opinion
// ============================================================

// POST /api/v1/legal-opinions/rate — Customer rates opinion (customer role)
router.post('/rate', authorize('customer'), lawyerController.rateOpinion);

export default router;
