import { Router } from 'express';
import { LawyerController } from '../domains/lawyers/lawyers.controller';
import { LawyerService } from '../domains/lawyers/lawyers.service';
import { prisma } from '../shared/prisma/client';
import { authorize } from '../middleware/authorize';

const router = Router();

// Initialize service and controller
// Cast prisma as any because the extended client type is not directly assignable to PrismaClient
const lawyerService = new LawyerService(prisma as any);
const lawyerController = new LawyerController(lawyerService);

// ============================================================
// Story 12-1: Lawyer Registration & Verification
// ============================================================

// POST /api/v1/lawyers/register — Lawyer submits registration (authenticated)
router.post('/register', authorize('lawyer', 'ops'), lawyerController.register);

// POST /api/v1/lawyers/verify — Ops approves/rejects lawyer (ops role)
router.post('/verify', authorize('ops'), lawyerController.verify);

// GET /api/v1/lawyers/me — Lawyer views own profile (lawyer role)
router.get('/me', authorize('lawyer'), lawyerController.getMyProfile);

// GET /api/v1/lawyers/pending-verifications — Ops views pending lawyers (ops role)
router.get('/pending-verifications', authorize('ops'), lawyerController.getPendingVerifications);

// ============================================================
// Story 12-2: Expertise Tagging
// ============================================================

// POST /api/v1/lawyers/expertise — Ops assigns expertise tags (ops role)
router.post('/expertise', authorize('ops'), lawyerController.assignExpertise);

// POST /api/v1/lawyers/expertise/request — Lawyer requests additional tag (lawyer role)
router.post('/expertise/request', authorize('lawyer'), lawyerController.requestExpertise);

// POST /api/v1/lawyers/expertise/review — Ops reviews expertise request (ops role)
router.post('/expertise/review', authorize('ops'), lawyerController.reviewExpertiseRequest);

// ============================================================
// Story 12-3: Case Routing
// ============================================================

// GET /api/v1/lawyers/suggestions?expertiseTag=TITLE_OPINIONS — Ops gets matched lawyers (ops role)
router.get('/suggestions', authorize('ops'), lawyerController.getSuggestedLawyers);

// ============================================================
// Story 12-8: Payment & Bank Account
// ============================================================

// POST /api/v1/lawyers/bank-accounts — Lawyer saves bank details (lawyer role)
router.post('/bank-accounts', authorize('lawyer'), lawyerController.saveBankAccount);

// GET /api/v1/lawyers/bank-accounts — Lawyer views bank accounts (lawyer role)
router.get('/bank-accounts', authorize('lawyer'), lawyerController.getBankAccounts);

// GET /api/v1/lawyers/payouts — Lawyer views payout history (lawyer role)
router.get('/payouts', authorize('lawyer'), lawyerController.getPayoutHistory);

// ============================================================
// Story 12-9: Ratings
// ============================================================

// GET /api/v1/lawyers/my-ratings — Lawyer views aggregated ratings (lawyer role)
router.get('/my-ratings', authorize('lawyer'), lawyerController.getMyRatingSummary);

// GET /api/v1/lawyers/:lawyerId/ratings — Ops views detailed ratings (ops role)
router.get('/:lawyerId/ratings', authorize('ops'), lawyerController.getLawyerRatingsOps);

// ============================================================
// Story 12-10: Earnings Dashboard
// ============================================================

// GET /api/v1/lawyers/earnings?month=1&year=2026 — Lawyer earnings dashboard (lawyer role)
router.get('/earnings', authorize('lawyer'), lawyerController.getEarningsDashboard);

// GET /api/v1/lawyers/case-history — Lawyer case history with filters (lawyer role)
router.get('/case-history', authorize('lawyer'), lawyerController.getCaseHistory);

// ============================================================
// Story 12-11: Ops Commission & Deactivation
// ============================================================

// PUT /api/v1/lawyers/:lawyerId/commission — Ops adjusts commission (ops role)
router.put('/:lawyerId/commission', authorize('ops'), lawyerController.updateCommissionRate);

// POST /api/v1/lawyers/:lawyerId/deactivate — Ops deactivates lawyer (ops role)
router.post('/:lawyerId/deactivate', authorize('ops'), lawyerController.deactivateLawyer);

// ============================================================
// Story 12-12: DND Toggle
// ============================================================

// PUT /api/v1/lawyers/dnd — Lawyer toggles DND (lawyer role)
router.put('/dnd', authorize('lawyer'), lawyerController.toggleDnd);

// GET /api/v1/lawyers/my-cases — Lawyer views own cases (lawyer role)
router.get('/my-cases', authorize('lawyer'), lawyerController.getMyCases);

export default router;
