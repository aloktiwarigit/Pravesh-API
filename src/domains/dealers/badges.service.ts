/**
 * Epic 9 Story 9.11: Gamification Badges Service
 * Evaluates and awards badges based on dealer milestones.
 * Badge awards are idempotent — @@unique([dealerId, badgeType]) prevents duplicates.
 */

import { PrismaClient, BadgeType, DealerTier } from '@prisma/client';
import { BADGE_DEFINITIONS } from './badge-definitions';

export class BadgeService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Evaluate all badge conditions and award any newly earned badges.
   * Returns array of newly awarded badge types.
   */
  async evaluateAndAwardBadges(dealerId: string): Promise<BadgeType[]> {
    const newBadges: BadgeType[] = [];
    const existingBadges = await this.prisma.dealerBadge.findMany({
      where: { dealerId },
      select: { badgeType: true },
    });
    const earned = new Set(existingBadges.map((b) => b.badgeType));

    // Count confirmed referrals
    const referralCount = await this.prisma.dealerReferral.count({
      where: { dealerId, attributionStatus: 'CONFIRMED' },
    });

    // Get dealer info
    const dealer = await this.prisma.dealer.findUnique({
      where: { id: dealerId },
      select: { currentTier: true },
    });

    // Check payout history
    const payoutCount = await this.prisma.dealerPayout.count({
      where: { dealerId, status: 'COMPLETED' },
    });

    // Evaluate each badge
    const checks: [BadgeType, boolean][] = [
      [BadgeType.FIRST_REFERRAL, referralCount >= 1],
      [BadgeType.FIVE_REFERRALS, referralCount >= 5],
      [BadgeType.HUNDRED_REFERRALS_LIFETIME, referralCount >= 100],
      [BadgeType.FIRST_PAYOUT, payoutCount >= 1],
      [
        BadgeType.SILVER_TIER,
        dealer?.currentTier === DealerTier.SILVER || dealer?.currentTier === DealerTier.GOLD,
      ],
      [BadgeType.GOLD_TIER, dealer?.currentTier === DealerTier.GOLD],
    ];

    for (const [badgeType, condition] of checks) {
      if (condition && !earned.has(badgeType)) {
        try {
          await this.prisma.dealerBadge.create({
            data: { dealerId, badgeType },
          });
          newBadges.push(badgeType);
        } catch {
          // @@unique constraint prevents duplicates — safe to ignore
        }
      }
    }

    return newBadges;
  }

  /**
   * Check and award TOP_10_LEADERBOARD badge.
   * Called after leaderboard snapshot job.
   */
  async evaluateLeaderboardBadge(dealerId: string, rank: number): Promise<boolean> {
    if (rank > 10) return false;

    const existing = await this.prisma.dealerBadge.findFirst({
      where: { dealerId, badgeType: BadgeType.TOP_10_LEADERBOARD },
    });

    if (existing) return false;

    try {
      await this.prisma.dealerBadge.create({
        data: { dealerId, badgeType: BadgeType.TOP_10_LEADERBOARD },
      });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get all badges for a dealer with definitions.
   */
  async getDealerBadges(dealerId: string) {
    const badges = await this.prisma.dealerBadge.findMany({
      where: { dealerId },
      orderBy: { earnedDate: 'desc' },
    });

    return badges.map((b) => ({
      ...b,
      definition: BADGE_DEFINITIONS[b.badgeType],
    }));
  }

  /**
   * Get progress toward next badge milestone.
   * AC7: Shows "X more referrals to earn [badge]".
   */
  async getNextBadgeProgress(dealerId: string) {
    const referralCount = await this.prisma.dealerReferral.count({
      where: { dealerId, attributionStatus: 'CONFIRMED' },
    });

    const earned = await this.prisma.dealerBadge.findMany({
      where: { dealerId },
      select: { badgeType: true },
    });
    const earnedSet = new Set(earned.map((b) => b.badgeType));

    // Referral-based milestones
    const milestones: [BadgeType, number][] = [
      [BadgeType.FIRST_REFERRAL, 1],
      [BadgeType.FIVE_REFERRALS, 5],
      [BadgeType.HUNDRED_REFERRALS_LIFETIME, 100],
    ];

    for (const [badge, threshold] of milestones) {
      if (!earnedSet.has(badge)) {
        return {
          nextBadge: BADGE_DEFINITIONS[badge],
          currentProgress: referralCount,
          threshold,
          remaining: Math.max(0, threshold - referralCount),
        };
      }
    }

    return null; // All referral badges earned
  }
}
