import { CityService } from '../../../domains/franchise/city.service';

/**
 * Story 14-1: Cache refresh job
 * Runs hourly via pg-boss to clear city config cache (AC6)
 */
export function createCityConfigRefreshHandler(cityService: CityService) {
  return async () => {
    cityService.clearCache();
    console.log('[CityConfigRefresh] Cache cleared at', new Date().toISOString());
  };
}

export const CITY_CONFIG_REFRESH_SCHEDULE = '0 * * * *'; // Every hour
