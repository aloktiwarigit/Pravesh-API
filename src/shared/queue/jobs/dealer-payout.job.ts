import { PayoutService } from '../../../domains/dealers/payouts.service';
import { logger } from '../../utils/logger';

/**
 * Story 9.14: Scheduled Commission Payout Job
 * AC1: Runs on 1st and 15th of each month at 9 AM.
 * AC3: Skips dealers below Rs. 500 threshold.
 * AC8: Failed payouts retried next cycle.
 */
export function createDealerPayoutHandler(payoutService: PayoutService) {
  return async () => {
    const today = new Date();
    logger.info(
      { date: today.toISOString().slice(0, 10) },
      '[DealerPayout] Starting payout cycle'
    );

    try {
      const results = await payoutService.processPayoutCycle();
      logger.info(
        {
          totalDealers: results.totalDealers,
          totalAmountPaise: results.totalAmountPaise,
          failedPayouts: results.failedPayouts
        },
        '[DealerPayout] Completed'
      );
      return results;
    } catch (error) {
      logger.error({ error }, '[DealerPayout] Error');
      throw error;
    }
  };
}

// Cron: 1st and 15th of each month at 9 AM
export const DEALER_PAYOUT_SCHEDULE_1ST = '0 9 1 * *';
export const DEALER_PAYOUT_SCHEDULE_15TH = '0 9 15 * *';
