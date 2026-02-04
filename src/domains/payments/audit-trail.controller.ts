/**
 * Audit trail controller for payment state change history.
 *
 * Story 4.9: Immutable Payment Audit Trail
 */
import { Request, Response } from 'express';
import { PaymentStateChangeService } from './payment-state-change.service.js';

export class AuditTrailController {
  constructor(private readonly stateChangeService: PaymentStateChangeService) {}

  getAuditTrail = async (req: Request, res: Response) => {
    const { paymentId } = req.params;

    const trail = await this.stateChangeService.getAuditTrail(paymentId);

    res.json({
      success: true,
      data: trail.map((entry: any) => ({
        id: entry.id,
        paymentId: entry.paymentId,
        oldState: entry.oldState,
        newState: entry.newState,
        changedBy: entry.changedBy,
        metadata: entry.metadata,
        createdAt: entry.createdAt.toISOString(),
      })),
    });
  };
}
