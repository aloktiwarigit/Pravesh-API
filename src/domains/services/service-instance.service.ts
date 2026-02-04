// Story 5-6: Service Instance Service
// Creates and manages service instances linked to service requests.
// Each instance tracks state via the workflow engine.

import { PrismaClient } from '@prisma/client';
import { WorkflowEngine } from './workflow-engine.js';
import { BusinessError } from '../../shared/errors/business-error.js';
import {
  parsePagination,
  buildPaginatedResponse,
} from '../../shared/utils/pagination.js';

export interface CreateInstancePayload {
  customerId: string;
  serviceDefinitionId: string;
  cityId: string;
  createdBy: string;
  metadata?: Record<string, unknown>;
}

export class ServiceInstanceService {
  private engine: WorkflowEngine;

  constructor(
    private prisma: PrismaClient,
    private boss: any, // PgBoss instance - namespace import cannot be used as type
  ) {
    this.engine = new WorkflowEngine(prisma);
  }

  /**
   * Create a new service instance and initialize at 'requested' state.
   */
  async createInstance(payload: CreateInstancePayload) {
    // Verify service definition exists
    const definition = await this.prisma.serviceDefinition.findUnique({
      where: { id: payload.serviceDefinitionId },
    });

    if (!definition || !definition.isActive) {
      throw new BusinessError(
        'BUSINESS_DEFINITION_NOT_FOUND',
        'Service definition not found or inactive',
        404,
      );
    }

    // Check for existing active instance on same customer + definition
    const existing = await this.prisma.serviceInstance.findFirst({
      where: {
        customerId: payload.customerId,
        serviceDefinitionId: payload.serviceDefinitionId,
        state: { notIn: ['cancelled', 'delivered'] },
      },
    });

    if (existing) {
      throw new BusinessError(
        'BUSINESS_INSTANCE_ALREADY_EXISTS',
        'An active service instance already exists for this request',
        422,
        { existingInstanceId: existing.id },
      );
    }

    const instance = await this.prisma.serviceInstance.create({
      data: {
        customerId: payload.customerId,
        serviceDefinitionId: payload.serviceDefinitionId,
        cityId: payload.cityId,
        state: 'requested',
        currentStepIndex: -1,
        metadata: { ...(payload.metadata || {}), createdBy: payload.createdBy } as any,
      },
    });

    // Create initial history entry
    await this.prisma.serviceStateHistory.create({
      data: {
        serviceInstanceId: instance.id,
        fromState: 'none',
        toState: 'requested',
        changedBy: payload.createdBy,
        reason: 'Service instance created',
      },
    });

    // Schedule SLA timer
    const def = definition.definition as any;
    if (def.slaBusinessDays) {
      await this.boss.send(
        'sla.check',
        {
          serviceInstanceId: instance.id,
          slaBusinessDays: def.slaBusinessDays,
          startedAt: new Date().toISOString(),
        },
        { singletonKey: `sla-check-${instance.id}` },
      );
    }

    // Write to Firestore for real-time tracking
    await this.boss.send(
      'firestore.write',
      {
        collection: 'service_events',
        documentId: instance.id,
        data: {
          serviceInstanceId: instance.id,
          customerId: payload.customerId,
          currentStatus: 'requested',
          currentStep: null,
          stepProgress: 0,
          totalSteps: def.steps?.length || 0,
          lastUpdatedAt: new Date().toISOString(),
        },
      },
      { singletonKey: `firestore-write-${instance.id}-requested` },
    );

    return instance;
  }

  /**
   * Get service instance with full state info.
   */
  async getInstance(instanceId: string) {
    const state = await this.engine.getState(instanceId);
    if (!state) {
      throw new BusinessError(
        'BUSINESS_INSTANCE_NOT_FOUND',
        'Service instance not found',
        404,
      );
    }

    const instance = await this.prisma.serviceInstance.findUnique({
      where: { id: instanceId },
      include: {
        serviceDefinition: true,
      },
    });

    return { ...instance, stateInfo: state };
  }

  /**
   * Transition a service instance to a new state.
   */
  async transitionState(
    instanceId: string,
    newState: string,
    changedBy: string,
    reason?: string,
    metadata?: Record<string, unknown>,
  ) {
    const result = await this.engine.transition({
      serviceInstanceId: instanceId,
      newState,
      changedBy,
      reason,
      metadata,
    });

    if (!result.success) {
      throw new BusinessError(
        'BUSINESS_INVALID_TRANSITION',
        result.error || 'Invalid state transition',
        422,
        { from: result.fromState, to: result.toState },
      );
    }

    // Get updated instance for Firestore event
    const instance = await this.prisma.serviceInstance.findUnique({
      where: { id: instanceId },
      include: { serviceDefinition: true },
    });

    if (instance) {
      const def = instance.serviceDefinition.definition as any;
      await this.boss.send(
        'firestore.write',
        {
          collection: 'service_events',
          documentId: instance.id,
          data: {
            serviceInstanceId: instanceId,
            currentStatus: newState,
            currentStep: def.steps?.[instance.currentStepIndex]?.name || null,
            stepProgress: instance.currentStepIndex + 1,
            totalSteps: def.steps?.length || 0,
            lastUpdatedAt: new Date().toISOString(),
            lastUpdatedBy: changedBy,
          },
          // Use arrayUnion to append to events array instead of overwriting
          arrayUnionFields: {
            events: {
              type: 'state_transition',
              from: result.fromState,
              to: result.toState,
              timestamp: new Date().toISOString(),
              changedBy,
            },
          },
        },
        { singletonKey: `firestore-write-${instanceId}-${newState}` },
      );
    }

    // Notify stakeholders
    await this.boss.send('notification.send', {
      type: 'service_state_change',
      serviceInstanceId: instanceId,
      fromState: result.fromState,
      toState: result.toState,
    });

    return result;
  }

  /**
   * Get transition history.
   */
  async getHistory(instanceId: string) {
    return this.engine.getHistory(instanceId);
  }

  /**
   * Get all instances for a city with optional status filter.
   */
  async getInstancesByCityId(
    cityId: string,
    status?: string,
    pagination?: { cursor?: string; limit?: number },
  ) {
    const parsed = parsePagination({
      cursor: pagination?.cursor,
      limit: String(pagination?.limit || 20),
    });
    const cursor = parsed.cursor;
    const limit = parsed.limit ?? 20;

    const where: any = { cityId };
    if (status) where.state = status;

    const instances = await this.prisma.serviceInstance.findMany({
      where,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        serviceDefinition: { select: { code: true, name: true } },
      },
    });

    return buildPaginatedResponse(instances, limit);
  }
}
