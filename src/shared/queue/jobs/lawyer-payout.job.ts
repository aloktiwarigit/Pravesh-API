import { LawyerService } from '../../../domains/lawyers/lawyers.service';

/**
 * Story 12-8: Lawyer Payout Scheduled Jobs
 *
 * Two scheduled jobs:
 * 1. Auto-confirm: Runs daily, confirms payouts older than 7 days
 * 2. Process batch: Runs on 1st and 15th, processes confirmed payouts
 */

export function registerLawyerPayoutJobs(boss: any, lawyerService: LawyerService) {
  // Auto-confirm job: runs daily at midnight
  (boss as any).schedule('lawyer-payout.auto-confirm', '0 0 * * *', {});
  (boss as any).work('lawyer-payout.auto-confirm', async () => {
    const result = await lawyerService.autoConfirmPayouts();
    console.log(`[lawyer-payout.auto-confirm] Auto-confirmed ${result.count} payouts`);
  });

  // Payout batch processing: runs on 1st and 15th at 6 AM IST
  (boss as any).schedule('lawyer-payout.process-batch', '0 0 1,15 * *', {});
  (boss as any).work('lawyer-payout.process-batch', async () => {
    const result = await lawyerService.processPayoutBatch();
    console.log(
      `[lawyer-payout.process-batch] Processed batch ${result.batchId} with ${result.count} payouts`,
    );

    // In production: enqueue confirmation notifications for each processed payout
    // await boss.send('notification.send', { template: 'lawyer-payout-completed', ... });
  });
}
