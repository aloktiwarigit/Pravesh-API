import { CommissionService } from '../../../domains/dealers/commissions.service';
import { BadgeService } from '../../../domains/dealers/badges.service';

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

    console.log(`[CommissionCalculate] Processing service request ${serviceRequestId}`);

    try {
      // Calculate commission for the service request
      await commissionService.calculateCommission(serviceRequestId);

      // Auto-approve if service is completed
      await commissionService.approveCommissionsForService(serviceRequestId);

      // Evaluate badges if dealerId is available
      if (dealerId) {
        const newBadges = await badgeService.evaluateAndAwardBadges(dealerId);
        if (newBadges.length > 0) {
          console.log(
            `[CommissionCalculate] Awarded ${newBadges.length} badges to dealer ${dealerId}: ${newBadges.join(', ')}`,
          );
        }
      }

      console.log(`[CommissionCalculate] Done for service request ${serviceRequestId}`);
    } catch (error) {
      console.error(`[CommissionCalculate] Error for ${serviceRequestId}:`, error);
      throw error;
    }
  };
}

export const COMMISSION_CALCULATE_QUEUE = 'dealer-commission-calculate';
