/**
 * Central registration for all commission, payout, and tier-related pg-boss jobs.
 * Called once in server.ts after boss.start() completes.
 *
 * Registers:
 * - dealer-commission-calculate (event-driven)
 * - dealer-payout-cycle (1st & 15th of month)
 * - dealer-tier-recalculate (1st of month)
 * - lawyer-payout.* (daily + 1st/15th)
 * - franchise-payout-monthly (5th of month)
 * - cash.reconcile-daily (daily)
 */

import { PrismaClient } from '@prisma/client';
import { CommissionService } from '../../../domains/dealers/commissions.service';
import { BadgeService } from '../../../domains/dealers/badges.service';
import { PayoutService } from '../../../domains/dealers/payouts.service';
import { DealerService } from '../../../domains/dealers/dealers.service';
import { LawyerService } from '../../../domains/lawyers/lawyers.service';
import { FranchiseRevenueService } from '../../../domains/franchise/franchise-revenue.service';
import {
  createCommissionCalculateHandler,
  COMMISSION_CALCULATE_QUEUE,
} from './commission-calculate.job';
import {
  createDealerPayoutHandler,
  DEALER_PAYOUT_SCHEDULE_1ST,
  DEALER_PAYOUT_SCHEDULE_15TH,
} from './dealer-payout.job';
import { createTierRecalculateHandler, TIER_RECALCULATE_SCHEDULE } from './tier-recalculate.job';
import { registerLawyerPayoutJobs } from './lawyer-payout.job';
import { createFranchisePayoutHandler, FRANCHISE_PAYOUT_SCHEDULE } from './franchise-payout.job';
import { registerCashReconcileJob } from '../../../domains/payments/cash-reconcile.job';
import { logger } from '../../utils/logger';

const DEALER_PAYOUT_QUEUE = 'dealer-payout-cycle';
const TIER_RECALCULATE_QUEUE = 'dealer-tier-recalculate';
const FRANCHISE_PAYOUT_QUEUE = 'franchise-payout-monthly';

export async function registerCommissionAndPayoutJobs(
  boss: any,
  prisma: PrismaClient,
): Promise<void> {
  // Instantiate services
  const commissionService = new CommissionService(prisma);
  const badgeService = new BadgeService(prisma);
  const payoutService = new PayoutService(prisma);
  const dealerService = new DealerService(prisma);
  const lawyerService = new LawyerService(prisma);
  const revenueService = new FranchiseRevenueService(prisma);

  // ---- Dealer Commission Calculate (event-driven) ----
  await boss.createQueue(COMMISSION_CALCULATE_QUEUE);
  await boss.work(
    COMMISSION_CALCULATE_QUEUE,
    createCommissionCalculateHandler(commissionService, badgeService),
  );
  logger.info('[Jobs] Registered dealer-commission-calculate (event-driven)');

  // ---- Dealer Payout Cycle (1st & 15th) ----
  await boss.createQueue(DEALER_PAYOUT_QUEUE);
  await boss.work(DEALER_PAYOUT_QUEUE, createDealerPayoutHandler(payoutService));
  await boss.schedule(DEALER_PAYOUT_QUEUE, DEALER_PAYOUT_SCHEDULE_1ST, {}, {
    tz: 'Asia/Kolkata',
  });
  await boss.schedule(`${DEALER_PAYOUT_QUEUE}-15th`, DEALER_PAYOUT_SCHEDULE_15TH, {}, {
    tz: 'Asia/Kolkata',
  });
  logger.info('[Jobs] Registered dealer-payout-cycle (1st & 15th)');

  // ---- Dealer Tier Recalculate (1st of month) ----
  await boss.createQueue(TIER_RECALCULATE_QUEUE);
  await boss.work(TIER_RECALCULATE_QUEUE, createTierRecalculateHandler(dealerService));
  await boss.schedule(TIER_RECALCULATE_QUEUE, TIER_RECALCULATE_SCHEDULE, {}, {
    tz: 'Asia/Kolkata',
  });
  logger.info('[Jobs] Registered dealer-tier-recalculate (monthly)');

  // ---- Lawyer Payout Jobs (daily + 1st/15th) ----
  await registerLawyerPayoutJobs(boss, lawyerService);
  logger.info('[Jobs] Registered lawyer-payout jobs');

  // ---- Franchise Payout Monthly (5th) ----
  await boss.createQueue(FRANCHISE_PAYOUT_QUEUE);
  await boss.work(FRANCHISE_PAYOUT_QUEUE, createFranchisePayoutHandler(revenueService));
  await boss.schedule(FRANCHISE_PAYOUT_QUEUE, FRANCHISE_PAYOUT_SCHEDULE, {}, {
    tz: 'Asia/Kolkata',
  });
  logger.info('[Jobs] Registered franchise-payout-monthly');

  // ---- Cash Reconciliation Daily ----
  await registerCashReconcileJob(boss, prisma);
  logger.info('[Jobs] Registered cash.reconcile-daily');
}
