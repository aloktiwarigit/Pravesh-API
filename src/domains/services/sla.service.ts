/**
 * SLA Monitoring Service
 *
 * Story 9.1: SLA Configuration and Monitoring
 *
 * Handles:
 * - SLA configuration per service definition
 * - SLA status checking for service instances
 * - SLA breach detection and escalation
 * - SLA compliance reporting
 *
 * IMPORTANT: Schema field mapping:
 *   ServiceInstance.state  (lowercase: requested, in_progress, completed, delivered, cancelled, etc.)
 *   ServiceStateHistory.fromState / .toState  (NOT previousState/newState)
 *   ServiceDefinition.definition  (JsonB, NOT configData)
 *   ServiceInstance has NO completedAt — use updatedAt or stateHistory for timing
 *   ServiceInstance has NO requestNumber — join through serviceRequests
 */

import { PrismaClient } from '@prisma/client';
import { BusinessError } from '../../shared/errors/business-error';

/** Terminal states — service lifecycle is over */
const TERMINAL_STATES = ['completed', 'delivered', 'cancelled'];

export interface SlaConfig {
  targetCompletionDays: number;
  warningThresholdDays: number;
  escalationLevels: EscalationLevel[];
}

export interface EscalationLevel {
  afterDays: number;
  notifyRoles: string[];
  priority?: 'normal' | 'high' | 'urgent';
}

export interface SlaStatus {
  instanceId: string;
  status: 'on_track' | 'at_risk' | 'breached';
  targetDate: Date;
  hoursRemaining: number;
  daysRemaining: number;
  escalationLevel?: number;
  needsEscalation: boolean;
}

export interface SlaReport {
  cityId?: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  totalServices: number;
  completed: number;
  active: number;
  onTrack: number;
  atRisk: number;
  breached: number;
  complianceRate: number;
  avgCompletionDays: number;
}

// Default SLA configuration
const DEFAULT_SLA_CONFIG: SlaConfig = {
  targetCompletionDays: 7,
  warningThresholdDays: 5,
  escalationLevels: [
    { afterDays: 5, notifyRoles: ['ops_manager'], priority: 'high' },
    { afterDays: 7, notifyRoles: ['super_admin'], priority: 'urgent' },
  ],
};

export class SlaService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Gets SLA configuration for a service definition.
   * Reads from ServiceDefinition.definition (JsonB), falls back to default.
   */
  async getSlaConfig(serviceDefinitionId: string): Promise<SlaConfig> {
    const serviceDef = await this.prisma.serviceDefinition.findUnique({
      where: { id: serviceDefinitionId },
      select: { definition: true },
    });

    if (!serviceDef) {
      throw new BusinessError('SERVICE_DEFINITION_NOT_FOUND', 'Service definition not found', 404);
    }

    const defJson = serviceDef.definition as { sla?: SlaConfig } | null;
    return defJson?.sla || DEFAULT_SLA_CONFIG;
  }

  /**
   * Gets SLA status for a service instance.
   * AC1: Check current SLA status.
   */
  async getSlaStatus(instanceId: string): Promise<SlaStatus> {
    const instance = await this.prisma.serviceInstance.findUnique({
      where: { id: instanceId },
      select: {
        id: true,
        state: true,
        slaDeadline: true,
        serviceDefinitionId: true,
        createdAt: true,
      },
    });

    if (!instance) {
      throw new BusinessError('INSTANCE_NOT_FOUND', 'Service instance not found', 404);
    }

    // Terminal services are not subject to SLA
    if (TERMINAL_STATES.includes(instance.state)) {
      return {
        instanceId,
        status: 'on_track',
        targetDate: instance.slaDeadline || new Date(),
        hoursRemaining: 0,
        daysRemaining: 0,
        needsEscalation: false,
      };
    }

    const slaConfig = await this.getSlaConfig(instance.serviceDefinitionId);
    const now = new Date();
    const targetDate = instance.slaDeadline || new Date(
      instance.createdAt.getTime() + slaConfig.targetCompletionDays * 24 * 60 * 60 * 1000
    );

    const msRemaining = targetDate.getTime() - now.getTime();
    const hoursRemaining = Math.floor(msRemaining / (1000 * 60 * 60));
    const daysRemaining = Math.floor(hoursRemaining / 24);

    // Determine status
    let status: 'on_track' | 'at_risk' | 'breached';
    if (msRemaining <= 0) {
      status = 'breached';
    } else if (daysRemaining <= (slaConfig.targetCompletionDays - slaConfig.warningThresholdDays)) {
      status = 'at_risk';
    } else {
      status = 'on_track';
    }

    // Determine escalation level
    const daysSinceCreation = Math.floor(
      (now.getTime() - instance.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    );

    let escalationLevel: number | undefined;
    let needsEscalation = false;

    for (let i = slaConfig.escalationLevels.length - 1; i >= 0; i--) {
      const level = slaConfig.escalationLevels[i];
      if (daysSinceCreation >= level.afterDays) {
        escalationLevel = i + 1;
        needsEscalation = status !== 'on_track';
        break;
      }
    }

    return {
      instanceId,
      status,
      targetDate,
      hoursRemaining: Math.max(0, hoursRemaining),
      daysRemaining: Math.max(0, daysRemaining),
      escalationLevel,
      needsEscalation,
    };
  }

  /**
   * Processes escalations for all at-risk/breached services.
   * Called by scheduled job.
   * AC2: Daily escalation processing.
   */
  async processEscalations(cityId?: string): Promise<{ processed: number; escalated: number }> {
    const now = new Date();

    // Find all active (non-terminal) services
    const activeInstances = await this.prisma.serviceInstance.findMany({
      where: {
        ...(cityId && { cityId }),
        state: { notIn: TERMINAL_STATES },
      },
      select: {
        id: true,
        serviceDefinitionId: true,
        createdAt: true,
        slaDeadline: true,
        cityId: true,
        customerId: true,
        serviceRequests: {
          orderBy: { createdAt: 'desc' as const },
          take: 1,
          select: { requestNumber: true },
        },
      },
    });

    let processed = 0;
    let escalated = 0;

    for (const instance of activeInstances) {
      processed++;

      const slaStatus = await this.getSlaStatus(instance.id);

      if (slaStatus.needsEscalation && slaStatus.escalationLevel) {
        escalated++;

        const slaConfig = await this.getSlaConfig(instance.serviceDefinitionId);
        const level = slaConfig.escalationLevels[slaStatus.escalationLevel - 1];
        const requestNumber = instance.serviceRequests[0]?.requestNumber ?? instance.id;

        // Check if already escalated at this level
        const existingEscalation = await this.prisma.escalation.findFirst({
          where: {
            serviceInstanceId: instance.id,
            level: slaStatus.escalationLevel,
          },
        });

        if (!existingEscalation) {
          await this.prisma.escalation.create({
            data: {
              serviceInstanceId: instance.id,
              cityId: instance.cityId,
              level: slaStatus.escalationLevel,
              reason: `SLA ${slaStatus.status}: ${slaStatus.daysRemaining} days remaining`,
              status: 'open',
              metadata: { priority: level.priority || 'normal' } as any,
            },
          });

          for (const role of level.notifyRoles) {
            await this.prisma.notificationLog.create({
              data: {
                userId: 'system',
                templateCode: 'SLA_ESCALATION',
                channel: 'push',
                language: 'en',
                subject: `SLA Alert: ${requestNumber}`,
                body: `Service ${requestNumber} is ${slaStatus.status}. ${slaStatus.daysRemaining} days remaining until deadline.`,
                serviceInstanceId: instance.id,
                priority: level.priority === 'urgent' ? 'high' : 'normal',
                status: 'queued',
              },
            });
          }
        }
      }
    }

    return { processed, escalated };
  }

  /**
   * Gets SLA compliance report for a city.
   * AC3: Generate SLA reports.
   *
   * Since ServiceInstance has no completedAt, we derive completion timing
   * from ServiceStateHistory (transition to 'completed' or 'delivered').
   */
  async getSlaReport(
    cityId: string | undefined,
    startDate: Date,
    endDate: Date,
  ): Promise<SlaReport> {
    const where = {
      ...(cityId && { cityId }),
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    const [
      totalServices,
      completed,
      active,
      breached,
    ] = await Promise.all([
      this.prisma.serviceInstance.count({ where }),
      this.prisma.serviceInstance.count({
        where: { ...where, state: { in: ['completed', 'delivered'] } },
      }),
      this.prisma.serviceInstance.count({
        where: {
          ...where,
          state: { notIn: TERMINAL_STATES },
        },
      }),
      this.prisma.serviceInstance.count({
        where: {
          ...where,
          state: { notIn: TERMINAL_STATES },
          slaDeadline: { lt: new Date() },
        },
      }),
    ]);

    // Average completion time: find instances that reached 'completed' or 'delivered'
    // via their state history transitions
    const completedInstances = await this.prisma.serviceInstance.findMany({
      where: {
        ...where,
        state: { in: ['completed', 'delivered'] },
      },
      select: {
        createdAt: true,
        updatedAt: true,
      },
    });

    let avgCompletionDays = 0;
    if (completedInstances.length > 0) {
      const totalDays = completedInstances.reduce((sum, inst) => {
        // Use updatedAt as a proxy for completion time
        const days = Math.floor(
          (inst.updatedAt.getTime() - inst.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        );
        return sum + days;
      }, 0);
      avgCompletionDays = Math.round(totalDays / completedInstances.length);
    }

    // At risk: not breached but within warning threshold
    const warningThreshold = new Date();
    warningThreshold.setDate(warningThreshold.getDate() + 2);

    const atRisk = await this.prisma.serviceInstance.count({
      where: {
        ...where,
        state: { notIn: TERMINAL_STATES },
        slaDeadline: {
          gte: new Date(),
          lte: warningThreshold,
        },
      },
    });

    const onTrack = active - atRisk - breached;
    const complianceRate = totalServices > 0
      ? Math.round(((totalServices - breached) / totalServices) * 100)
      : 100;

    return {
      cityId,
      period: { startDate, endDate },
      totalServices,
      completed,
      active,
      onTrack: Math.max(0, onTrack),
      atRisk,
      breached,
      complianceRate,
      avgCompletionDays,
    };
  }

  /**
   * Gets list of services at risk or breached.
   * AC4: Get actionable alerts.
   * Joins through serviceRequests for requestNumber.
   */
  async getAlerts(cityId?: string, limit: number = 50) {
    const now = new Date();
    const warningThreshold = new Date();
    warningThreshold.setDate(warningThreshold.getDate() + 2);

    const alerts = await this.prisma.serviceInstance.findMany({
      where: {
        ...(cityId && { cityId }),
        state: { notIn: TERMINAL_STATES },
        OR: [
          { slaDeadline: { lt: now } },
          { slaDeadline: { lte: warningThreshold } },
        ],
      },
      select: {
        id: true,
        state: true,
        slaDeadline: true,
        customerId: true,
        cityId: true,
        createdAt: true,
        serviceRequests: {
          orderBy: { createdAt: 'desc' as const },
          take: 1,
          select: { requestNumber: true },
        },
      },
      orderBy: { slaDeadline: 'asc' },
      take: limit,
    });

    return alerts.map(alert => {
      const isBreached = alert.slaDeadline && alert.slaDeadline < now;
      const hoursRemaining = alert.slaDeadline
        ? Math.max(0, Math.floor((alert.slaDeadline.getTime() - now.getTime()) / (1000 * 60 * 60)))
        : null;

      return {
        id: alert.id,
        requestNumber: alert.serviceRequests[0]?.requestNumber ?? null,
        state: alert.state,
        slaDeadline: alert.slaDeadline,
        customerId: alert.customerId,
        cityId: alert.cityId,
        createdAt: alert.createdAt,
        alertType: isBreached ? 'BREACHED' : 'AT_RISK',
        hoursRemaining,
      };
    });
  }

  /**
   * Updates SLA deadline for a service instance.
   * AC5: Extend SLA when necessary.
   * Uses ServiceStateHistory.fromState/toState (NOT previousState/newState).
   */
  async extendSlaDeadline(
    instanceId: string,
    newDeadline: Date,
    reason: string,
    extendedBy: string,
  ) {
    const instance = await this.prisma.serviceInstance.findUnique({
      where: { id: instanceId },
    });

    if (!instance) {
      throw new BusinessError('INSTANCE_NOT_FOUND', 'Service instance not found', 404);
    }

    if (newDeadline < new Date()) {
      throw new BusinessError('INVALID_DEADLINE', 'New deadline must be in the future', 422);
    }

    // Log the extension as a state history entry (state stays the same)
    await this.prisma.serviceStateHistory.create({
      data: {
        serviceInstanceId: instanceId,
        fromState: instance.state,
        toState: instance.state,
        changedBy: extendedBy,
        reason: `SLA extended: ${reason}. Old deadline: ${instance.slaDeadline?.toISOString()}, New deadline: ${newDeadline.toISOString()}`,
      },
    });

    return this.prisma.serviceInstance.update({
      where: { id: instanceId },
      data: { slaDeadline: newDeadline },
    });
  }
}
