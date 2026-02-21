import { Router } from 'express';
import { LawyerController } from '../domains/lawyers/lawyers.controller';
import { LawyerService } from '../domains/lawyers/lawyers.service';
import { prisma } from '../shared/prisma/client';

const router = Router();

// Initialize service and controller
// Cast prisma as any because the extended client type is not directly assignable to PrismaClient
const lawyerService = new LawyerService(prisma as any);
const lawyerController = new LawyerController(lawyerService);

// ============================================================
// Story 12-11: Ops Legal Marketplace Management
// ============================================================

// GET /api/v1/ops/legal-marketplace/dashboard — Marketplace overview (ops role)
router.get('/dashboard', lawyerController.getMarketplaceDashboard);

// GET /api/v1/ops/legal-marketplace/lawyers — Lawyer leaderboard (ops role)
router.get('/lawyers', lawyerController.getLawyerLeaderboard);

// GET /api/v1/ops/legal-marketplace/lawyers/:lawyerId — Lawyer detail drill-down (ops role)
router.get('/lawyers/:lawyerId', lawyerController.getLawyerDetailOps);

export default router;
