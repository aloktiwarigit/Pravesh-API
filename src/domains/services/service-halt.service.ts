// Story 5-13: Service Halt Service
// Handles halting and resuming of service instances.
// Services can be halted due to: missing documents, payment issues,
// government office delays, customer request, or disputes.

import { PrismaClient } from '@prisma/client';
import { WorkflowEngine } from './workflow-engine.js';
import { BusinessError } from '../../shared/errors/business-error.js';

export type HaltReason =
  | 'missing_documents'
  | 'payment_pending'
  | 'government_delay'
  | 'customer_request'
  | 'dispute_pending'
  | 'agent_reassignment'
  | 'force_majeure'
  | 'other';

export interface HaltServicePayload {
  serviceInstanceId: string;
  reason: HaltReason;
  description: string;
  haltedBy: string;
  expectedResumeDate?: string;
  requiredActions?: string[];
}

export interface ResumeServicePayload {
  serviceInstanceId: string;
  resumedBy: string;
  resumeToState?: string; // State to resume to; defaults to state before halt
  notes?: string;
}

export class ServiceHaltService {
  private engine: WorkflowEngine;

  constructor(
    private prisma: PrismaClient,
    private boss: any, // PgBoss instance - namespace import cannot be used as type
  ) {
    this.engine = new WorkflowEngine(prisma);
  }

  /**
   * Halt a service instance.
   */
  async haltService(payload: HaltServicePayload) {
    const instance = await this.prisma.serviceInstance.findUnique({
      where: { id: payload.serviceInstanceId },
    });

    if (!instance) {
      throw new BusinessError(
        'BUSINESS_INSTANCE_NOT_FOUND',
        'Service instance not found',
        404,
      );
    }

    // Check if already halted
    if (instance.state === 'halted') {
      throw new BusinessError(
        'BUSINESS_ALREADY_HALTED',
        'Service is already halted',
        422,
      );
    }

    // Check if in a haltable state
    const haltableStates = new Set([
      'in_progress',
      'payment_pending',
      'paid',
    ]);
    const isStepState = /^step_\d+$/.test(instance.state);

    if (!haltableStates.has(instance.state) && !isStepState) {
      throw new BusinessError(
        'BUSINESS_CANNOT_HALT',
        `Cannot halt service in state: ${instance.state}`,
        422,
        { currentState: instance.state },
      );
    }

    // Save the pre-halt state so we can resume to it
    const preHaltState = instance.state;

    // Transition to halted
    const result = await this.engine.transition({
      serviceInstanceId: payload.serviceInstanceId,
      newState: 'halted',
      changedBy: payload.haltedBy,
      reason: `Halted: ${payload.reason} - ${payload.description}`,
      metadata: {
        preHaltState,
        haltReason: payload.reason,
        haltDescription: payload.description,
        expectedResumeDate: payload.expectedResumeDate,
        requiredActions: payload.requiredActions,
      },
    });

    if (!result.success) {
      throw new BusinessError(
        'BUSINESS_HALT_FAILED',
        result.error || 'Failed to halt service',
        422,
      );
    }

    // Notify stakeholders
    await this.boss.send('notification.send', {
      type: 'service_halted',
      serviceInstanceId: payload.serviceInstanceId,
      reason: payload.reason,
      haltedBy: payload.haltedBy,
    });

    // Write Firestore event — use arrayUnion to append to events array
    await this.boss.send('firestore.write', {
      collection: 'service_events',
      documentId: instance.id,
      data: {
        currentStatus: 'halted',
        haltReason: payload.reason,
        lastUpdatedAt: new Date().toISOString(),
      },
      arrayUnionFields: {
        events: {
          type: 'service_halted',
          reason: payload.reason,
          description: payload.description,
          timestamp: new Date().toISOString(),
          haltedBy: payload.haltedBy,
        },
      },
    });

    return { transition: result };
  }

  /**
   * Resume a halted service.
   */
  async resumeService(payload: ResumeServicePayload) {
    const instance = await this.prisma.serviceInstance.findUnique({
      where: { id: payload.serviceInstanceId },
    });

    if (!instance) {
      throw new BusinessError(
        'BUSINESS_INSTANCE_NOT_FOUND',
        'Service instance not found',
        404,
      );
    }

    if (instance.state !== 'halted') {
      throw new BusinessError(
        'BUSINESS_NOT_HALTED',
        'Service is not currently halted',
        422,
      );
    }

    // Get pre-halt state from metadata
    const metadata = instance.metadata as any;
    const resumeToState =
      payload.resumeToState || metadata?.preHaltState || 'in_progress';

    // Transition back
    const result = await this.engine.transition({
      serviceInstanceId: payload.serviceInstanceId,
      newState: resumeToState,
      changedBy: payload.resumedBy,
      reason: `Resumed: ${payload.notes || 'Service resumed'}`,
    });

    if (!result.success) {
      throw new BusinessError(
        'BUSINESS_RESUME_FAILED',
        result.error || 'Failed to resume service',
        422,
      );
    }

    // Notify stakeholders
    await this.boss.send('notification.send', {
      type: 'service_resumed',
      serviceInstanceId: payload.serviceInstanceId,
      resumedTo: resumeToState,
    });

    return { transition: result, resumedTo: resumeToState };
  }

  /**
   * Get halt history for a service instance.
   * Returns halt-related state transitions from ServiceStateHistory.
   */
  async getHaltHistory(serviceInstanceId: string) {
    return this.prisma.serviceStateHistory.findMany({
      where: {
        serviceInstanceId,
        OR: [{ toState: 'halted' }, { fromState: 'halted' }],
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get all currently halted services for a city (Ops dashboard).
   */
  async getHaltedServices(cityId: string) {
    return this.prisma.serviceInstance.findMany({
      where: { cityId, state: 'halted' },
      include: {
        serviceDefinition: { select: { code: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });
  }
}
