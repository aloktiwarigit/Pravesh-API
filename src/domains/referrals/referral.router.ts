/**
 * Referral API routes.
 *
 * Story 4.11: Customer Referral Credits - Earn
 */
import { Router, Request, Response } from 'express';
import { ReferralService } from './referral.service.js';

export function createReferralRouter(deps: {
  referralService: ReferralService;
  authMiddleware: Function;
  roleMiddleware: Function;
  validate: Function;
}) {
  const router = Router();
  const { referralService, authMiddleware, roleMiddleware, validate } = deps;

  // GET /api/v1/referrals/code
  router.get(
    '/code',
    authMiddleware as any,
    roleMiddleware(['customer']) as any,
    async (req: Request, res: Response) => {
      const customerId = (req as any).user!.id;
      const tenantId = (req as any).user!.cityId;

      const referralCode = await referralService.getOrCreateReferralCode(customerId, tenantId);
      const referralLink = `https://pla.app/ref/${referralCode}`;

      res.json({
        success: true,
        data: { referralCode, referralLink },
      });
    },
  );

  // GET /api/v1/referrals/credits
  router.get(
    '/credits',
    authMiddleware as any,
    roleMiddleware(['customer']) as any,
    async (req: Request, res: Response) => {
      const customerId = (req as any).user!.id;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const [balance, { credits, total }] = await Promise.all([
        referralService.getCreditBalance(customerId),
        referralService.getCreditHistory(customerId, page, limit),
      ]);

      res.json({
        success: true,
        data: {
          balancePaise: balance.toString(),
          credits: credits.map((c: any) => ({
            id: c.id,
            creditAmountPaise: c.creditAmountPaise?.toString() ?? '0',
            creditedAt: c.creditedAt?.toISOString() ?? null,
            serviceRequestId: c.serviceRequestId ?? null,
          })),
          pagination: { page, limit, total },
        },
      });
    },
  );

  return router;
}
