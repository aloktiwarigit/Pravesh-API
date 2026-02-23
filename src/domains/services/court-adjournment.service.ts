// Story 13-10: Court Adjournment Tracking Service
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export class CourtAdjournmentService {
  constructor(
    private prisma: PrismaClient,
    private boss: any // PgBoss instance - namespace import cannot be used as type
  ) {}

  async recordAdjournment(params: {
    hearingId: string;
    newHearingDate: Date;
    adjournmentReason: string;
    notes?: string;
    agentId: string;
  }) {
    // Update existing hearing as adjourned
    const originalHearing = await this.prisma.courtHearing.update({
      where: { id: params.hearingId },
      data: {
        status: 'adjourned',
        adjournmentReason: params.adjournmentReason,
        notes: params.notes || null,
        nextHearingDate: params.newHearingDate,
      },
    });

    // Create new hearing entry for the next date
    const newHearing = await this.prisma.courtHearing.create({
      data: {
        id: crypto.randomUUID(),
        serviceRequestId: originalHearing.serviceRequestId,
        caseNumber: originalHearing.caseNumber,
        hearingDate: params.newHearingDate,
        courtName: originalHearing.courtName,
        courtAddress: originalHearing.courtAddress,
        hearingType: 'regular',
        status: 'scheduled',
        createdByUserId: params.agentId,
        cityId: originalHearing.cityId,
      },
    });

    // Count total adjournments for this case
    const adjournmentCount = await this.prisma.courtHearing.count({
      where: {
        serviceRequestId: originalHearing.serviceRequestId,
        status: 'adjourned',
      },
    });

    // Resolve customer phone from the linked service request
    const serviceRequest = await this.prisma.serviceRequest.findFirst({
      where: { serviceInstanceId: originalHearing.serviceRequestId },
      select: { customerPhone: true },
    });

    await this.boss.send('notification.send', {
      type: 'court_hearing_adjourned',
      phone: serviceRequest?.customerPhone ?? undefined,
      serviceRequestId: originalHearing.serviceRequestId,
      data: {
        caseNumber: originalHearing.caseNumber,
        originalDate: originalHearing.hearingDate.toISOString(),
        newDate: params.newHearingDate.toISOString(),
        reason: params.adjournmentReason,
        courtName: originalHearing.courtName,
        adjournmentCount,
      },
    });

    // Extend SLA based on new hearing date
    await this.extendSla(
      originalHearing.serviceRequestId,
      params.newHearingDate
    );

    // Schedule reminders for new hearing (7-day and 1-day)
    await this.scheduleReminders(
      newHearing.id,
      params.newHearingDate,
      serviceRequest?.customerPhone ?? undefined
    );

    // Alert Ops if adjournment count > 3
    if (adjournmentCount > 3) {
      await this.boss.send('notification.send', {
        type: 'excessive_adjournment_alert',
        serviceRequestId: originalHearing.serviceRequestId,
        caseNumber: originalHearing.caseNumber,
        adjournmentCount,
      });
    }

    return {
      newHearing,
      adjournmentCount,
      slaExtended: true,
      opsAlerted: adjournmentCount > 3,
    };
  }

  private async extendSla(
    serviceRequestId: string,
    newHearingDate: Date
  ) {
    // Extend SLA deadline to 14 days after the new hearing date
    const newSlaDeadline = new Date(newHearingDate);
    newSlaDeadline.setDate(newSlaDeadline.getDate() + 14);

    // serviceRequestId here is actually stored on CourtHearing as a plain string.
    // If it maps to a serviceInstance, update that instance's slaDeadline.
    // This is a best-effort update.
    await this.prisma.serviceInstance.updateMany({
      where: { id: serviceRequestId },
      data: { slaDeadline: newSlaDeadline },
    });
  }

  private async scheduleReminders(
    hearingId: string,
    hearingDate: Date,
    phone?: string
  ) {
    const sevenDaysBefore = new Date(hearingDate);
    sevenDaysBefore.setDate(sevenDaysBefore.getDate() - 7);
    if (sevenDaysBefore > new Date()) {
      await this.boss.send(
        'notification.send',
        {
          type: 'court_hearing_reminder_7day',
          hearingId,
          phone,
          hearingDate: hearingDate.toISOString(),
        },
        { startAfter: sevenDaysBefore }
      );
    }

    const oneDayBefore = new Date(hearingDate);
    oneDayBefore.setDate(oneDayBefore.getDate() - 1);
    if (oneDayBefore > new Date()) {
      await this.boss.send(
        'notification.send',
        {
          type: 'court_hearing_reminder_1day',
          hearingId,
          phone,
          hearingDate: hearingDate.toISOString(),
        },
        { startAfter: oneDayBefore }
      );
    }
  }

  async getAdjournmentHistory(serviceRequestId: string) {
    const hearings = await this.prisma.courtHearing.findMany({
      where: { serviceRequestId },
      orderBy: { hearingDate: 'asc' },
    });

    const adjourned = hearings.filter(
      (h) => h.status === 'adjourned'
    );
    const originalDate = hearings[0]?.hearingDate;
    const currentDate = hearings
      .filter((h) => h.status === 'scheduled')
      .pop()?.hearingDate;

    return {
      hearings,
      adjournmentCount: adjourned.length,
      originalDate,
      currentDate,
    };
  }
}
