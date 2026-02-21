import { CommissionService } from '../../../domains/dealers/commissions.service';
import { BadgeService } from '../../../domains/dealers/badges.service';
import { logger } from '../../utils/logger';

/**
 * Story 9.7: Commission Calculation Job
 * Triggered when a service request is completed.
 * Calculates commission and evaluates badge conditions.
 */
export function createCommissionCalculateHandler(
  commissionService: CommissionService,
  badgeService: BadgeService,
) {
  return async (job: { data: { serviceRequestId: string; dealerId?: string } }) => {
    const { serviceRequestId, dealerId } = job.data;

    logger.info({ serviceRequestId }, '[CommissionCalculate] Processing service request');

    try {
      // Calculate commission for the service request
      await commissionService.calculateCommission(serviceRequestId);

      // Auto-approve if service is completed
      await commissionService.approveCommissionsForService(serviceRequestId);

      // Evaluate badges if dealerId is available
      if (dealerId) {
        const newBadges = await badgeService.evaluateAndAwardBadges(dealerId);
        if (newBadges.length > 0) {
          logger.info(
            { dealerId, badgesCount: newBadges.length, badges: newBadges },
            '[CommissionCalculate] Awarded badges to dealer'
          );
        }
      }

      logger.info({ serviceRequestId }, '[CommissionCalculate] Done for service request');
    } catch (error) {
      logger.error({ serviceRequestId, error }, '[CommissionCalculate] Error');
      throw error;
    }
  };
}

export const COMMISSION_CALCULATE_QUEUE = 'dealer-commission-calculate';
