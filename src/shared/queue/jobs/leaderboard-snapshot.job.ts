import { PrismaClient } from '@prisma/client';
import { BadgeService } from '../../../domains/dealers/badges.service';
import { logger } from '../../utils/logger';

/**
 * Story 9.10: Leaderboard Snapshot Job
 * Runs weekly on Sundays at midnight.
 * Creates a leaderboard snapshot per city and evaluates TOP_10 badges.
 *
 * NOTE: Dealer model does not have monthlyReferrals. We count DealerReferral
 * records for the current month instead.
 * DealerLeaderboardSnapshot uses compound unique: dealerId_period_snapshotDate.
 */
export function createLeaderboardSnapshotHandler(
  prisma: PrismaClient,
  badgeService: BadgeService,
) {
  return async () => {
    logger.info('[LeaderboardSnapshot] Starting weekly snapshot');

    try {
      // Get all active cities with dealers
      const cities = await prisma.dealer.findMany({
        where: { dealerStatus: 'ACTIVE' },
        select: { cityId: true },
        distinct: ['cityId'],
      });

      let totalSnapshots = 0;
      let badgesAwarded = 0;

      const snapshotPeriod = new Date().toISOString().slice(0, 7); // YYYY-MM
      const snapshotDate = new Date();
      // Calculate month boundaries for referral counting
      const monthStart = new Date(snapshotDate.getFullYear(), snapshotDate.getMonth(), 1);
      const monthEnd = new Date(snapshotDate.getFullYear(), snapshotDate.getMonth() + 1, 0, 23, 59, 59, 999);

      for (const { cityId } of cities) {
        // Get top 20 dealers by referral count this month
        const dealerReferralCounts = await prisma.dealerReferral.groupBy({
          by: ['dealerId'],
          where: {
            cityId,
            referralDate: { gte: monthStart, lte: monthEnd },
          },
          _count: { id: true },
          orderBy: { _count: { id: 'desc' } },
          take: 20,
        });

        for (let i = 0; i < dealerReferralCounts.length; i++) {
          const entry = dealerReferralCounts[i];
          const rank = i + 1;
          const referralCount = entry._count.id;

          // Get total commission for this dealer
          const commissionAgg = await prisma.dealerCommission.aggregate({
            where: { dealerId: entry.dealerId },
            _sum: { commissionAmountPaise: true },
          });

          await prisma.dealerLeaderboardSnapshot.upsert({
            where: {
              dealerId_period_snapshotDate: {
                dealerId: entry.dealerId,
                period: snapshotPeriod,
                snapshotDate,
              },
            },
            update: {
              rank,
              referralCount,
              totalCommissionPaise: commissionAgg._sum.commissionAmountPaise ?? 0n,
            },
            create: {
              dealerId: entry.dealerId,
              cityId,
              period: snapshotPeriod,
              snapshotDate,
              rank,
              referralCount,
              totalCommissionPaise: commissionAgg._sum.commissionAmountPaise ?? 0n,
            },
          });
          totalSnapshots++;

          // Evaluate TOP_10 badge
          if (rank <= 10) {
            const awarded = await badgeService.evaluateLeaderboardBadge(entry.dealerId, rank);
            if (awarded) badgesAwarded++;
          }
        }
      }

      logger.info(
        { totalSnapshots, citiesProcessed: cities.length, badgesAwarded },
        '[LeaderboardSnapshot] Completed weekly snapshot'
      );

      return { totalSnapshots, citiesProcessed: cities.length, badgesAwarded };
    } catch (error) {
      logger.error({ error }, '[LeaderboardSnapshot] Error');
      throw error;
    }
  };
}

// Cron: Sunday at midnight
export const LEADERBOARD_SNAPSHOT_SCHEDULE = '0 0 * * 0';
