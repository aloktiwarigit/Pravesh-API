// Story 13-7: POA Document Upload & Validity Verification Service
import { PrismaClient } from '@prisma/client';
export class PoaVerificationService {
  constructor(
    private prisma: PrismaClient,
    private boss: any // PgBoss instance - namespace import cannot be used as type
  ) {}

  async uploadNotarizedPoa(params: {
    poaDocumentId: string;
    notarizedPoaUrl: string;
    customerId: string;
  }) {
    await this.prisma.poaDocument.update({
      where: { id: params.poaDocumentId },
      data: {
        notarizedPoaUrl: params.notarizedPoaUrl,
        verificationStatus: 'pending',
        status: 'uploaded',
      },
    });

    // Create Ops verification task
    await this.boss.send('notification.send', {
      type: 'poa_verification_required',
      poaDocumentId: params.poaDocumentId,
      customerId: params.customerId,
    });
  }

  async verifyPoa(params: {
    poaDocumentId: string;
    opsUserId: string;
    approved: boolean;
    verificationChecks: {
      embassySeal: boolean;
      notarizationDateValid: boolean;
      attorneyDetailsMatch: boolean;
      scopeAdequate: boolean;
      validityConfirmed: boolean;
    };
    notes?: string;
    rejectionReason?: string;
  }) {
    const poa = await this.prisma.poaDocument.update({
      where: { id: params.poaDocumentId },
      data: {
        verificationStatus: params.approved ? 'approved' : 'rejected',
        verifiedByUserId: params.opsUserId,
        verifiedAt: params.approved ? new Date() : null,
        status: params.approved ? 'verified' : 'rejected',
        verificationNotes: params.notes || null,
        rejectionReason: params.rejectionReason || null,
        embassySeal: params.verificationChecks.embassySeal,
        notarizationDateValid:
          params.verificationChecks.notarizationDateValid,
        attorneyDetailsMatch:
          params.verificationChecks.attorneyDetailsMatch,
        scopeAdequate: params.verificationChecks.scopeAdequate,
        validityConfirmed: params.verificationChecks.validityConfirmed,
      },
    });

    if (params.approved) {
      // TODO: serviceRequest model not in schema — POA attorney info stored on PoaDocument itself
      // The service instance linked via serviceRequestId can look up the verified POA

      // Schedule expiry reminder (30 days before)
      const reminderDate = new Date(poa.validityEndDate);
      reminderDate.setDate(reminderDate.getDate() - 30);

      await this.boss.send(
        'notification.send',
        {
          type: 'poa_expiry_warning',
          poaDocumentId: poa.id,
          customerId: poa.customerId,
          expiryDate: poa.validityEndDate.toISOString(),
        },
        { startAfter: reminderDate }
      );

      // Notify customer of approval
      await this.boss.send('notification.send', {
        type: 'poa_approved',
        customerId: poa.customerId,
        poaDocumentId: poa.id,
      });
    } else {
      // Notify customer of rejection with reason
      await this.boss.send('notification.send', {
        type: 'poa_rejected',
        customerId: poa.customerId,
        poaDocumentId: poa.id,
        reason: params.rejectionReason,
      });
    }

    return poa;
  }

  async checkPoaExpiry() {
    // Called by scheduled job daily
    const expiredPoas = await this.prisma.poaDocument.findMany({
      where: {
        status: 'verified',
        validityEndDate: { lte: new Date() },
      },
    });

    for (const poa of expiredPoas) {
      await this.prisma.poaDocument.update({
        where: { id: poa.id },
        data: { status: 'expired' },
      });

      // TODO: serviceRequest model not in schema — POA expiry flagged on PoaDocument status

      await this.boss.send('notification.send', {
        type: 'poa_expired',
        customerId: poa.customerId,
        poaDocumentId: poa.id,
      });
    }
  }

  async getPendingVerifications() {
    return this.prisma.poaDocument.findMany({
      where: { verificationStatus: 'pending' },
      orderBy: { createdAt: 'asc' },
    });
  }
}
