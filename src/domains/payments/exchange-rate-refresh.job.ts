// Story 13-3: Daily Exchange Rate Refresh pg-boss Job
import { ExchangeRateService } from './exchange-rate.service.js';

export async function registerExchangeRateRefreshJob(
  boss: any, // PgBoss instance - namespace import cannot be used as type
  service: ExchangeRateService
) {
  await boss.createQueue('exchange-rate.refresh');

  // Schedule daily at 6 AM IST (12:30 AM UTC)
  await boss.schedule('exchange-rate.refresh', '30 0 * * *');

  await boss.work('exchange-rate.refresh', async () => {
    await service.refreshRates();
  });
}
