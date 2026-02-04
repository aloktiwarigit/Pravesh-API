import { PayoutService } from '../../../domains/dealers/payouts.service';

/**
 * Story 9.14: Scheduled Commission Payout Job
 * AC1: Runs on 1st and 15th of each month at 9 AM.
 * AC3: Skips dealers below Rs. 500 threshold.
 * AC8: Failed payouts retried next cycle.
 */
export function createDealerPayoutHandler(payoutService: PayoutService) {
  return async () => {
    const today = new Date();
    console.log(
      `[DealerPayout] Starting payout cycle for ${today.toISOString().slice(0, 10)}`,
    );

    try {
      const results = await payoutService.processPayoutCycle();
      console.log(
        `[DealerPayout] Completed. Dealers: ${results.totalDealers}, ` +
          `Total: ${results.totalAmountPaise} paise, Failed: ${results.failedPayouts}`,
      );
      return results;
    } catch (error) {
      console.error('[DealerPayout] Error:', error);
      throw error;
    }
  };
}

// Cron: 1st and 15th of each month at 9 AM
export const DEALER_PAYOUT_SCHEDULE_1ST = '0 9 1 * *';
export const DEALER_PAYOUT_SCHEDULE_15TH = '0 9 15 * *';
