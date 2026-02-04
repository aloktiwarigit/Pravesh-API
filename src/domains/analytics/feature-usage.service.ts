import { PrismaClient } from '@prisma/client';

/**
 * Story 14-12: Feature Usage Tracking
 *
 * Tracks feature usage and user behavior. Primary storage in BigQuery
 * via Firebase Analytics native integration. PostgreSQL stores a subset
 * for quick dashboard access.
 */
export class FeatureUsageService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Track a feature usage event
   */
  async trackEvent(params: {
    eventName: string;
    userId?: string;
    userRole?: string;
    cityId?: string;
    metadata?: Record<string, any>;
  }) {
    return this.prisma.featureUsageEvent.create({
      data: {
        eventName: params.eventName,
        userId: params.userId || null,
        userRole: params.userRole || null,
        cityId: params.cityId || null,
        metadata: params.metadata as any || null,
      },
    });
  }

  /**
   * Get feature adoption metrics
   */
  async getFeatureAdoption(dateRange?: { start: string; end: string }) {
    const where: any = {};
    if (dateRange) {
      where.createdAt = {
        gte: new Date(dateRange.start),
        lte: new Date(dateRange.end),
      };
    }

    const featureCounts = await this.prisma.featureUsageEvent.groupBy({
      by: ['eventName'],
      where,
      _count: true,
      orderBy: { _count: { eventName: 'desc' } },
    });

    return featureCounts.map((f) => ({
      eventName: f.eventName,
      usageCount: f._count,
    }));
  }

  /**
   * Get feature usage by role
   */
  async getUsageByRole(eventName: string) {
    return this.prisma.featureUsageEvent.groupBy({
      by: ['userRole'],
      where: { eventName },
      _count: true,
    });
  }

  /**
   * Get feature usage by city
   */
  async getUsageByCity(eventName: string) {
    return this.prisma.featureUsageEvent.groupBy({
      by: ['cityId'],
      where: { eventName, cityId: { not: null } },
      _count: true,
    });
  }

  /**
   * Get daily active usage for a feature
   */
  async getDailyUsageTrend(eventName: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const events = await this.prisma.featureUsageEvent.findMany({
      where: {
        eventName,
        createdAt: { gte: since },
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    // Group by date
    const dailyCounts: Record<string, number> = {};
    for (const event of events) {
      const dateKey = event.createdAt.toISOString().split('T')[0];
      dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
    }

    return Object.entries(dailyCounts).map(([date, count]) => ({ date, count }));
  }
}
