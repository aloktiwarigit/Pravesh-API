import { PrismaClient } from '@prisma/client';
import { BusinessError } from '../../shared/errors/business-error';
import * as ErrorCodes from '../../shared/errors/error-codes';
import { getMonthRange, getCurrentMonth } from '../../shared/utils/date';

/**
 * Stories 14-9, 14-10a, 14-10b, 14-10c, 14-11: Analytics Service
 *
 * Provides city-level and cross-city analytics, KPI dashboards,
 * city comparison, trend visualization, and market intelligence.
 */
export class AnalyticsService {
  constructor(private prisma: PrismaClient) {}

  // ============================================================
  // STORY 14-9: City-Level Analytics Dashboard
  // ============================================================

  /**
   * Get city-level KPIs for Franchise Owner dashboard
   */
  async getCityKpis(cityId: string, dateRange?: { start: string; end: string }) {
    const start = dateRange?.start ? new Date(dateRange.start) : getMonthRange(getCurrentMonth()).start;
    const end = dateRange?.end ? new Date(dateRange.end) : new Date();

    // Agent count
    const agentCount = await this.prisma.agent.count({
      where: { cityId, isActive: true },
    });

    // Dealer count
    const dealerCount = await this.prisma.dealer.count({
      where: { cityId, dealerStatus: 'ACTIVE' },
    });

    // Revenue for period
    const revenueData = await this.prisma.franchiseRevenue.aggregate({
      where: {
        cityId,
        createdAt: { gte: start, lte: end },
      },
      _sum: { serviceFeePaise: true, franchiseSharePaise: true },
      _count: true,
    });

    return {
      cityId,
      period: { start: start.toISOString(), end: end.toISOString() },
      totalServices: revenueData._count,
      revenuePaise: revenueData._sum.serviceFeePaise || 0,
      franchiseSharePaise: revenueData._sum.franchiseSharePaise || 0,
      agentCount,
      dealerCount,
    };
  }

  /**
   * Get agent leaderboard for a city
   */
  async getAgentLeaderboard(cityId: string, limit: number = 10) {
    const agents = await this.prisma.agent.findMany({
      where: { cityId, isActive: true },
      orderBy: { name: 'asc' },
      take: limit,
    });

    // In a full implementation, this would join with service_requests/tasks
    // to get completion counts and ratings. Simplified here.
    return agents.map((agent) => ({
      agentId: agent.id,
      name: agent.name,
      expertiseTags: agent.expertiseTags,
      isActive: agent.isActive,
    }));
  }

  /**
   * Get dealer leaderboard for a city
   */
  async getDealerLeaderboard(cityId: string, limit: number = 10) {
    const dealers = await this.prisma.dealer.findMany({
      where: { cityId, dealerStatus: 'ACTIVE' },
      orderBy: { currentTier: 'asc' },
      take: limit,
    });

    return dealers.map((dealer) => ({
      dealerId: dealer.id,
      businessName: dealer.businessName,
      tier: dealer.currentTier,
      dealerStatus: dealer.dealerStatus,
    }));
  }

  // ============================================================
  // STORY 14-10a: Cross-City KPI Overview Dashboard
  // ============================================================

  /**
   * Get platform-wide aggregated KPIs (Super Admin)
   */
  async getPlatformKpis() {
    const totalCities = await this.prisma.city.count({ where: { activeStatus: true } });
    const totalAgents = await this.prisma.agent.count({ where: { isActive: true } });
    const totalDealers = await this.prisma.dealer.count({ where: { dealerStatus: 'ACTIVE' } });

    const currentMonth = getCurrentMonth();
    const revenueData = await this.prisma.franchiseRevenue.aggregate({
      where: { month: currentMonth },
      _sum: { serviceFeePaise: true },
      _count: true,
    });

    const allTimeRevenue = await this.prisma.franchiseRevenue.aggregate({
      _sum: { serviceFeePaise: true },
      _count: true,
    });

    return {
      totalCities,
      totalAgents,
      totalDealers,
      currentMonth: {
        month: currentMonth,
        serviceCount: revenueData._count,
        revenuePaise: revenueData._sum.serviceFeePaise || 0,
      },
      allTime: {
        serviceCount: allTimeRevenue._count,
        revenuePaise: allTimeRevenue._sum.serviceFeePaise || 0,
      },
    };
  }

  /**
   * Get city comparison table (Super Admin)
   */
  async getCityComparisonTable() {
    const currentMonth = getCurrentMonth();

    // Batch queries: fetch all data in 3 queries instead of 3*N (N+1 fix)
    const [cities, revenueByCity, agentCounts, dealerCounts] = await Promise.all([
      this.prisma.city.findMany({
        where: { activeStatus: true },
        orderBy: { cityName: 'asc' },
      }),
      this.prisma.franchiseRevenue.groupBy({
        by: ['cityId'],
        where: { month: currentMonth },
        _sum: { serviceFeePaise: true },
        _count: true,
      }),
      this.prisma.agent.groupBy({
        by: ['cityId'],
        where: { isActive: true },
        _count: true,
      }),
      this.prisma.dealer.groupBy({
        by: ['cityId'],
        where: { dealerStatus: 'ACTIVE' },
        _count: true,
      }),
    ]);

    // Index batch results by cityId for O(1) lookup
    const revenueMap = new Map(revenueByCity.map((r) => [r.cityId, r]));
    const agentMap = new Map(agentCounts.map((a) => [a.cityId, a._count]));
    const dealerMap = new Map(dealerCounts.map((d) => [d.cityId, d._count]));

    return cities.map((city) => {
      const revenue = revenueMap.get(city.id);
      return {
        cityId: city.id,
        cityName: city.cityName,
        state: city.state,
        servicesThisMonth: revenue?._count || 0,
        revenueThisMonthPaise: revenue?._sum.serviceFeePaise || 0,
        agentCount: agentMap.get(city.id) || 0,
        dealerCount: dealerMap.get(city.id) || 0,
      };
    });
  }

  // ============================================================
  // STORY 14-10b: City Comparison & Benchmarking
  // ============================================================

  /**
   * Compare two cities side-by-side
   */
  async compareCities(cityIdA: string, cityIdB: string) {
    const [cityA, cityB] = await Promise.all([
      this.getCityKpis(cityIdA),
      this.getCityKpis(cityIdB),
    ]);

    const [cityAInfo, cityBInfo] = await Promise.all([
      this.prisma.city.findUnique({ where: { id: cityIdA }, select: { cityName: true, state: true } }),
      this.prisma.city.findUnique({ where: { id: cityIdB }, select: { cityName: true, state: true } }),
    ]);

    return {
      cityA: { ...cityAInfo, ...cityA },
      cityB: { ...cityBInfo, ...cityB },
      comparison: {
        revenueVariancePercent: cityA.revenuePaise > 0
          ? Math.round(((Number(cityB.revenuePaise) - Number(cityA.revenuePaise)) / Number(cityA.revenuePaise)) * 100)
          : null,
        serviceCountVariance: cityB.totalServices - cityA.totalServices,
        agentCountVariance: cityB.agentCount - cityA.agentCount,
        dealerCountVariance: cityB.dealerCount - cityA.dealerCount,
      },
    };
  }

  // ============================================================
  // STORY 14-10c: Geographic Heatmap & Trend Visualization
  // ============================================================

  /**
   * Get geographic data for heatmap visualization
   */
  async getGeographicHeatmapData() {
    const currentMonth = getCurrentMonth();

    // Batch queries: fetch all data in 2 queries instead of 1+N (N+1 fix)
    const [cities, revenueByCity] = await Promise.all([
      this.prisma.city.findMany({
        where: { activeStatus: true },
      }),
      this.prisma.franchiseRevenue.groupBy({
        by: ['cityId'],
        where: { month: currentMonth },
        _sum: { serviceFeePaise: true },
        _count: true,
      }),
    ]);

    // Index batch results by cityId for O(1) lookup
    const revenueMap = new Map(revenueByCity.map((r) => [r.cityId, r]));

    return cities.map((city) => {
      const config = city.configData as any;
      const monthData = revenueMap.get(city.id);

      // Extract GPS coordinates from office addresses
      let lat: number | null = null;
      let lng: number | null = null;
      if (config?.officeAddresses) {
        const firstOffice = Object.values(config.officeAddresses)[0] as any;
        if (firstOffice) {
          lat = firstOffice.gpsLat || null;
          lng = firstOffice.gpsLng || null;
        }
      }

      return {
        cityId: city.id,
        cityName: city.cityName,
        state: city.state,
        lat,
        lng,
        serviceVolume: monthData?._count || 0,
        revenuePaise: monthData?._sum.serviceFeePaise || 0,
      };
    });
  }

  /**
   * Get platform-wide trend data
   */
  async getTrendData(months: number = 12) {
    const trends = await this.prisma.franchiseRevenue.groupBy({
      by: ['month'],
      _sum: { serviceFeePaise: true },
      _count: true,
      orderBy: { month: 'desc' },
      take: months,
    });

    return trends.map((t) => ({
      month: t.month,
      serviceCount: t._count,
      revenuePaise: t._sum.serviceFeePaise || 0,
    }));
  }

  // ============================================================
  // STORY 14-11: Property Market Intelligence Reports
  // ============================================================

  /**
   * Generate market intelligence report for a city
   * Requires minimum 50 transactions
   */
  async generateMarketIntelligenceReport(cityId: string) {
    const totalTransactions = await this.prisma.franchiseRevenue.count({
      where: { cityId },
    });

    if (totalTransactions < 50) {
      throw new BusinessError(
        ErrorCodes.BUSINESS_INSUFFICIENT_TRANSACTIONS,
        `Minimum 50 transactions required. Current: ${totalTransactions}`,
        422,
        { currentCount: totalTransactions, requiredCount: 50 }
      );
    }

    // Aggregate data
    const revenueStats = await this.prisma.franchiseRevenue.aggregate({
      where: { cityId },
      _avg: { serviceFeePaise: true },
      _sum: { serviceFeePaise: true },
      _count: true,
      _min: { serviceFeePaise: true },
      _max: { serviceFeePaise: true },
    });

    // Monthly trends
    const monthlyTrends = await this.prisma.franchiseRevenue.groupBy({
      by: ['month'],
      where: { cityId },
      _sum: { serviceFeePaise: true },
      _count: true,
      orderBy: { month: 'desc' },
      take: 12,
    });

    // Platform averages for benchmarking
    const platformAvg = await this.prisma.franchiseRevenue.aggregate({
      _avg: { serviceFeePaise: true },
    });

    const cityInfo = await this.prisma.city.findUnique({
      where: { id: cityId },
      select: { cityName: true, state: true },
    });

    return {
      cityId,
      cityName: cityInfo?.cityName,
      state: cityInfo?.state,
      generatedAt: new Date().toISOString(),
      totalTransactions,
      averageFee: {
        cityAvgPaise: Math.round(revenueStats._avg.serviceFeePaise || 0),
        platformAvgPaise: Math.round(platformAvg._avg.serviceFeePaise || 0),
      },
      revenueRange: {
        minPaise: revenueStats._min.serviceFeePaise || 0,
        maxPaise: revenueStats._max.serviceFeePaise || 0,
      },
      totalRevenuePaise: revenueStats._sum.serviceFeePaise || 0,
      monthlyTrends: monthlyTrends.map((t) => ({
        month: t.month,
        serviceCount: t._count,
        revenuePaise: t._sum.serviceFeePaise || 0,
      })),
    };
  }
}
