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
      const cursor = req.query.cursor as string | undefined;
      const limit = parseInt(req.query.limit as string) || 50;
      const queue = await prisma.dealerKyc.findMany({
        where: {
          status: 'PENDING',
          ...(cityId ? { dealer: { cityId } } : {}),
        },
        include: { dealer: { select: { id: true, dealerCode: true, cityId: true } } },
        orderBy: { submittedAt: 'asc' },
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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
      const cursor = req.query.cursor as string | undefined;
      const limit = parseInt(req.query.limit as string) || 100;
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
        take: limit,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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
      let dealer = await prisma.dealer.findUnique({
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

      // Auto-provision dev dealer when DEV_AUTH_BYPASS is active
      if (!dealer && process.env.DEV_AUTH_BYPASS === 'true') {
        const city = await prisma.city.findFirst();
        dealer = await prisma.dealer.create({
          data: {
            userId,
            dealerCode: `DEV-${Date.now().toString(36).toUpperCase()}`,
            dealerStatus: 'ACTIVE',
            currentTier: 'BRONZE',
            businessName: 'Dev Dealer',
            cityId: city?.id ?? 'dev-city',
          },
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
      }

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

  // GET /api/v1/dealers/kyc-status — Alias for Flutter compatibility
  router.get('/kyc-status', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({
        where: { userId },
        include: { kyc: true },
      });
      if (!dealer) {
        return res.json({ success: true, data: { status: 'NOT_STARTED', kycStatus: 'NOT_STARTED' } });
      }
      res.json({
        success: true,
        data: {
          dealerId: dealer.id,
          dealerStatus: dealer.dealerStatus,
          status: dealer.kyc?.status ?? 'NOT_STARTED',
          kycStatus: dealer.kyc?.status ?? 'NOT_STARTED',
          rejectionReason: dealer.kyc?.rejectionReason ?? null,
          reviewedAt: dealer.kyc?.reviewedAt?.toISOString() ?? null,
        },
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  // ==========================================================
  // Flutter /me/ path aliases
  // The Flutter app uses /dealers/me/<resource> while the backend
  // originally used /dealers/<resource>. These aliases bridge that gap.
  // ==========================================================

  // GET /dealers/me/referral → same as /dealers/referral-data
  router.get('/me/referral', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({ where: { userId } });
      if (!dealer || dealer.dealerStatus !== 'ACTIVE') {
        return res.json({
          success: true,
          data: {
            referralLink: '',
            qrCodeUrl: '',
            clickCount: 0,
            dealerCode: dealer?.dealerCode ?? '--',
          },
        });
      }
      const data = await dealerService.getDealerReferralData(dealer.id);
      res.json({ success: true, data });
    } catch (error) {
      handleError(res, error);
    }
  });

  // GET /dealers/me/pipeline → same as /dealers/pipeline
  router.get('/me/pipeline', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({ where: { userId } });
      if (!dealer) {
        return res.json({ success: true, data: [] });
      }
      const filters = pipelineFilterSchema.parse(req.query);
      const pipeline = await dealerService.getDealerPipeline(
        dealer.id, filters, req.query.cursor as string | undefined,
      );
      res.json({ success: true, data: pipeline });
    } catch (error) {
      handleError(res, error);
    }
  });

  // GET /dealers/me/earnings/summary
  router.get('/me/earnings/summary', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({ where: { userId } });
      if (!dealer) {
        return res.json({
          success: true,
          data: { totalEarnedPaise: 0, pendingPaise: 0, paidPaise: 0 },
        });
      }
      // Aggregate from commissions
      const [total, pending, paid] = await Promise.all([
        prisma.dealerCommission.aggregate({
          where: { dealerId: dealer.id },
          _sum: { commissionAmountPaise: true },
        }),
        prisma.dealerCommission.aggregate({
          where: { dealerId: dealer.id, status: 'PENDING' },
          _sum: { commissionAmountPaise: true },
        }),
        prisma.dealerCommission.aggregate({
          where: { dealerId: dealer.id, status: 'PAID' },
          _sum: { commissionAmountPaise: true },
        }),
      ]);
      res.json({
        success: true,
        data: {
          totalEarnedPaise: Number(total._sum?.commissionAmountPaise ?? 0),
          pendingPaise: Number(pending._sum?.commissionAmountPaise ?? 0),
          paidPaise: Number(paid._sum?.commissionAmountPaise ?? 0),
        },
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  // GET /dealers/me/earnings/forecast
  router.get('/me/earnings/forecast', async (req: Request, res: Response) => {
    try {
      res.json({
        success: true,
        data: { forecastPaise: 0, inProgressCount: 0, avgCommissionPaise: 0 },
      });
    } catch (error) {
      handleError(res, error);
    }
  });

  // GET /dealers/me/commissions
  router.get('/me/commissions', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({ where: { userId } });
      if (!dealer) {
        return res.json({ success: true, data: [] });
      }
      const statusFilter = req.query.status as string | undefined;
      const where: any = { dealerId: dealer.id };
      if (statusFilter) where.status = statusFilter;
      const commissions = await prisma.dealerCommission.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: parseInt(req.query.limit as string, 10) || 20,
      });
      res.json({ success: true, data: commissions });
    } catch (error) {
      handleError(res, error);
    }
  });

  // GET /dealers/me/tier-progress → same as /dealers/tier-progress
  router.get('/me/tier-progress', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({ where: { userId } });
      if (!dealer) {
        return res.json({
          success: true,
          data: {
            currentTier: 'BRONZE',
            nextTier: 'SILVER',
            referralsThisMonth: 0,
            referralsNeeded: 5,
            progressPercent: 0,
          },
        });
      }
      const progress = await dealerService.getTierProgress(dealer.id);
      res.json({ success: true, data: progress });
    } catch (error) {
      handleError(res, error);
    }
  });

  // GET /dealers/me/badges → same as /dealers/badges
  router.get('/me/badges', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({ where: { userId } });
      if (!dealer) {
        return res.json({ success: true, data: [] });
      }
      const badges = await badgeService.getDealerBadges(dealer.id);
      res.json({ success: true, data: badges });
    } catch (error) {
      handleError(res, error);
    }
  });

  // GET /dealers/me/badge-progress → same as /dealers/badges/progress
  router.get('/me/badge-progress', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({ where: { userId } });
      if (!dealer) {
        return res.json({ success: true, data: null });
      }
      const progress = await badgeService.getNextBadgeProgress(dealer.id);
      res.json({ success: true, data: progress });
    } catch (error) {
      handleError(res, error);
    }
  });

  // POST /dealers/me/bank-accounts → same as POST /dealers/bank-accounts
  router.post('/me/bank-accounts', async (req: Request, res: Response) => {
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

  // PUT /dealers/me/bank-accounts/:accountId/primary → set primary bank account
  router.put('/me/bank-accounts/:accountId/primary', async (req: Request, res: Response) => {
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

  // POST /dealers/me/verify → stub for dealer verification
  router.post('/me/verify', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({ where: { userId } });
      if (!dealer) {
        return res.status(404).json({
          success: false,
          error: { code: 'DEALER_NOT_FOUND', message: 'Dealer not found' },
        });
      }
      res.json({ success: true, data: { verified: true, dealerId: dealer.id } });
    } catch (error) {
      handleError(res, error);
    }
  });

  // GET /dealers/me/bank-accounts → same as /dealers/bank-accounts
  router.get('/me/bank-accounts', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({ where: { userId } });
      if (!dealer) {
        return res.json({ success: true, data: [] });
      }
      const accounts = await bankAccountService.getDealerAccounts(dealer.id);
      res.json({ success: true, data: accounts });
    } catch (error) {
      handleError(res, error);
    }
  });

  // GET /dealers/me/payouts
  router.get('/me/payouts', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const dealer = await prisma.dealer.findUnique({ where: { userId } });
      if (!dealer) {
        return res.json({ success: true, data: [] });
      }
      const payouts = await prisma.dealerPayout.findMany({
        where: { dealerId: dealer.id },
        orderBy: { createdAt: 'desc' },
        take: parseInt(req.query.limit as string, 10) || 20,
      });
      res.json({ success: true, data: payouts });
    } catch (error) {
      handleError(res, error);
    }
  });

  // POST /dealers/register → stub for dealer registration
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      // Check if already registered
      const existing = await prisma.dealer.findUnique({ where: { userId } });
      if (existing) {
        return res.json({ success: true, data: { dealerId: existing.id } });
      }
      // Auto-create minimal dealer record
      const city = await prisma.city.findFirst();
      const dealer = await prisma.dealer.create({
        data: {
          userId,
          dealerCode: `DLR-${Date.now().toString(36).toUpperCase()}`,
          dealerStatus: 'PENDING_KYC',
          currentTier: 'BRONZE',
          businessName: req.body.businessName || 'New Dealer',
          cityId: req.body.cityId || city?.id || 'unknown',
        },
      });
      res.status(201).json({ success: true, data: { dealerId: dealer.id } });
    } catch (error) {
      handleError(res, error);
    }
  });

  return router;
}
