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
// Story 12-11: Ops Legal Marketplace Management
// ============================================================

// GET /api/v1/ops/legal-marketplace/dashboard — Marketplace overview (ops role)
router.get('/dashboard', authorize('ops', 'super_admin'), lawyerController.getMarketplaceDashboard);

// GET /api/v1/ops/legal-marketplace/lawyers — Lawyer leaderboard (ops role)
router.get('/lawyers', authorize('ops', 'super_admin'), lawyerController.getLawyerLeaderboard);

// GET /api/v1/ops/legal-marketplace/lawyers/:lawyerId — Lawyer detail drill-down (ops role)
router.get('/lawyers/:lawyerId', authorize('ops', 'super_admin'), lawyerController.getLawyerDetailOps);

export default router;
