import { DealerService } from '../../../domains/dealers/dealers.service';
import { logger } from '../../utils/logger';

/**
 * Story 9.8: Monthly Tier Recalculation Job
 * Runs on 1st of every month at 2 AM.
 * Recalculates all dealer tiers based on previous month's referrals.
 * AC5: Tier downgrade possible if referrals drop below threshold.
 * AC7: White-label auto-disabled on demotion from Gold.
 */
export function createTierRecalculateHandler(dealerService: DealerService) {
  return async () => {
    logger.info('[TierRecalculate] Starting monthly tier recalculation');

    try {
      const results = await dealerService.calculateMonthlyTiers();
      logger.info(
        { promoted: results.promoted, demoted: results.demoted, unchanged: results.unchanged },
        '[TierRecalculate] Completed',
      );
      return results;
    } catch (error) {
      logger.error({ err: error }, '[TierRecalculate] Error');
      throw error;
    }
  };
}

// Cron: 1st of every month at 2:00 AM
export const TIER_RECALCULATE_SCHEDULE = '0 2 1 * *';
