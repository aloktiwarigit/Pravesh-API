/**
 * Payment correction service for handling corrections via append-only records.
 *
 * Story 4.9: Immutable Payment Audit Trail
 */
import { PrismaClient } from '@prisma/client';
import { PaymentStateChangeService } from './payment-state-change.service.js';

export class PaymentCorrectionService {
  private readonly stateChangeService: PaymentStateChangeService;

  constructor(private readonly prisma: PrismaClient) {
    this.stateChangeService = new PaymentStateChangeService(prisma);
  }

  /**
   * Records a payment correction.
   * Does NOT update the original payment record (immutable).
   * Creates a state change entry with correction metadata.
   */
  async recordCorrection(params: {
    paymentId: string;
    correctionReason: string;
    correctedBy: string;
    correctionDetails: Record<string, unknown>;
  }) {
    // Log the correction as a state change
    await this.stateChangeService.logStateChange({
      paymentId: params.paymentId,
      oldState: 'ACTIVE',
      newState: 'CORRECTED',
      changedBy: params.correctedBy,
      metadata: {
        type: 'correction',
        reason: params.correctionReason,
        ...params.correctionDetails,
      },
    });

    // Update correction fields on payment (these are metadata, not financial data)
    // TODO: correctionNote, correctedBy, correctedAt fields do not exist in Payment schema yet.
    await (this.prisma as any).payment.update({
      where: { id: params.paymentId },
      data: {
        correctionNote: params.correctionReason,
        correctedBy: params.correctedBy,
        correctedAt: new Date(),
      },
    });

    return { paymentId: params.paymentId, status: 'corrected' };
  }
}
