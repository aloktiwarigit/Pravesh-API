import { PrismaClient } from '@prisma/client';
import { cityConfigSchema, CityConfig } from './franchise.types';
import { BusinessError } from '../../shared/errors/business-error';
import * as ErrorCodes from '../../shared/errors/error-codes';

// TODO: Replace in-memory Map cache with Redis (e.g. ioredis) for multi-instance deployments.
// The current Map cache is process-local and will not be consistent across multiple API instances.
export class CityService {
  private cache: Map<string, { data: any; expiry: number }> = new Map();
  private CACHE_TTL = 5 * 60 * 1000; // 5 minutes max — short TTL to limit staleness across instances

  constructor(private prisma: PrismaClient) {}

  /**
   * Create a new city configuration (AC1, AC2, AC3, AC7)
   */
  async createCity(params: {
    cityName: string;
    state: string;
    configData: CityConfig;
    createdBy: string;
  }) {
    // Validate config against Zod schema (AC3)
    const validatedConfig = cityConfigSchema.parse(params.configData);

    try {
      const city = await this.prisma.city.create({
        data: {
          cityName: params.cityName,
          state: params.state,
          configData: validatedConfig as any,
          version: 1,
          createdBy: params.createdBy,
        },
      });

      return city;
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BusinessError(
          ErrorCodes.BUSINESS_CITY_ALREADY_EXISTS,
          `City "${params.cityName}" in ${params.state} already exists`,
          409
        );
      }
      throw error;
    }
  }

  /**
   * Update city configuration (AC6, AC7)
   * Version is auto-incremented on every update.
   */
  async updateCityConfig(cityId: string, configData: CityConfig) {
    // Validate config against Zod schema (AC3)
    const validatedConfig = cityConfigSchema.parse(configData);

    const city = await this.prisma.city.update({
      where: { id: cityId },
      data: {
        configData: validatedConfig as any,
        version: { increment: 1 },
      },
    });

    // Invalidate cache so next read fetches fresh data (AC6)
    this.cache.delete(cityId);
    return city;
  }

  /**
   * Get city configuration with caching (AC6)
   * Cache TTL: 1 hour. Refreshed by pg-boss scheduled job.
   */
  async getCityConfig(cityId: string) {
    const cached = this.cache.get(cityId);
    if (cached && cached.expiry > Date.now()) {
      return cached.data;
    }

    const city = await this.prisma.city.findUnique({
      where: { id: cityId },
    });

    if (!city) {
      throw new BusinessError(
        ErrorCodes.BUSINESS_CITY_NOT_FOUND,
        `City with ID "${cityId}" not found`,
        404
      );
    }

    this.cache.set(cityId, {
      data: city,
      expiry: Date.now() + this.CACHE_TTL,
    });

    return city;
  }

  /**
   * List all active cities (AC4)
   * Used by city selector dropdown for Franchise Owner assignment.
   */
  async listActiveCities() {
    return this.prisma.city.findMany({
      where: { activeStatus: true },
      orderBy: { cityName: 'asc' },
      select: {
        id: true,
        cityName: true,
        state: true,
        activeStatus: true,
        version: true,
        createdAt: true,
      },
    });
  }

  /**
   * List all cities (for Super Admin)
   */
  async listAllCities() {
    return this.prisma.city.findMany({
      orderBy: { cityName: 'asc' },
    });
  }

  /**
   * Deactivate a city
   */
  async deactivateCity(cityId: string) {
    const city = await this.prisma.city.update({
      where: { id: cityId },
      data: { activeStatus: false },
    });

    this.cache.delete(cityId);
    return city;
  }

  /**
   * Activate a city
   */
  async activateCity(cityId: string) {
    const city = await this.prisma.city.update({
      where: { id: cityId },
      data: { activeStatus: true },
    });

    this.cache.delete(cityId);
    return city;
  }

  /**
   * Clear all cached city configs (called by pg-boss hourly job)
   */
  clearCache() {
    this.cache.clear();
  }
}
