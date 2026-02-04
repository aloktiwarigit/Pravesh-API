// Story 5-12: Escalation Service
// Handles escalation chains when SLA breaches occur or manual escalations.
// Escalation levels: Agent → Ops → Franchise Owner → Super Admin.

import { PrismaClient } from '@prisma/client';
import { BusinessError } from '../../shared/errors/business-error.js';

export type EscalationLevel = 'ops' | 'franchise_owner' | 'super_admin';
export type EscalationReason =
  | 'sla_breach'
  | 'customer_complaint'
  | 'agent_unresponsive'
  | 'payment_issue'
  | 'document_issue'
  | 'manual';

export type EscalationStatus =
  | 'open'
  | 'acknowledged'
  | 'in_progress'
  | 'resolved'
  | 'closed';

export interface CreateEscalationPayload {
  serviceInstanceId: string;
  cityId: string;
  reason: EscalationReason;
  description: string;
  raisedBy: string;
  raisedByRole: string;
  targetLevel?: EscalationLevel;
}

const ESCALATION_CHAIN: EscalationLevel[] = [
  'ops',
  'franchise_owner',
  'super_admin',
];

const AUTO_ESCALATION_HOURS: Record<EscalationLevel, number> = {
  ops: 24,
  franchise_owner: 48,
  super_admin: 72,
};

export class EscalationService {
  constructor(
    private prisma: PrismaClient,
    private boss: any, // PgBoss instance - namespace import cannot be used as type
  ) {}

  /**
   * Create an escalation.
   */
  async createEscalation(payload: CreateEscalationPayload) {
    const targetLevel = payload.targetLevel || 'ops';

    const escalation = await this.prisma.escalation.create({
      data: {
        serviceInstanceId: payload.serviceInstanceId,
        cityId: payload.cityId,
        reason: payload.description
          ? `${payload.reason}: ${payload.description}`
          : payload.reason,
        level: ESCALATION_CHAIN.indexOf(targetLevel) + 1,
        status: 'open',
        assignedTo: payload.raisedBy,
        metadata: {
          raisedBy: payload.raisedBy,
          raisedByRole: payload.raisedByRole,
          currentLevel: targetLevel,
        } as any,
      },
    });

    // Notify the target escalation level
    await this.notifyEscalationTarget(escalation.id, targetLevel, payload.cityId);

    // Schedule auto-escalation timer
    const autoEscalateHours = AUTO_ESCALATION_HOURS[targetLevel];
    await this.boss.send(
      'escalation.auto-escalate',
      {
        escalationId: escalation.id,
        currentLevel: targetLevel,
      },
      {
        startAfter: autoEscalateHours * 60 * 60, // seconds
        singletonKey: `auto-escalate-${escalation.id}-${targetLevel}`,
      },
    );

    return escalation;
  }

  /**
   * Auto-escalate to next level if not acknowledged.
   * Uses WHERE clause with status='open' to prevent race conditions.
   */
  async autoEscalate(escalationId: string) {
    const escalation = await this.prisma.escalation.findUnique({
      where: { id: escalationId },
    });

    if (!escalation || escalation.status !== 'open') {
      return { escalated: false, reason: 'already handled' };
    }

    const meta = escalation.metadata as any;
    const currentLevel = meta?.currentLevel || ESCALATION_CHAIN[escalation.level - 1] || 'ops';
    const currentIndex = ESCALATION_CHAIN.indexOf(
      currentLevel as EscalationLevel,
    );
    const nextIndex = currentIndex + 1;

    if (nextIndex >= ESCALATION_CHAIN.length) {
      return { escalated: false, reason: 'already at highest level' };
    }

    const nextLevel = ESCALATION_CHAIN[nextIndex];

    // Optimistic lock: only update if still open (prevents race with acknowledge/resolve)
    const nextLevelIndex = ESCALATION_CHAIN.indexOf(nextLevel) + 1;
    const updateResult = await this.prisma.escalation.updateMany({
      where: {
        id: escalationId,
        status: 'open', // Guard against concurrent status change
      },
      data: {
        level: nextLevelIndex,
        metadata: {
          ...(escalation.metadata as any || {}),
          currentLevel: nextLevel,
          escalatedAt: new Date().toISOString(),
        } as any,
      },
    });

    if (updateResult.count === 0) {
      return { escalated: false, reason: 'already handled' };
    }

    // TODO: EscalationHistory model not in schema — escalation level tracked in metadata

    await this.notifyEscalationTarget(
      escalationId,
      nextLevel,
      escalation.cityId,
    );

    // Schedule next auto-escalation with singletonKey to prevent duplicates
    const nextAutoHours = AUTO_ESCALATION_HOURS[nextLevel];
    await this.boss.send(
      'escalation.auto-escalate',
      { escalationId, currentLevel: nextLevel },
      {
        startAfter: nextAutoHours * 60 * 60,
        singletonKey: `auto-escalate-${escalationId}-${nextLevel}`,
      },
    );

    return { escalated: true, newLevel: nextLevel };
  }

  /**
   * Acknowledge an escalation (prevents auto-escalation).
   */
  async acknowledge(escalationId: string, acknowledgedBy: string) {
    const escalation = await this.prisma.escalation.findUnique({
      where: { id: escalationId },
    });

    if (!escalation) {
      throw new BusinessError(
        'BUSINESS_ESCALATION_NOT_FOUND',
        'Escalation not found',
        404,
      );
    }

    return this.prisma.escalation.update({
      where: { id: escalationId },
      data: {
        status: 'acknowledged',
        acknowledgedAt: new Date(),
        metadata: {
          ...(escalation.metadata as any || {}),
          acknowledgedBy,
        } as any,
      },
    });
  }

  /**
   * Resolve an escalation.
   */
  async resolve(
    escalationId: string,
    resolvedBy: string,
    resolution: string,
  ) {
    const escalation = await this.prisma.escalation.findUnique({
      where: { id: escalationId },
    });

    if (!escalation) {
      throw new BusinessError(
        'BUSINESS_ESCALATION_NOT_FOUND',
        'Escalation not found',
        404,
      );
    }

    const updated = await this.prisma.escalation.update({
      where: { id: escalationId },
      data: {
        status: 'resolved',
        resolvedBy,
        resolvedAt: new Date(),
        metadata: {
          ...(escalation.metadata as any || {}),
          resolution,
        } as any,
      },
    });

    const meta = escalation.metadata as any;
    // Notify original raiser
    await this.boss.send('notification.send', {
      type: 'escalation_resolved',
      escalationId,
      raisedBy: meta?.raisedBy,
      resolution,
    });

    return updated;
  }

  /**
   * Get escalations for a city (Ops dashboard).
   */
  async getEscalations(
    cityId: string,
    options?: { status?: string; level?: string },
  ) {
    const where: any = { cityId };
    if (options?.status) where.status = options.status;
    if (options?.level) where.level = ESCALATION_CHAIN.indexOf(options.level as EscalationLevel) + 1;

    return this.prisma.escalation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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
  }

  /**
   * Notify the appropriate people at the escalation level.
   */
  private async notifyEscalationTarget(
    escalationId: string,
    level: EscalationLevel,
    cityId: string,
  ) {
    await this.boss.send('notification.send', {
      type: 'escalation_raised',
      escalationId,
      targetLevel: level,
      cityId,
      channels: ['fcm', 'whatsapp'],
    });
  }
}
