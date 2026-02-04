// Story 5-10: SLA Timer Service
// Monitors service instance deadlines, sends warnings, triggers escalations.

import { PrismaClient } from '@prisma/client';
import { getAllActiveStates } from './workflow-engine.js';

const SLA_WARNING_THRESHOLD_PERCENT = 80; // Warn at 80% of SLA time elapsed
const BUSINESS_HOURS_PER_DAY = 8;

export interface SlaStatus {
  serviceInstanceId: string;
  slaBusinessDays: number;
  elapsedBusinessDays: number;
  remainingBusinessDays: number;
  percentElapsed: number;
  isBreached: boolean;
  isWarning: boolean;
  breachedAt?: string;
  currentState: string;
}

export class SlaTimerService {
  constructor(
    private prisma: PrismaClient,
    private boss: any, // PgBoss instance - namespace import cannot be used as type
  ) {}

  /**
   * Determine when work actually started for a service instance.
   * Looks for the first transition into 'in_progress' or a step state.
   * Falls back to createdAt if no work-start transition is found.
   */
  private async getWorkStartDate(serviceInstanceId: string, fallbackDate: Date): Promise<Date> {
    const workStartTransition = await this.prisma.serviceStateHistory.findFirst({
      where: {
        serviceInstanceId,
        toState: 'in_progress',
      },
      orderBy: { createdAt: 'asc' },
    });

    return workStartTransition?.createdAt ?? fallbackDate;
  }

  /**
   * Calculate SLA status for a service instance.
   */
  async getSlaStatus(serviceInstanceId: string): Promise<SlaStatus | null> {
    const instance = await this.prisma.serviceInstance.findUnique({
      where: { id: serviceInstanceId },
      include: { serviceDefinition: true },
    });

    if (!instance) return null;

    const def = instance.serviceDefinition.definition as any;
    const slaBusinessDays = def.slaBusinessDays || 15;

    // Count SLA from when work actually started (transition to in_progress),
    // not from when the service request was created
    const workStartDate = await this.getWorkStartDate(serviceInstanceId, instance.createdAt);

    const elapsedBusinessDays = this.calculateBusinessDays(
      workStartDate,
      new Date(),
    );

    const remainingBusinessDays = Math.max(
      slaBusinessDays - elapsedBusinessDays,
      0,
    );
    const percentElapsed = Math.min(
      Math.round((elapsedBusinessDays / slaBusinessDays) * 100),
      100,
    );
    const isBreached = elapsedBusinessDays > slaBusinessDays;
    const isWarning = percentElapsed >= SLA_WARNING_THRESHOLD_PERCENT && !isBreached;

    return {
      serviceInstanceId,
      slaBusinessDays,
      elapsedBusinessDays,
      remainingBusinessDays,
      percentElapsed,
      isBreached,
      isWarning,
      breachedAt: isBreached
        ? this.addBusinessDays(workStartDate, slaBusinessDays).toISOString()
        : undefined,
      currentState: instance.state,
    };
  }

  /**
   * Check all active service instances for SLA warnings/breaches.
   * Called periodically by pg-boss job.
   */
  async checkAllSlas() {
    const activeStates = getAllActiveStates();

    const activeInstances = await this.prisma.serviceInstance.findMany({
      where: { state: { in: activeStates } },
      include: { serviceDefinition: true },
      take: 500, // Process in bounded batches to prevent unbounded queries
    });

    const warnings: string[] = [];
    const breaches: string[] = [];

    for (const instance of activeInstances) {
      const status = await this.getSlaStatus(instance.id);
      if (!status) continue;

      if (status.isBreached) {
        breaches.push(instance.id);

        // TODO: SlaBreach model not in schema — using Escalation as breach record
        // Check if an escalation already exists for this SLA breach
        const existingBreach = await this.prisma.escalation.findFirst({
          where: { serviceInstanceId: instance.id, reason: 'SLA breach' },
        });

        if (!existingBreach) {
          await this.prisma.escalation.create({
            data: {
              serviceInstanceId: instance.id,
              level: 1,
              reason: 'SLA breach',
              status: 'open',
              cityId: instance.cityId,
              metadata: {
                slaBusinessDays: status.slaBusinessDays,
                elapsedBusinessDays: status.elapsedBusinessDays,
                breachedAt: new Date().toISOString(),
              } as any,
            },
          });

          // Notify Ops of breach
          await this.boss.send('notification.send', {
            type: 'sla_breached',
            serviceInstanceId: instance.id,
            cityId: instance.cityId,
            elapsedDays: status.elapsedBusinessDays,
            slaDays: status.slaBusinessDays,
          });
        }
      } else if (status.isWarning) {
        warnings.push(instance.id);

        // TODO: SlaWarning model not in schema — sending notification only (deduplicated via pg-boss singletonKey)
        await this.boss.send(
          'notification.send',
          {
            type: 'sla_warning',
            serviceInstanceId: instance.id,
            percentElapsed: status.percentElapsed,
            remainingDays: status.remainingBusinessDays,
          },
          { singletonKey: `sla-warning-${instance.id}` },
        );
      }
    }

    return {
      checked: activeInstances.length,
      warnings: warnings.length,
      breaches: breaches.length,
    };
  }

  /**
   * Get SLA dashboard data for Ops.
   */
  async getSlaDashboard(cityId: string) {
    const activeStates = getAllActiveStates();

    // TODO: SlaBreach/SlaWarning models not in schema — using Escalation as proxy
    const [total, breached] = await Promise.all([
      this.prisma.serviceInstance.count({
        where: { cityId, state: { in: activeStates } },
      }),
      this.prisma.escalation.count({
        where: { cityId, reason: 'SLA breach', resolvedAt: null },
      }),
    ]);

    const recentBreaches = await this.prisma.escalation.findMany({
      where: { cityId, reason: 'SLA breach', resolvedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: {
        serviceInstance: {
          include: {
            serviceDefinition: {
              select: { name: true, code: true },
            },
          },
        },
      },
    });

    return {
      totalActive: total,
      atRisk: 0, // TODO: SlaWarning model not in schema
      breached,
      onTrack: total - breached,
      recentBreaches,
    };
  }

  /**
   * Calculate business days between two dates (excludes weekends).
   */
  private calculateBusinessDays(start: Date, end: Date): number {
    let count = 0;
    const current = new Date(start);
    while (current < end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  }

  /**
   * Add business days to a date.
   */
  private addBusinessDays(start: Date, days: number): Date {
    const result = new Date(start);
    let added = 0;
    while (added < days) {
      result.setDate(result.getDate() + 1);
      const day = result.getDay();
      if (day !== 0 && day !== 6) {
        added++;
      }
    }
    return result;
  }
}
