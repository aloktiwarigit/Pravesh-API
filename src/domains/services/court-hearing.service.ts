// Story 13-9: Court Hearing Date Tracking Service
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export class CourtHearingService {
  constructor(
    private prisma: PrismaClient,
    private boss: any // PgBoss instance - namespace import cannot be used as type
  ) {}

  async addHearing(params: {
    serviceRequestId: string;
    caseNumber: string;
    hearingDate: Date;
    courtName: string;
    courtAddress?: string;
    hearingType: string;
    notes?: string;
    createdByUserId: string;
    cityId: string;
  }) {
    const hearing = await this.prisma.courtHearing.create({
      data: {
        id: crypto.randomUUID(),
        serviceRequestId: params.serviceRequestId,
        caseNumber: params.caseNumber,
        hearingDate: params.hearingDate,
        courtName: params.courtName,
        courtAddress: params.courtAddress || null,
        hearingType: params.hearingType,
        notes: params.notes || null,
        createdByUserId: params.createdByUserId,
        cityId: params.cityId,
      },
    });

    // Resolve customer phone from the linked service request
    const serviceRequest = await this.prisma.serviceRequest.findFirst({
      where: { serviceInstanceId: params.serviceRequestId },
      select: { customerPhone: true },
    });
    const recipientPhone: string | undefined = serviceRequest?.customerPhone ?? undefined;

    // Schedule 7-day reminder
    const sevenDaysBefore = new Date(params.hearingDate);
    sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7);
    if (sevenDaysBefore > new Date()) {
      await this.boss.send(
        'notification.send',
        {
          type: 'court_hearing_reminder_7day',
          hearingId: hearing.id,
          phone: recipientPhone,
          hearingDate: params.hearingDate.toISOString(),
          courtName: params.courtName,
        },
        { startAfter: sevenDaysBefore }
      );
    }

    // Schedule 1-day reminder
    const oneDayBefore = new Date(params.hearingDate);
    oneDayBefore.setDate(oneDayBefore.getDate() - 1);
    if (oneDayBefore > new Date()) {
      await this.boss.send(
        'notification.send',
        {
          type: 'court_hearing_reminder_1day',
          hearingId: hearing.id,
          phone: recipientPhone,
          hearingDate: params.hearingDate.toISOString(),
          courtName: params.courtName,
        },
        { startAfter: oneDayBefore }
      );
    }

    return hearing;
  }

  async getHearingsForService(serviceRequestId: string) {
    return this.prisma.courtHearing.findMany({
      where: { serviceRequestId },
      orderBy: { hearingDate: 'asc' },
    });
  }

  async getUpcomingHearings(cityId: string) {
    return this.prisma.courtHearing.findMany({
      where: {
        cityId,
        status: 'scheduled',
        hearingDate: { gte: new Date() },
      },
      orderBy: { hearingDate: 'asc' },
    });
  }

  async generateCalendarEvent(hearingId: string): Promise<string> {
    const hearing = await this.prisma.courtHearing.findUniqueOrThrow({
      where: { id: hearingId },
    });

    // Generate ICS format for calendar integration
    const dtStart = hearing.hearingDate
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('.000Z', 'Z');
    const dtEnd = new Date(
      hearing.hearingDate.getTime() + 60 * 60 * 1000
    )
      .toISOString()
      .replace(/[-:]/g, '')
      .replace('.000Z', 'Z');

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//PropertyLegalAgent//CourtHearing//EN',
      'BEGIN:VEVENT',
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:Court Hearing - ${hearing.caseNumber}`,
      `LOCATION:${hearing.courtName}${hearing.courtAddress ? ', ' + hearing.courtAddress : ''}`,
      `DESCRIPTION:Hearing Type: ${hearing.hearingType}. Case: ${hearing.caseNumber}`,
      `UID:${hearing.id}@propertyagent.in`,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n');

    return ics;
  }
}
