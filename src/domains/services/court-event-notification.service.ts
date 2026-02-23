// Story 13-12: Court Case Progress Notifications Service
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const MILESTONE_EVENTS = [
  'case_filed',
  'first_hearing_completed',
  'final_order_received',
];

export class CourtEventNotificationService {
  constructor(
    private prisma: PrismaClient,
    private boss: any // PgBoss instance - namespace import cannot be used as type
  ) {}

  async recordAndNotify(params: {
    serviceRequestId: string;
    caseNumber: string;
    eventType: string;
    eventDate: Date;
    description: string;
    nextAction?: string;
    isMilestone?: boolean;
    createdByUserId: string;
  }) {
    const event = await this.prisma.courtEvent.create({
      data: {
        id: crypto.randomUUID(),
        serviceRequestId: params.serviceRequestId,
        caseNumber: params.caseNumber,
        eventType: params.eventType,
        eventDate: params.eventDate,
        description: params.description,
        nextAction: params.nextAction || null,
        isMilestone:
          params.isMilestone ||
          MILESTONE_EVENTS.includes(params.eventType),
        createdByUserId: params.createdByUserId,
      },
    });

    // Build deep link for in-app navigation
    const deepLink = `propertyagent://court-timeline/${params.serviceRequestId}`;

    // Send to customer
    await this.boss.send('notification.send', {
      type: 'court_event_update',
      serviceRequestId: params.serviceRequestId,
      channel: 'whatsapp',
      data: {
        eventType: params.eventType,
        date: params.eventDate.toISOString(),
        description: params.description,
        nextAction: params.nextAction || 'Check app for details',
        deepLink,
        isMilestone: event.isMilestone,
      },
    });

    // Mark notification sent
    await this.prisma.courtEvent.update({
      where: { id: event.id },
      data: { notificationSent: true },
    });

    return event;
  }

  async sendCustomUpdate(params: {
    serviceRequestId: string;
    message: string;
    agentId: string;
  }) {
    const event = await this.prisma.courtEvent.create({
      data: {
        id: crypto.randomUUID(),
        serviceRequestId: params.serviceRequestId,
        caseNumber: '',
        eventType: 'custom',
        eventDate: new Date(),
        description: params.message,
        createdByUserId: params.agentId,
        notificationSent: true,
      },
    });

    await this.boss.send('notification.send', {
      type: 'court_custom_update',
      serviceRequestId: params.serviceRequestId,
      channel: 'whatsapp',
      data: { message: params.message },
    });

    return event;
  }

  async getEventHistory(serviceRequestId: string) {
    return this.prisma.courtEvent.findMany({
      where: { serviceRequestId },
      orderBy: { eventDate: 'desc' },
    });
  }
}
