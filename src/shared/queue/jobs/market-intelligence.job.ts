import { AnalyticsService } from '../../../domains/analytics/analytics.service';
import { PrismaClient } from '@prisma/client';

/**
 * Story 14-11: Market intelligence report generation job
 * Runs on the 1st of every month via pg-boss
 */
export function createMarketIntelligenceHandler(
  analyticsService: AnalyticsService,
  prisma: PrismaClient
) {
  return async () => {
    console.log('[MarketIntelligence] Starting monthly report generation');

    const cities = await prisma.city.findMany({
      where: { activeStatus: true },
    });

    const results = [];

    for (const city of cities) {
      try {
        const report = await analyticsService.generateMarketIntelligenceReport(city.id);
        results.push({ cityId: city.id, cityName: city.cityName, status: 'success' });
        console.log(`[MarketIntelligence] Report generated for ${city.cityName}`);

        // In production: generate PDF and store in Firebase Storage
      } catch (error: any) {
        if (error.code === 'BUSINESS_INSUFFICIENT_TRANSACTIONS') {
          results.push({
            cityId: city.id,
            cityName: city.cityName,
            status: 'skipped',
            reason: 'Insufficient transactions',
          });
        } else {
          results.push({ cityId: city.id, cityName: city.cityName, status: 'failed', error: error.message });
          console.error(`[MarketIntelligence] Failed for ${city.cityName}:`, error);
        }
      }
    }

    console.log(`[MarketIntelligence] Completed. ${results.length} cities processed.`);
    return results;
  };
}

export const MARKET_INTELLIGENCE_SCHEDULE = '0 6 1 * *'; // 6 AM on the 1st of every month
