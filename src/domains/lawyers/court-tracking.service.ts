/**
 * Court Tracking Service
 *
 * Story 4.1X: Court Hearing Tracking for Legal Cases
 *
 * Handles:
 * - Scheduling court hearings
 * - Recording appearance outcomes
 * - Managing hearing notifications
 * - Tracking hearing history
 */

import { PrismaClient } from '@prisma/client';
import { BusinessError } from '../../shared/errors/business-error';

/**
 * CourtHearing.status is a plain String field in the schema (not an enum).
 * Valid values: 'scheduled', 'completed', 'adjourned', 'cancelled'
 */
const HEARING_STATUS = {
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  ADJOURNED: 'adjourned',
  CANCELLED: 'cancelled',
} as const;

type HearingStatusValue = (typeof HEARING_STATUS)[keyof typeof HEARING_STATUS];

export interface ScheduleHearingInput {
  serviceRequestId: string;
  caseNumber: string;
  courtName: string;
  courtAddress?: string;
  hearingDate: Date;
  hearingType?: string;
  notes?: string;
  createdByUserId: string;
  cityId: string;
}

export interface RecordAppearanceInput {
  hearingId: string;
  outcome: string;
  nextHearingDate?: Date;
  notes?: string;
  createdByUserId: string;
}

export interface ListHearingsFilter {
  serviceRequestId?: string;
  caseNumber?: string;
  status?: HearingStatusValue;
  fromDate?: Date;
  toDate?: Date;
  cityId?: string;
  limit?: number;
  offset?: number;
}

export class CourtTrackingService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Schedules a new court hearing for a service request.
   * AC1: Lawyers can schedule hearings for their cases.
   */
  async scheduleHearing(input: ScheduleHearingInput) {
    const {
      serviceRequestId,
      caseNumber,
      courtName,
      courtAddress,
      hearingDate,
      hearingType = 'regular',
      notes,
      createdByUserId,
      cityId,
    } = input;

    // Validate hearing date is in the future
    if (new Date(hearingDate) < new Date()) {
      throw new BusinessError('INVALID_HEARING_DATE', 'Hearing date must be in the future', 422);
    }

    // Create hearing
    const hearing = await this.prisma.courtHearing.create({
      data: {
        serviceRequestId,
        caseNumber,
        courtName,
        courtAddress,
        hearingDate,
        hearingType,
        notes,
        status: HEARING_STATUS.SCHEDULED,
        createdByUserId,
        cityId,
      },
    });

    return hearing;
  }

  /**
   * Records the outcome of a court appearance.
   * AC2: Lawyers can record hearing outcomes and schedule next hearing.
   */
  async recordAppearance(input: RecordAppearanceInput) {
    const { hearingId, outcome, nextHearingDate, notes, createdByUserId } = input;

    const hearing = await this.prisma.courtHearing.findUnique({
      where: { id: hearingId },
    });

    if (!hearing) {
      throw new BusinessError('HEARING_NOT_FOUND', 'Court hearing not found', 404);
    }

    if (hearing.status !== HEARING_STATUS.SCHEDULED) {
      throw new BusinessError(
        'HEARING_NOT_SCHEDULED',
        `Hearing is ${hearing.status.toLowerCase()}, cannot record appearance`,
        422,
      );
    }

    // Update hearing with outcome
    const updatedHearing = await this.prisma.courtHearing.update({
      where: { id: hearingId },
      data: {
        status: HEARING_STATUS.COMPLETED,
        outcome,
        nextHearingDate,
        notes: notes || hearing.notes,
      },
    });

    // If next hearing date provided, auto-create next hearing
    if (nextHearingDate) {
      await this.prisma.courtHearing.create({
        data: {
          serviceRequestId: hearing.serviceRequestId,
          caseNumber: hearing.caseNumber,
          courtName: hearing.courtName,
          courtAddress: hearing.courtAddress,
          hearingDate: nextHearingDate,
          hearingType: 'regular',
          status: HEARING_STATUS.SCHEDULED,
          createdByUserId,
          cityId: hearing.cityId,
        },
      });
    }

    return updatedHearing;
  }

  /**
   * Adjourns a scheduled hearing.
   * AC3: Hearings can be adjourned with reason.
   */
  async adjournHearing(hearingId: string, reason: string, newDate?: Date, createdByUserId?: string) {
    const hearing = await this.prisma.courtHearing.findUnique({
      where: { id: hearingId },
    });

    if (!hearing) {
      throw new BusinessError('HEARING_NOT_FOUND', 'Court hearing not found', 404);
    }

    if (hearing.status !== HEARING_STATUS.SCHEDULED) {
      throw new BusinessError(
        'HEARING_NOT_SCHEDULED',
        `Hearing is ${hearing.status.toLowerCase()}, cannot adjourn`,
        422,
      );
    }

    // Update hearing as adjourned
    const updatedHearing = await this.prisma.courtHearing.update({
      where: { id: hearingId },
      data: {
        status: HEARING_STATUS.ADJOURNED,
        outcome: `Adjourned: ${reason}`,
        adjournmentReason: reason,
        nextHearingDate: newDate,
      },
    });

    // If new date provided, create new hearing
    if (newDate && createdByUserId) {
      await this.prisma.courtHearing.create({
        data: {
          serviceRequestId: hearing.serviceRequestId,
          caseNumber: hearing.caseNumber,
          courtName: hearing.courtName,
          courtAddress: hearing.courtAddress,
          hearingDate: newDate,
          hearingType: hearing.hearingType,
          notes: `Rescheduled from ${hearing.hearingDate.toISOString().split('T')[0]}`,
          status: HEARING_STATUS.SCHEDULED,
          createdByUserId,
          cityId: hearing.cityId,
        },
      });
    }

    return updatedHearing;
  }

  /**
   * Cancels a scheduled hearing.
   */
  async cancelHearing(hearingId: string, reason: string) {
    const hearing = await this.prisma.courtHearing.findUnique({
      where: { id: hearingId },
    });

    if (!hearing) {
      throw new BusinessError('HEARING_NOT_FOUND', 'Court hearing not found', 404);
    }

    if (hearing.status !== HEARING_STATUS.SCHEDULED) {
      throw new BusinessError(
        'HEARING_NOT_SCHEDULED',
        `Hearing is ${hearing.status.toLowerCase()}, cannot cancel`,
        422,
      );
    }

    const updatedHearing = await this.prisma.courtHearing.update({
      where: { id: hearingId },
      data: {
        status: HEARING_STATUS.CANCELLED,
        outcome: `Cancelled: ${reason}`,
      },
    });

    return updatedHearing;
  }

  /**
   * Gets a hearing by ID.
   */
  async getHearing(hearingId: string) {
    const hearing = await this.prisma.courtHearing.findUnique({
      where: { id: hearingId },
      include: {
        courtOrders: true,
      },
    });

    if (!hearing) {
      throw new BusinessError('HEARING_NOT_FOUND', 'Court hearing not found', 404);
    }

    return hearing;
  }

  /**
   * Lists hearings with filters.
   * AC4: Lawyers can view their upcoming and past hearings.
   */
  async listHearings(filters: ListHearingsFilter) {
    const {
      serviceRequestId,
      caseNumber,
      status,
      fromDate,
      toDate,
      cityId,
      limit = 20,
      offset = 0,
    } = filters;

    const where: Record<string, unknown> = {
      ...(serviceRequestId && { serviceRequestId }),
      ...(caseNumber && { caseNumber }),
      ...(status && { status }),
      ...(cityId && { cityId }),
      ...((fromDate || toDate) && {
        hearingDate: {
          ...(fromDate && { gte: fromDate }),
          ...(toDate && { lte: toDate }),
        },
      }),
    };

    const [hearings, total] = await Promise.all([
      this.prisma.courtHearing.findMany({
        where,
        include: {
          courtOrders: true,
        },
        orderBy: { hearingDate: 'asc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.courtHearing.count({ where }),
    ]);

    return {
      hearings,
      total,
      limit,
      offset,
    };
  }

  /**
   * Gets upcoming hearings filtered by cityId (e.g., for a lawyer's city).
   * AC5: Dashboard shows upcoming hearings.
   */
  async getUpcomingHearings(cityId: string, days: number = 7) {
    const fromDate = new Date();
    const toDate = new Date();
    toDate.setDate(toDate.getDate() + days);

    return this.listHearings({
      cityId,
      status: HEARING_STATUS.SCHEDULED,
      fromDate,
      toDate,
    });
  }

  /**
   * Gets hearings for a specific service request.
   */
  async getServiceRequestHearings(serviceRequestId: string) {
    return this.listHearings({ serviceRequestId });
  }

  /**
   * Gets hearings scheduled for today (for notification job).
   * AC6: Send reminders for hearings scheduled today.
   */
  async getTodaysHearings() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    const hearings = await this.prisma.courtHearing.findMany({
      where: {
        status: HEARING_STATUS.SCHEDULED,
        hearingDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        courtOrders: true,
      },
    });

    return hearings;
  }

  /**
   * Gets hearings scheduled for tomorrow (for advance notification).
   */
  async getTomorrowsHearings() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const startOfDay = new Date(tomorrow);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(tomorrow);
    endOfDay.setHours(23, 59, 59, 999);

    const hearings = await this.prisma.courtHearing.findMany({
      where: {
        status: HEARING_STATUS.SCHEDULED,
        hearingDate: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        courtOrders: true,
      },
    });

    return hearings;
  }

  /**
   * Gets hearing statistics filtered by cityId.
   */
  async getHearingStats(cityId: string, period?: { startDate: Date; endDate: Date }) {
    const where: Record<string, unknown> = {
      cityId,
      ...(period && {
        hearingDate: {
          gte: period.startDate,
          lte: period.endDate,
        },
      }),
    };

    const [total, scheduled, completed, adjourned, cancelled] = await Promise.all([
      this.prisma.courtHearing.count({ where }),
      this.prisma.courtHearing.count({ where: { ...where, status: HEARING_STATUS.SCHEDULED } }),
      this.prisma.courtHearing.count({ where: { ...where, status: HEARING_STATUS.COMPLETED } }),
      this.prisma.courtHearing.count({ where: { ...where, status: HEARING_STATUS.ADJOURNED } }),
      this.prisma.courtHearing.count({ where: { ...where, status: HEARING_STATUS.CANCELLED } }),
    ]);

    return {
      total,
      scheduled,
      completed,
      adjourned,
      cancelled,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  }
}
