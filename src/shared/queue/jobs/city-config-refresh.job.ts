import { CityService } from '../../../domains/franchise/city.service';
import { logger } from '../../utils/logger';

/**
 * Story 14-1: Cache refresh job
 * Runs hourly via pg-boss to clear city config cache (AC6)
 */
export function createCityConfigRefreshHandler(cityService: CityService) {
  return async () => {
    cityService.clearCache();
    logger.info({ timestamp: new Date().toISOString() }, '[CityConfigRefresh] Cache cleared');
  };
}

export const CITY_CONFIG_REFRESH_SCHEDULE = '0 * * * *'; // Every hour
