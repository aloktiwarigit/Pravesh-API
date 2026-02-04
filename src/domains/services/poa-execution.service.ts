// Story 13-6: Embassy/Consulate POA Execution Tracking Service
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const POA_STATUSES = [
  'draft',
  'appointment_booked',
  'documents_submitted',
  'notarization_pending',
  'poa_received',
  'uploaded',
] as const;

export type PoaExecutionStatus = (typeof POA_STATUSES)[number];

export class PoaExecutionService {
  constructor(
    private prisma: PrismaClient,
    private boss: any // PgBoss instance - namespace import cannot be used as type
  ) {}

  async updateExecutionStatus(params: {
    poaDocumentId: string;
    status: string;
    notes?: string;
    embassyName?: string;
    embassyCity?: string;
    embassyCountry?: string;
    appointmentDate?: Date;
  }) {
    const step = await this.prisma.poaExecutionStep.create({
      data: {
        id: crypto.randomUUID(),
        poaDocumentId: params.poaDocumentId,
        status: params.status,
        notes: params.notes || null,
        embassyName: params.embassyName || null,
        embassyCity: params.embassyCity || null,
        embassyCountry: params.embassyCountry || null,
        appointmentDate: params.appointmentDate || null,
      },
    });

    // Update POA document status
    await this.prisma.poaDocument.update({
      where: { id: params.poaDocumentId },
      data: { status: params.status },
    });

    // Schedule appointment reminder if appointment_booked
    if (
      params.status === 'appointment_booked' &&
      params.appointmentDate
    ) {
      const reminderDate = new Date(params.appointmentDate);
      reminderDate.setDate(reminderDate.getDate() - 3);

      await this.boss.send(
        'notification.send',
        {
          type: 'embassy_appointment_reminder',
          poaDocumentId: params.poaDocumentId,
          appointmentDate: params.appointmentDate.toISOString(),
        },
        { startAfter: reminderDate }
      );
    }

    // Notify Ops when POA uploaded
    if (params.status === 'uploaded') {
      await this.boss.send('notification.send', {
        type: 'poa_uploaded_for_verification',
        poaDocumentId: params.poaDocumentId,
      });
    }

    return step;
  }

  async getExecutionTimeline(poaDocumentId: string) {
    return this.prisma.poaExecutionStep.findMany({
      where: { poaDocumentId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
