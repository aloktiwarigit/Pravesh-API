/**
 * Daily cash reconciliation pg-boss job.
 * Runs at 23:59 IST daily.
 *
 * Story 4.8: Cash Reconciliation Dashboard for Ops
 */
import { PrismaClient } from '@prisma/client';
import { ReconciliationService } from './reconciliation.service.js';
import { logger } from '../../shared/utils/logger';

export const CASH_RECONCILE_QUEUE = 'cash.reconcile-daily';

export async function registerCashReconcileJob(
  boss: any, // PgBoss instance - namespace import cannot be used as type
  prisma: PrismaClient,
): Promise<void> {
  const reconciliationService = new ReconciliationService(prisma);

  // Schedule daily at 23:59 IST (18:29 UTC)
  await boss.schedule(CASH_RECONCILE_QUEUE, '29 18 * * *', undefined, {
    tz: 'Asia/Kolkata',
  });

  await boss.work(
    CASH_RECONCILE_QUEUE,
    async (job: any) => {
      const today = new Date();

      // Get all active cities (tenant → city migration)
      const cities = await prisma.city.findMany({
        where: { activeStatus: true },
      });

      for (const city of cities) {
        try {
          await reconciliationService.runDailyReconciliation(city.id, today);
        } catch (error) {
          logger.error({ err: error, cityId: city.id }, 'Reconciliation failed');
        }
      }
    },
  );
}
