/**
 * Story 7-8: Notification Metrics & Monitoring Service
 * Dashboard metrics, failure rate tracking, SLA breach detection
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../shared/utils/logger';

interface ChannelMetrics {
  channel: string;
  totalSent: number;
  delivered: number;
  failed: number;
  read: number;
  skipped: number;
  deliveryRate: number;
  failureRate: number;
}

interface FailureGroup {
  reason: string;
  count: number;
}

interface DashboardMetrics {
  period: string;
  totalSent: number;
  channels: ChannelMetrics[];
  failureReasons: FailureGroup[];
  slaBreaches: { push: number; whatsapp: number };
}

export class NotificationMetricsService {
  constructor(private readonly prisma: PrismaClient) {}

  async getDashboardMetrics(hoursBack: number = 24): Promise<DashboardMetrics> {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    // Total sent by channel
    const channelStats = await this.prisma.notificationLog.groupBy({
      by: ['channel', 'status'],
      where: { createdAt: { gte: since } },
      _count: true,
    });

    // Build channel metrics
    const channelMap = new Map<string, ChannelMetrics>();
    for (const stat of channelStats) {
      const ch = stat.channel;
      if (!channelMap.has(ch)) {
        channelMap.set(ch, {
          channel: ch,
          totalSent: 0, delivered: 0, failed: 0, read: 0, skipped: 0,
          deliveryRate: 0, failureRate: 0,
        });
      }
      const m = channelMap.get(ch)!;
      const count = stat._count;
      switch (stat.status) {
        case 'sent': m.totalSent += count; break;
        case 'delivered': m.delivered += count; m.totalSent += count; break;
        case 'failed': m.failed += count; m.totalSent += count; break;
        case 'read': m.read += count; m.delivered += count; m.totalSent += count; break;
        case 'skipped': m.skipped += count; break;
      }
    }

    for (const m of channelMap.values()) {
      m.deliveryRate = m.totalSent > 0 ? ((m.delivered + m.read) / m.totalSent) * 100 : 0;
      m.failureRate = m.totalSent > 0 ? (m.failed / m.totalSent) * 100 : 0;
    }

    // Failure reasons
    const failureReasons = await this.prisma.notificationLog.groupBy({
      by: ['failureReason'],
      where: {
        createdAt: { gte: since },
        status: 'failed',
        failureReason: { not: null },
      },
      _count: true,
      orderBy: { _count: { failureReason: 'desc' } },
      take: 20,
    });

    // SLA breaches via raw query
    let pushBreachCount = 0;
    let whatsappBreachCount = 0;

    try {
      const pushBreaches = await this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM notification_log
        WHERE channel = 'push'
          AND status IN ('sent', 'delivered', 'read')
          AND created_at >= ${since}
          AND sent_at IS NOT NULL
          AND EXTRACT(EPOCH FROM (sent_at - created_at)) > 5
      `;
      pushBreachCount = Number(pushBreaches[0]?.count ?? 0);

      const whatsappBreaches = await this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count FROM notification_log
        WHERE channel = 'whatsapp'
          AND status IN ('sent', 'delivered', 'read')
          AND created_at >= ${since}
          AND sent_at IS NOT NULL
          AND EXTRACT(EPOCH FROM (sent_at - created_at)) > 30
      `;
      whatsappBreachCount = Number(whatsappBreaches[0]?.count ?? 0);
    } catch (e) {
      logger.warn({ error: e }, 'SLA breach query failed - possibly no data');
    }

    const totalSent = Array.from(channelMap.values()).reduce((sum, m) => sum + m.totalSent, 0);

    return {
      period: `${hoursBack}h`,
      totalSent,
      channels: Array.from(channelMap.values()),
      failureReasons: failureReasons.map((r) => ({
        reason: r.failureReason ?? 'Unknown',
        count: r._count,
      })),
      slaBreaches: {
        push: pushBreachCount,
        whatsapp: whatsappBreachCount,
      },
    };
  }

  async getFailureRateForWindow(channel: string, windowMinutes: number = 15): Promise<number> {
    const since = new Date(Date.now() - windowMinutes * 60 * 1000);

    const [total, failed] = await Promise.all([
      this.prisma.notificationLog.count({
        where: { channel: channel as any, createdAt: { gte: since } },
      }),
      this.prisma.notificationLog.count({
        where: { channel: channel as any, status: 'failed', createdAt: { gte: since } },
      }),
    ]);

    return total > 0 ? (failed / total) * 100 : 0;
  }

  async getRecentFailedNotifications(page: number = 1, limit: number = 50) {
    const [notifications, total] = await Promise.all([
      this.prisma.failedNotification.findMany({
        where: { resolvedAt: null },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.failedNotification.count({ where: { resolvedAt: null } }),
    ]);

    return { notifications, total };
  }

  async retryFailedNotification(failedNotificationId: string) {
    const failed = await this.prisma.failedNotification.findUnique({
      where: { id: failedNotificationId },
    });

    if (!failed) {
      throw new Error('Failed notification not found');
    }

    const { getBossInstance } = await import('./notification-queue.service');
    const boss = getBossInstance();

    await boss.send('notification.send', {
      userId: failed.userId,
      templateCode: failed.templateCode,
      channel: failed.channel,
      contextData: failed.contextData as Record<string, string>,
      priority: 'high',
    });

    await this.prisma.failedNotification.update({
      where: { id: failedNotificationId },
      data: { resolvedAt: new Date(), resolvedBy: 'manual_retry' },
    });

    return { retried: true };
  }

  // Story 7-11: Dedup metrics
  async getDedupMetrics(hoursBack: number = 24) {
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);

    const duplicatesPrevented = await this.prisma.notificationLog.count({
      where: {
        status: 'skipped',
        failureReason: 'Duplicate skipped',
        createdAt: { gte: since },
      },
    });

    return {
      totalPrevented: duplicatesPrevented,
      period: `${hoursBack}h`,
    };
  }
}
