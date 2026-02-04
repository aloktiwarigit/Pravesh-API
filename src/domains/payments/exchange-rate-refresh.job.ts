// Story 13-3: Daily Exchange Rate Refresh pg-boss Job
import { ExchangeRateService } from './exchange-rate.service.js';

export function registerExchangeRateRefreshJob(
  boss: any, // PgBoss instance - namespace import cannot be used as type
  service: ExchangeRateService
) {
  // Schedule daily at 6 AM IST (12:30 AM UTC)
  boss.schedule('exchange-rate.refresh', '30 0 * * *');

  boss.work('exchange-rate.refresh', async () => {
    await service.refreshRates();
  });
}
