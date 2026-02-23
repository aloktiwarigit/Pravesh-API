// Stories 3-3, 3-7, 3-12: Agent Task Service
// Task lifecycle management, status updates, GPS evidence, offline sync.
// Uses ServiceRequest as the "task" (no separate Task model).

import { PrismaClient } from '@prisma/client';
import PgBoss from 'pg-boss';
import { BusinessError } from '../../shared/errors/business-error.js';
import {
  parsePagination,
  buildPaginatedResponse,
  type PaginationParams,
} from '../../shared/utils/pagination.js';

export type TaskStatus =
  | 'pending_contact'
  | 'contacted'
  | 'scope_confirmed'
  | 'awaiting_payment'
  | 'in_progress'
  | 'completed';

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending_contact: ['contacted'],
  contacted: ['scope_confirmed'],
  scope_confirmed: ['awaiting_payment'],
  awaiting_payment: ['in_progress'],
  in_progress: ['completed'],
  completed: [],
};

export interface TaskUpdatePayload {
  taskId: string;
  agentId: string;
  newStatus: TaskStatus;
  gpsLat?: number;
  gpsLng?: number;
  notes?: string;
  photos?: string[];
  idempotencyKey?: string;
}

export interface GpsEvidenceInput {
  taskId: string;
  agentId: string;
  lat: number;
  lng: number;
  accuracy: number;
  capturedAt: string;
  photoUrl?: string;
}

export interface SyncBatchItem {
  idempotencyKey: string;
  type: 'task_update' | 'gps_evidence' | 'cash_receipt';
  payload: Record<string, unknown>;
  clientTimestamp: string;
}

export class AgentTaskService {
  constructor(
    private prisma: PrismaClient,
    private boss: any, // PgBoss instance - namespace import cannot be used as type
  ) {}

  /**
   * Get tasks (service requests) for an agent with cursor-based pagination.
   */
  async getAgentTasks(
    agentId: string,
    cityId: string,
    status?: string,
    pagination?: PaginationParams,
  ) {
    const { cursor, limit } = parsePagination({
      cursor: pagination?.cursor,
      limit: String(pagination?.limit || 20),
    });

    const where: Record<string, unknown> = { assignedAgentId: agentId, cityId };
    if (status) {
      where.status = status;
    }

    const tasks = await this.prisma.serviceRequest.findMany({
      where,
      take: (limit ?? 20) + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        serviceName: true,
        customerName: true,
        customerPhone: true,
        propertyAddress: true,
        createdAt: true,
        updatedAt: true,
        serviceInstance: {
          select: {
            id: true,
            propertyLat: true,
            propertyLng: true,
          },
        },
      },
    });

    return buildPaginatedResponse(tasks, limit ?? 20);
  }

  /**
   * Get a single task (service request) by ID with full details.
   */
  async getTaskById(taskId: string, agentId: string) {
    const task = await this.prisma.serviceRequest.findFirst({
      where: { id: taskId, assignedAgentId: agentId },
      include: {
        serviceInstance: true,
        gpsEvidence: { orderBy: { capturedAt: 'desc' }, take: 10 },
        checklists: true,
      },
    });

    if (!task) {
      throw new BusinessError(
        'BUSINESS_TASK_NOT_FOUND',
        'Task not found or not assigned to this agent',
        404,
        { taskId },
      );
    }

    return task;
  }

  /**
   * Update task status with GPS and validation.
   */
  async updateTaskStatus(payload: TaskUpdatePayload) {
    // Idempotency check
    if (payload.idempotencyKey) {
      const existing = await this.prisma.serviceRequestStatusLog.findFirst({
        where: {
          metadata: {
            path: ['idempotencyKey'],
            equals: payload.idempotencyKey,
          },
        },
      });
      if (existing) {
        return { alreadyProcessed: true, taskId: payload.taskId };
      }
    }

    const task = await this.prisma.serviceRequest.findFirst({
      where: { id: payload.taskId, assignedAgentId: payload.agentId },
    });

    if (!task) {
      throw new BusinessError(
        'BUSINESS_TASK_NOT_FOUND',
        'Task not found or not assigned to this agent',
        404,
      );
    }

    // Validate transition
    const valid = VALID_TRANSITIONS[task.status] || [];
    if (!valid.includes(payload.newStatus)) {
      throw new BusinessError(
        'BUSINESS_INVALID_TASK_TRANSITION',
        `Cannot transition from '${task.status}' to '${payload.newStatus}'`,
        422,
        { current: task.status, requested: payload.newStatus, valid },
      );
    }

    const [updatedTask, statusLog] = await this.prisma.$transaction([
      this.prisma.serviceRequest.update({
        where: { id: payload.taskId },
        data: {
          status: payload.newStatus,
        },
      }),
      this.prisma.serviceRequestStatusLog.create({
        data: {
          serviceRequestId: payload.taskId,
          fromStatus: task.status,
          toStatus: payload.newStatus,
          changedBy: payload.agentId,
          reason: payload.notes,
          metadata: {
            gpsLat: payload.gpsLat,
            gpsLng: payload.gpsLng,
            idempotencyKey: payload.idempotencyKey,
          },
        },
      }),
    ]);

    // Record GPS evidence if provided
    if (payload.gpsLat && payload.gpsLng) {
      await this.prisma.gpsEvidence.create({
        data: {
          serviceRequestId: payload.taskId,
          agentId: payload.agentId,
          latitude: payload.gpsLat,
          longitude: payload.gpsLng,
          photoUrls: payload.photos || [],
          capturedAt: new Date(),
        },
      });
    }

    // Notify Ops + Customer of status change
    await this.boss.send('notification.send', {
      type: 'task_status_update',
      taskId: payload.taskId,
      serviceRequestId: task.serviceInstanceId,
      newStatus: payload.newStatus,
    } as Record<string, unknown>);

    return { alreadyProcessed: false, task: updatedTask, statusLog };
  }

  /**
   * Record GPS evidence for a task.
   */
  async recordGpsEvidence(evidence: GpsEvidenceInput) {
    return this.prisma.gpsEvidence.create({
      data: {
        serviceRequestId: evidence.taskId,
        agentId: evidence.agentId,
        latitude: evidence.lat,
        longitude: evidence.lng,
        accuracy: evidence.accuracy,
        capturedAt: new Date(evidence.capturedAt),
        photoUrls: evidence.photoUrl ? [evidence.photoUrl] : [],
      },
    });
  }

  /**
   * Process a batch of offline sync items (idempotent).
   * Priority: cash_receipt > task_update > gps_evidence
   */
  async processSyncBatch(agentId: string, items: SyncBatchItem[]) {
    // Sort by priority
    const priorityOrder: Record<string, number> = { cash_receipt: 1, task_update: 2, gps_evidence: 3 };
    const sorted = [...items].sort(
      (a, b) => (priorityOrder[a.type] || 99) - (priorityOrder[b.type] || 99),
    );

    const results: Array<{
      idempotencyKey: string;
      success: boolean;
      error?: string;
    }> = [];

    for (const item of sorted) {
      try {
        // Check idempotency via status log metadata
        const existing = await this.prisma.serviceRequestStatusLog.findFirst({
          where: {
            metadata: {
              path: ['idempotencyKey'],
              equals: item.idempotencyKey,
            },
          },
        });

        if (existing) {
          results.push({
            idempotencyKey: item.idempotencyKey,
            success: true,
            error: 'already_processed',
          });
          continue;
        }

        // Process based on type
        switch (item.type) {
          case 'task_update':
            await this.updateTaskStatus({
              ...(item.payload as any),
              agentId,
              idempotencyKey: item.idempotencyKey,
            });
            break;
          case 'gps_evidence':
            await this.recordGpsEvidence({
              ...(item.payload as any),
              agentId,
            });
            break;
          case 'cash_receipt':
            // Delegated to cash-collection service
            break;
        }

        results.push({ idempotencyKey: item.idempotencyKey, success: true });
      } catch (error: any) {
        results.push({
          idempotencyKey: item.idempotencyKey,
          success: false,
          error: error.message,
        });
      }
    }

    return { processed: results.length, results };
  }

  /**
   * Get tasks modified after a timestamp (for offline sync pull).
   */
  async getTasksSince(agentId: string, since: Date) {
    return this.prisma.serviceRequest.findMany({
      where: {
        assignedAgentId: agentId,
        updatedAt: { gte: since },
      },
      select: {
        id: true,
        status: true,
        serviceName: true,
        customerName: true,
        customerPhone: true,
        propertyAddress: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'asc' },
    });
  }
}
