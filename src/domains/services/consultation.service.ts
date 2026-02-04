// Story 13-13: Video Consultation Booking with Timezone Awareness Service
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export class ConsultationService {
  constructor(
    private prisma: PrismaClient,
    private boss: any // PgBoss instance - namespace import cannot be used as type
  ) {}

  async getAvailableSlots(params: {
    consultantId: string;
    date: Date;
    customerTimezone: string;
  }) {
    const availability =
      await this.prisma.consultantAvailability.findMany({
        where: {
          consultantId: params.consultantId,
          isActive: true,
          dayOfWeek: params.date.getDay(),
        },
      });

    // Get existing bookings for the date
    const dayStart = new Date(params.date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(params.date);
    dayEnd.setUTCHours(23, 59, 59, 999);

    const existingBookings = await this.prisma.consultation.findMany({
      where: {
        consultantId: params.consultantId,
        scheduledAtUtc: { gte: dayStart, lte: dayEnd },
        status: { in: ['scheduled', 'in_progress'] },
      },
    });

    const bookedSlots = new Set(
      existingBookings.map((b) =>
        b.scheduledAtUtc.toISOString().slice(11, 16)
      )
    );

    // Generate 30-minute slots from availability, excluding booked ones
    const slots: {
      utc: string;
      customerLocal: string;
      istLocal: string;
    }[] = [];

    for (const avail of availability) {
      const [startH, startM] = avail.startTimeUtc
        .split(':')
        .map(Number);
      const [endH, endM] = avail.endTimeUtc
        .split(':')
        .map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      for (
        let mins = startMinutes;
        mins + 30 <= endMinutes;
        mins += 30
      ) {
        const slotH = Math.floor(mins / 60);
        const slotM = mins % 60;
        const timeStr = `${String(slotH).padStart(2, '0')}:${String(slotM).padStart(2, '0')}`;

        if (bookedSlots.has(timeStr)) continue;

        const slotDate = new Date(params.date);
        slotDate.setUTCHours(slotH, slotM, 0, 0);

        slots.push({
          utc: slotDate.toISOString(),
          customerLocal: this.formatInTimezone(
            slotDate,
            params.customerTimezone
          ),
          istLocal: this.formatInTimezone(
            slotDate,
            'Asia/Kolkata'
          ),
        });
      }
    }

    return slots;
  }

  async bookConsultation(params: {
    serviceRequestId?: string;
    customerId: string;
    consultantId: string;
    consultantType: string;
    scheduledAtUtc: Date;
    customerTimezone: string;
    cityId: string;
  }) {
    const consultation = await this.prisma.consultation.create({
      data: {
        id: crypto.randomUUID(),
        serviceRequestId: params.serviceRequestId || null,
        customerId: params.customerId,
        consultantId: params.consultantId,
        consultantType: params.consultantType,
        scheduledAtUtc: params.scheduledAtUtc,
        durationMinutes: 30,
        customerTimezone: params.customerTimezone,
        consultantTimezone: 'Asia/Kolkata',
        cityId: params.cityId,
      },
    });

    // Generate video call URL
    const videoCallUrl = await this.generateVideoCallUrl(
      consultation.id
    );
    await this.prisma.consultation.update({
      where: { id: consultation.id },
      data: { videoCallUrl },
    });

    // Schedule reminders
    // 1 day before
    const oneDayBefore = new Date(params.scheduledAtUtc);
    oneDayBefore.setDate(oneDayBefore.getDate() - 1);
    await this.boss.send(
      'notification.send',
      {
        type: 'consultation_reminder_1day',
        consultationId: consultation.id,
        customerId: params.customerId,
        consultantId: params.consultantId,
        scheduledAtUtc: params.scheduledAtUtc.toISOString(),
        customerTimezone: params.customerTimezone,
      },
      { startAfter: oneDayBefore }
    );

    // 1 hour before
    const oneHourBefore = new Date(params.scheduledAtUtc);
    oneHourBefore.setHours(oneHourBefore.getHours() - 1);
    await this.boss.send(
      'notification.send',
      {
        type: 'consultation_reminder_1hour',
        consultationId: consultation.id,
      },
      { startAfter: oneHourBefore }
    );

    // 15 min before - send video link
    const fifteenMinBefore = new Date(params.scheduledAtUtc);
    fifteenMinBefore.setMinutes(
      fifteenMinBefore.getMinutes() - 15
    );
    await this.boss.send(
      'notification.send',
      {
        type: 'consultation_video_link',
        consultationId: consultation.id,
        videoCallUrl,
      },
      { startAfter: fifteenMinBefore }
    );

    // 15 min after - check for no-show
    const fifteenMinAfter = new Date(params.scheduledAtUtc);
    fifteenMinAfter.setMinutes(
      fifteenMinAfter.getMinutes() + 15
    );
    await this.boss.send(
      'consultation.no-show-check',
      {
        consultationId: consultation.id,
      },
      { startAfter: fifteenMinAfter }
    );

    return { ...consultation, videoCallUrl };
  }

  async reschedule(params: {
    consultationId: string;
    newScheduledAtUtc: Date;
    rescheduledByUserId: string;
  }) {
    const original =
      await this.prisma.consultation.findUniqueOrThrow({
        where: { id: params.consultationId },
      });

    // Check 24-hour notice
    const hoursUntil =
      (original.scheduledAtUtc.getTime() - Date.now()) /
      (1000 * 60 * 60);
    if (hoursUntil < 24) {
      throw new Error(
        'Rescheduling requires at least 24 hours notice'
      );
    }

    // Cancel original
    await this.prisma.consultation.update({
      where: { id: params.consultationId },
      data: { status: 'rescheduled' },
    });

    // Create new booking
    return this.bookConsultation({
      customerId: original.customerId,
      consultantId: original.consultantId,
      consultantType: original.consultantType,
      scheduledAtUtc: params.newScheduledAtUtc,
      customerTimezone: original.customerTimezone,
      serviceRequestId: original.serviceRequestId || undefined,
      cityId: original.cityId,
    });
  }

  async handleNoShow(consultationId: string) {
    const consultation =
      await this.prisma.consultation.findUniqueOrThrow({
        where: { id: consultationId },
      });

    if (consultation.status !== 'scheduled') return;

    await this.prisma.consultation.update({
      where: { id: consultationId },
      data: {
        status: 'missed',
        noShowCount: { increment: 1 },
      },
    });

    // Notify both parties
    await this.boss.send('notification.send', {
      type: 'consultation_missed',
      consultationId,
    });

    // Flag for ops if repeated no-shows
    if (consultation.noShowCount >= 2) {
      await this.boss.send('notification.send', {
        type: 'consultation_repeated_no_show',
        consultationId,
      });
    }
  }

  private async generateVideoCallUrl(
    consultationId: string
  ): Promise<string> {
    // Integrate with Google Meet API or generate a Jitsi/Daily.co link
    return `https://meet.propertyagent.in/${consultationId}`;
  }

  private formatInTimezone(
    date: Date,
    timezone: string
  ): string {
    return date.toLocaleString('en-US', { timeZone: timezone });
  }
}
