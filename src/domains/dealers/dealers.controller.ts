// ============================================================
// Epic 9: Dealer Network — Controller
// Stories 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.8, 9.10, 9.11, 9.12, 9.13, 9.15
// Request handling, Zod validation, standard { success, data } response
// ============================================================

import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { DealerService } from './dealers.service';
import { AttributionService } from './attribution.service';
import { BadgeService } from './badges.service';
import { BankAccountService } from './bank-accounts.service';
import {
  dealerKycSubmitSchema,
  kycRejectSchema,
  whiteLabelSchema,
  addBankAccountSchema,
  verifyBankAccountSchema,
  pipelineFilterSchema,
  leaderboardQuerySchema,
} from './dealers.validation';
import { authorize } from '../../middleware/authorize';

export function createDealerController(prisma: PrismaClient): Router {
  const router = Router();
  const dealerService = new DealerService(prisma);
  const attributionService = new AttributionService(prisma);
  const badgeService = new BadgeService(prisma);
  const bankAccountService = new BankAccountService(prisma);

  // Helper: standard error handler
  function handleError(res: Response, error: any) {
    if (error.name === 'ZodError') {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: error.errors },
      });
    }
    const statusCode = error.statusCode || 500;
    const code = error.code || 'SYSTEM_ERROR';
    const message = error.message || 'An unexpected error occurred';
    return res.status(statusCode).json({ success: false, error: { code, message } });
  }

  // ==========================================================
  // Story 9.1: KYC Submission
  // ==========================================================

  // POST /api/v1/dealers/kyc — Submit dealer KYC
  router.post('/kyc', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const cityId = (req as any).scope?.cityId || req.body.cityId;
      const input = dealerKycSubmitSchema.parse(req.body);
      const result = await dealerService.submitKyc(userId, cityId, input);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      handleError(res, error);
    }
  });

  // GET /api/v1/dealers/kyc/status — Check KYC status
  router.get('/kyc/status', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({
        where: { userId },
        include: { kyc: true },
      });
      if (!dealer) {
        return res.json({ success: true, data: { status: 'NOT_STARTED' } });
      }
      res.json({
        success: true,
        data: {
          dealerId: dealer.id,
          dealerStatus: dealer.dealerStatus,
          kycStatus: dealer.kyc?.status ?? null,
          rejectionReason: dealer.kyc?.rejectionReason ?? null,
          reviewedAt: dealer.kyc?.reviewedAt?.toISOString() ?? null,
        },
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ==========================================================
  // Story 9.2: Ops KYC Approval Queue
  // ==========================================================

  // GET /api/v1/dealers/ops/kyc-queue — Ops: list pending KYC
  router.get('/ops/kyc-queue', authorize('ops', 'super_admin'), async (req: Request, res: Response) => {
    try {
      const cityId = req.query.cityId as string | undefined;
      const queue = await prisma.dealerKyc.findMany({
        where: {
          status: 'PENDING',
          ...(cityId ? { dealer: { cityId } } : {}),
        },
        include: { dealer: { select: { id: true, dealerCode: true, cityId: true } } },
        orderBy: { submittedAt: 'asc' },
      });
      res.json({ success: true, data: queue });
    } catch (error) {
      handleError(res, error);
    }
  });

  // POST /api/v1/dealers/ops/:dealerId/approve — Ops approve KYC
  router.post('/ops/:dealerId/approve', authorize('ops', 'super_admin'), async (req: Request, res: Response) => {
    try {
      const opsUserId = (req as any).user?.id;
      const cityId = req.query.cityId as string || '';
      const result = await dealerService.approveKyc(req.params.dealerId, opsUserId, cityId);
      res.json({ success: true, data: result });
    } catch (error) {
      handleError(res, error);
    }
  });

  // POST /api/v1/dealers/ops/:dealerId/reject — Ops reject KYC
  router.post('/ops/:dealerId/reject', authorize('ops', 'super_admin'), async (req: Request, res: Response) => {
    try {
      const opsUserId = (req as any).user?.id;
      const input = kycRejectSchema.parse(req.body);
      const rejectCityId = req.query.cityId as string || '';
      const result = await dealerService.rejectKyc(
        req.params.dealerId,
        opsUserId,
        rejectCityId,
        input.reason,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      handleError(res, error);
    }
  });

  // GET /api/v1/dealers/ops/active — Ops: active dealers list
  router.get('/ops/active', authorize('ops', 'super_admin'), async (req: Request, res: Response) => {
    try {
      const cityId = req.query.cityId as string | undefined;
      const dealers = await prisma.dealer.findMany({
        where: {
          dealerStatus: 'ACTIVE',
          ...(cityId ? { cityId } : {}),
        },
        select: {
          id: true,
          dealerCode: true,
          currentTier: true,
          cityId: true,
          userId: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ success: true, data: dealers });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ==========================================================
  // Story 9.3: Unique Referral Link & QR Code
  // ==========================================================

  // GET /api/v1/dealers/referral-data — Get referral link + QR URL
  router.get('/referral-data', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({ where: { userId } });
      if (!dealer || dealer.dealerStatus !== 'ACTIVE') {
        return res.status(403).json({
          success: false,
          error: { code: 'DEALER_NOT_ACTIVE', message: 'Dealer account not active' },
        });
      }
      const data = await dealerService.getDealerReferralData(dealer.id);
      res.json({ success: true, data });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ==========================================================
  // Story 9.4: Track link click (public endpoint)
  // ==========================================================

  // POST /api/v1/dealers/track-click — Track referral link clicks
  router.post('/track-click', async (req: Request, res: Response) => {
    try {
      const { dealerCode } = req.body;
      if (!dealerCode) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_DEALER_CODE', message: 'dealerCode is required' },
        });
      }
      const dealer = await prisma.dealer.findUnique({
        where: { dealerCode },
        select: { id: true },
      });
      if (!dealer) {
        return res.status(404).json({
          success: false,
          error: { code: 'DEALER_NOT_FOUND', message: 'Invalid dealer code' },
        });
      }
      await prisma.dealerLinkClick.create({
        data: {
          dealerCode,
          userAgent: req.headers['user-agent'] || 'UNKNOWN',
          ipAddress: req.ip || null,
        },
      });
      res.json({ success: true, data: { tracked: true } });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ==========================================================
  // Story 9.5: Customer Attribution
  // ==========================================================

  // POST /api/v1/dealers/attribute — Attribute customer to dealer (from deep link)
  router.post('/attribute', async (req: Request, res: Response) => {
    try {
      const { customerId, dealerCode, source } = req.body;
      if (!customerId || !dealerCode) {
        return res.status(400).json({
          success: false,
          error: { code: 'MISSING_FIELDS', message: 'customerId and dealerCode required' },
        });
      }
      const result = await attributionService.attributeCustomer(
        customerId,
        dealerCode,
        source || 'DEEP_LINK',
      );
      // AC2: Silent — always return success to customer
      res.json({ success: true, data: { attributed: result } });
    } catch (error) {
      // AC2: Never show attribution error to customer
      res.json({ success: true, data: { attributed: false } });
    }
  });

  // ==========================================================
  // Story 9.6: Dealer Pipeline View
  // ==========================================================

  // GET /api/v1/dealers/pipeline — Dealer pipeline with privacy controls
  router.get('/pipeline', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({ where: { userId } });
      if (!dealer) {
        return res.status(403).json({
          success: false,
          error: { code: 'DEALER_NOT_FOUND', message: 'Dealer not found' },
        });
      }
      const filters = pipelineFilterSchema.parse(req.query);
      const pipeline = await dealerService.getDealerPipeline(
        dealer.id,
        filters,
        req.query.cursor as string | undefined,
      );
      res.json({ success: true, data: pipeline });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ==========================================================
  // Story 9.8: Tier Management
  // ==========================================================

  // GET /api/v1/dealers/tier-progress — Tier progress for current month
  router.get('/tier-progress', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({ where: { userId } });
      if (!dealer) {
        return res.status(403).json({
          success: false,
          error: { code: 'DEALER_NOT_FOUND', message: 'Dealer not found' },
        });
      }
      const progress = await dealerService.getTierProgress(dealer.id);
      res.json({ success: true, data: progress });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ==========================================================
  // Story 9.10: Leaderboard
  // ==========================================================

  // GET /api/v1/dealers/leaderboard — City-scoped leaderboard
  router.get('/leaderboard', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({
        where: { userId },
        select: { id: true, cityId: true },
      });
      if (!dealer) {
        return res.status(403).json({
          success: false,
          error: { code: 'DEALER_NOT_FOUND', message: 'Dealer not found' },
        });
      }
      const query = leaderboardQuerySchema.parse(req.query);
      const leaderboard = await dealerService.getLeaderboard(
        dealer.cityId,
        dealer.id,
        query.period,
      );
      res.json({ success: true, data: leaderboard });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ==========================================================
  // Story 9.11: Gamification Badges
  // ==========================================================

  // GET /api/v1/dealers/badges — Get dealer badges
  router.get('/badges', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({ where: { userId } });
      if (!dealer) {
        return res.status(403).json({
          success: false,
          error: { code: 'DEALER_NOT_FOUND', message: 'Dealer not found' },
        });
      }
      const badges = await badgeService.getDealerBadges(dealer.id);
      res.json({ success: true, data: badges });
    } catch (error) {
      handleError(res, error);
    }
  });

  // GET /api/v1/dealers/badges/progress — Next badge progress
  router.get('/badges/progress', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({ where: { userId } });
      if (!dealer) {
        return res.status(403).json({
          success: false,
          error: { code: 'DEALER_NOT_FOUND', message: 'Dealer not found' },
        });
      }
      const progress = await badgeService.getNextBadgeProgress(dealer.id);
      res.json({ success: true, data: progress });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ==========================================================
  // Story 9.12: White-Label Mode
  // ==========================================================

  // GET /api/v1/dealers/white-label — Get white-label settings
  router.get('/white-label', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({ where: { userId } });
      if (!dealer) {
        return res.status(403).json({
          success: false,
          error: { code: 'DEALER_NOT_FOUND', message: 'Dealer not found' },
        });
      }
      res.json({
        success: true,
        data: {
          whitelabelEnabled: dealer.whitelabelEnabled,
          logoUrl: dealer.logoUrl,
          brandColor: dealer.brandColor,
          currentTier: dealer.currentTier,
          isEligible: dealer.currentTier === 'GOLD',
        },
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  // PUT /api/v1/dealers/white-label — Update white-label settings
  router.put('/white-label', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({ where: { userId } });
      if (!dealer) {
        return res.status(403).json({
          success: false,
          error: { code: 'DEALER_NOT_FOUND', message: 'Dealer not found' },
        });
      }
      const input = whiteLabelSchema.parse(req.body);
      const result = await dealerService.updateWhiteLabel(dealer.id, input);
      res.json({ success: true, data: result });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ==========================================================
  // Story 9.13: Bank Account Management
  // ==========================================================

  // GET /api/v1/dealers/bank-accounts — List bank accounts (masked)
  router.get('/bank-accounts', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({ where: { userId } });
      if (!dealer) {
        return res.status(403).json({
          success: false,
          error: { code: 'DEALER_NOT_FOUND', message: 'Dealer not found' },
        });
      }
      const accounts = await bankAccountService.getDealerAccounts(dealer.id);
      res.json({ success: true, data: accounts });
    } catch (error) {
      handleError(res, error);
    }
  });

  // POST /api/v1/dealers/bank-accounts — Add bank account
  router.post('/bank-accounts', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({ where: { userId } });
      if (!dealer) {
        return res.status(403).json({
          success: false,
          error: { code: 'DEALER_NOT_FOUND', message: 'Dealer not found' },
        });
      }
      const input = addBankAccountSchema.parse(req.body);
      const account = await bankAccountService.addBankAccount(dealer.id, input);
      res.status(201).json({ success: true, data: account });
    } catch (error) {
      handleError(res, error);
    }
  });

  // POST /api/v1/dealers/bank-accounts/:accountId/verify — Verify bank account
  router.post('/bank-accounts/:accountId/verify', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({ where: { userId } });
      if (!dealer) {
        return res.status(403).json({
          success: false,
          error: { code: 'DEALER_NOT_FOUND', message: 'Dealer not found' },
        });
      }
      const input = verifyBankAccountSchema.parse(req.body);
      const result = await bankAccountService.verifyBankAccount(
        dealer.id,
        req.params.accountId,
        input.code,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      handleError(res, error);
    }
  });

  // POST /api/v1/dealers/bank-accounts/:accountId/set-primary — Set primary account
  router.post('/bank-accounts/:accountId/set-primary', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({ where: { userId } });
      if (!dealer) {
        return res.status(403).json({
          success: false,
          error: { code: 'DEALER_NOT_FOUND', message: 'Dealer not found' },
        });
      }
      const result = await bankAccountService.setPrimaryAccount(
        dealer.id,
        req.params.accountId,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ==========================================================
  // Story 9.15: Dealer Profile
  // ==========================================================

  // GET /api/v1/dealers/profile — Dealer profile
  router.get('/profile', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({
        where: { userId },
        include: {
          kyc: {
            select: {
              status: true,
              aadhaarMasked: true,
              reviewedAt: true,
            },
          },
        },
      });
      if (!dealer) {
        return res.status(404).json({
          success: false,
          error: { code: 'DEALER_NOT_FOUND', message: 'Dealer not found' },
        });
      }
      res.json({
        success: true,
        data: {
          id: dealer.id,
          dealerCode: dealer.dealerCode,
          dealerStatus: dealer.dealerStatus,
          currentTier: dealer.currentTier,
          businessName: dealer.businessName,
          whitelabelEnabled: dealer.whitelabelEnabled,
          logoUrl: dealer.logoUrl,
          kycStatus: dealer.kyc?.status ?? null,
          aadhaarMasked: dealer.kyc?.aadhaarMasked ?? null,
          cityId: dealer.cityId,
          createdAt: dealer.createdAt.toISOString(),
        },
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  return router;
}
