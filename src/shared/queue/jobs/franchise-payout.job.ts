import { FranchiseRevenueService } from '../../../domains/franchise/franchise-revenue.service';
import { getCurrentMonth } from '../../utils/date';
import { logger } from '../../utils/logger';

/**
 * Story 14-8: Monthly franchise payout job
 * Runs on the 5th of every month via pg-boss
 */
export function createFranchisePayoutHandler(revenueService: FranchiseRevenueService) {
  return async () => {
    // Process previous month's payouts
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const month = `${previousMonth.getFullYear()}-${String(previousMonth.getMonth() + 1).padStart(2, '0')}`;

    logger.info({ month }, '[FranchisePayout] Processing payouts');

    try {
      const results = await revenueService.processMonthlyPayout(month);
      logger.info({ month, count: results.length }, '[FranchisePayout] Processed franchise payouts');
      return results;
    } catch (error) {
      logger.error({ month, error }, '[FranchisePayout] Error processing payouts');
      throw error;
    }
  };
}

export const FRANCHISE_PAYOUT_SCHEDULE = '0 9 5 * *'; // 9 AM on the 5th of every month
