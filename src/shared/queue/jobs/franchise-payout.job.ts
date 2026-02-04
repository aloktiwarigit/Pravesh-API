import { FranchiseRevenueService } from '../../../domains/franchise/franchise-revenue.service';
import { getCurrentMonth } from '../../utils/date';

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

    console.log(`[FranchisePayout] Processing payouts for ${month}`);

    try {
      const results = await revenueService.processMonthlyPayout(month);
      console.log(`[FranchisePayout] Processed ${results.length} franchise payouts for ${month}`);
      return results;
    } catch (error) {
      console.error(`[FranchisePayout] Error processing payouts for ${month}:`, error);
      throw error;
    }
  };
}

export const FRANCHISE_PAYOUT_SCHEDULE = '0 9 5 * *'; // 9 AM on the 5th of every month
