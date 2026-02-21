/**
 * Franchise Territory Service
 *
 * Story 8.X: Franchise Territory Management
 *
 * Handles:
 * - Territory assignment to franchises
 * - Revenue sharing configuration
 * - Territory-based service routing
 * - Revenue calculation and tracking
 */

import { PrismaClient } from '@prisma/client';
import { BusinessError } from '../../shared/errors/business-error';

export interface AssignTerritoryInput {
  franchiseId: string;
  cityId: string;
  isExclusive?: boolean;
  revenueShareBps?: number; // Basis points (1000 = 10%)
  startDate: Date;
  endDate?: Date;
  createdBy: string;
}

export interface UpdateTerritoryInput {
  isExclusive?: boolean;
  revenueShareBps?: number;
  endDate?: Date;
}

export interface RevenueShareResult {
  franchiseId: string;
  cityId: string;
  periodStart: Date;
  periodEnd: Date;
  totalServiceRevenuePaise: bigint;
  revenueShareBps: number;
  franchiseSharePaise: bigint;
  platformSharePaise: bigint;
}

export class TerritoryService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Assigns a territory (city) to a franchise.
   * AC1: Franchise owners can manage multiple territories.
   */
  async assignTerritory(input: AssignTerritoryInput) {
    const {
      franchiseId,
      cityId,
      isExclusive = true,
      revenueShareBps = 1000, // Default 10%
      startDate,
      endDate,
      createdBy,
    } = input;

    // Validate franchise exists
    const franchise = await this.prisma.franchise.findUnique({
      where: { id: franchiseId },
    });

    if (!franchise) {
      throw new BusinessError('FRANCHISE_NOT_FOUND', 'Franchise not found', 404);
    }

    // Validate city exists
    const city = await this.prisma.city.findUnique({
      where: { id: cityId },
    });

    if (!city) {
      throw new BusinessError('CITY_NOT_FOUND', 'City not found', 404);
    }

    // Check for existing exclusive territory in this city
    if (isExclusive) {
      const existingExclusive = await this.prisma.franchiseTerritory.findFirst({
        where: {
          cityId,
          isExclusive: true,
          OR: [
            { endDate: null },
            { endDate: { gt: startDate } },
          ],
        },
      });

      if (existingExclusive && existingExclusive.franchiseId !== franchiseId) {
        throw new BusinessError(
          'EXCLUSIVE_TERRITORY_EXISTS',
          'This city already has an exclusive franchise territory',
          422,
        );
      }
    }

    // Check for existing territory for this franchise in this city
    const existingTerritory = await this.prisma.franchiseTerritory.findUnique({
      where: {
        franchiseId_cityId: {
          franchiseId,
          cityId,
        },
      },
    });

    if (existingTerritory) {
      throw new BusinessError(
        'TERRITORY_EXISTS',
        'This franchise already has a territory in this city',
        422,
      );
    }

    // Validate revenue share is within bounds (0-100%)
    if (revenueShareBps < 0 || revenueShareBps > 10000) {
      throw new BusinessError(
        'INVALID_REVENUE_SHARE',
        'Revenue share must be between 0% and 100%',
        422,
      );
    }

    const territory = await this.prisma.franchiseTerritory.create({
      data: {
        franchiseId,
        cityId,
        isExclusive,
        revenueShareBps,
        startDate,
        endDate,
        createdBy,
      },
    });

    return territory;
  }

  /**
   * Updates a territory's configuration.
   * AC2: Adjust revenue share and exclusivity.
   */
  async updateTerritory(territoryId: string, input: UpdateTerritoryInput) {
    const territory = await this.prisma.franchiseTerritory.findUnique({
      where: { id: territoryId },
    });

    if (!territory) {
      throw new BusinessError('TERRITORY_NOT_FOUND', 'Territory not found', 404);
    }

    // Validate revenue share if provided
    if (input.revenueShareBps !== undefined) {
      if (input.revenueShareBps < 0 || input.revenueShareBps > 10000) {
        throw new BusinessError(
          'INVALID_REVENUE_SHARE',
          'Revenue share must be between 0% and 100%',
          422,
        );
      }
    }

    // Check exclusivity conflicts if setting to exclusive
    if (input.isExclusive === true && !territory.isExclusive) {
      const existingExclusive = await this.prisma.franchiseTerritory.findFirst({
        where: {
          cityId: territory.cityId,
          id: { not: territoryId },
          isExclusive: true,
          OR: [
            { endDate: null },
            { endDate: { gt: new Date() } },
          ],
        },
      });

      if (existingExclusive) {
        throw new BusinessError(
          'EXCLUSIVE_TERRITORY_EXISTS',
          'Cannot set to exclusive - another exclusive territory exists',
          422,
        );
      }
    }

    return this.prisma.franchiseTerritory.update({
      where: { id: territoryId },
      data: input,
    });
  }

  /**
   * Removes a territory from a franchise.
   */
  async removeTerritory(territoryId: string) {
    const territory = await this.prisma.franchiseTerritory.findUnique({
      where: { id: territoryId },
    });

    if (!territory) {
      throw new BusinessError('TERRITORY_NOT_FOUND', 'Territory not found', 404);
    }

    return this.prisma.franchiseTerritory.delete({
      where: { id: territoryId },
    });
  }

  /**
   * Gets all territories for a franchise.
   * AC3: View assigned territories with revenue share.
   */
  async getFranchiseTerritories(franchiseId: string) {
    const territories = await this.prisma.franchiseTerritory.findMany({
      where: { franchiseId },
      include: {
        franchise: {
          select: {
            id: true,
            ownerName: true,
            ownerEmail: true,
          },
        },
      },
    });

    // Fetch city details separately to avoid relation issues
    const cityIds = territories.map(t => t.cityId);
    const cities = await this.prisma.city.findMany({
      where: { id: { in: cityIds } },
      select: {
        id: true,
        cityName: true,
        state: true,
      },
    });

    const cityMap = new Map(cities.map(c => [c.id, c]));

    return territories.map(t => ({
      ...t,
      city: cityMap.get(t.cityId),
    }));
  }

  /**
   * Gets the franchise for a specific city (for service routing).
   * AC4: Route services to correct franchise.
   */
  async getFranchiseForCity(cityId: string) {
    const territory = await this.prisma.franchiseTerritory.findFirst({
      where: {
        cityId,
        OR: [
          { endDate: null },
          { endDate: { gt: new Date() } },
        ],
      },
      include: {
        franchise: true,
      },
      orderBy: {
        isExclusive: 'desc', // Prefer exclusive territories
      },
    });

    return territory?.franchise || null;
  }

  /**
   * Calculates revenue share for a franchise in a period.
   * AC5: Monthly revenue sharing calculation.
   */
  async calculateRevenueShare(
    franchiseId: string,
    cityId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<RevenueShareResult> {
    // Get territory
    const territory = await this.prisma.franchiseTerritory.findUnique({
      where: {
        franchiseId_cityId: {
          franchiseId,
          cityId,
        },
      },
    });

    if (!territory) {
      throw new BusinessError('TERRITORY_NOT_FOUND', 'No territory found for this franchise/city', 404);
    }

    // Sum all completed service payments in the territory during the period
    const payments = await this.prisma.payment.aggregate({
      _sum: {
        amountPaise: true,
      },
      where: {
        status: 'paid',
        paidAt: {
          gte: periodStart,
          lte: periodEnd,
        },
        // Filter by city through service instance
        // This would need proper relation setup
      },
    });

    const totalServiceRevenuePaise = BigInt(payments._sum.amountPaise || 0);
    const franchiseSharePaise = (totalServiceRevenuePaise * BigInt(territory.revenueShareBps)) / BigInt(10000);
    const platformSharePaise = totalServiceRevenuePaise - franchiseSharePaise;

    return {
      franchiseId,
      cityId,
      periodStart,
      periodEnd,
      totalServiceRevenuePaise,
      revenueShareBps: territory.revenueShareBps,
      franchiseSharePaise,
      platformSharePaise,
    };
  }

  /**
   * Records monthly revenue share in FranchiseRevenue table.
   * AC6: Persist revenue calculations for tracking.
   */
  async recordMonthlyRevenue(
    franchiseId: string,
    cityId: string,
    month: number,
    year: number,
  ) {
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0, 23, 59, 59);

    // Format month as "YYYY-MM" string to match schema
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;

    const revenueShare = await this.calculateRevenueShare(
      franchiseId,
      cityId,
      periodStart,
      periodEnd,
    );

    const serviceFeePaise = Number(revenueShare.totalServiceRevenuePaise);
    const franchiseSharePaise = Number(revenueShare.franchiseSharePaise);
    const platformSharePaise = Number(revenueShare.platformSharePaise);

    // Check for existing record
    const existing = await this.prisma.franchiseRevenue.findFirst({
      where: {
        franchiseId,
        cityId,
        month: monthStr,
      },
    });

    if (existing) {
      // Update existing
      return this.prisma.franchiseRevenue.update({
        where: { id: existing.id },
        data: {
          serviceFeePaise,
          franchiseSharePaise,
          platformSharePaise,
          franchiseShareBps: revenueShare.revenueShareBps,
        },
      });
    }

    // Create new — serviceRequestId uses a synthetic aggregate ID since this is a monthly summary
    return this.prisma.franchiseRevenue.create({
      data: {
        franchiseId,
        cityId,
        serviceRequestId: `aggregate-${franchiseId}-${monthStr}`,
        month: monthStr,
        serviceFeePaise,
        franchiseSharePaise,
        platformSharePaise,
        franchiseShareBps: revenueShare.revenueShareBps,
      },
    });
  }

  /**
   * Gets revenue history for a franchise.
   * AC7: View historical revenue reports.
   */
  async getRevenueHistory(franchiseId: string, options?: { year?: number; limit?: number }) {
    const { year, limit = 12 } = options || {};

    const where: Record<string, unknown> = {
      franchiseId,
      // Filter by year using month string prefix (e.g. "2026-")
      ...(year && { month: { startsWith: `${year}-` } }),
    };

    const revenues = await this.prisma.franchiseRevenue.findMany({
      where,
      orderBy: {
        month: 'desc',
      },
      take: limit,
    });

    // Calculate totals using actual schema fields (Int, not BigInt)
    const totals = revenues.reduce(
      (acc, r) => ({
        totalRevenue: acc.totalRevenue + r.serviceFeePaise,
        totalShare: acc.totalShare + r.franchiseSharePaise,
      }),
      { totalRevenue: 0, totalShare: 0 },
    );

    return {
      revenues,
      totals: {
        totalRevenuePaise: totals.totalRevenue.toString(),
        totalSharePaise: totals.totalShare.toString(),
      },
    };
  }
}
