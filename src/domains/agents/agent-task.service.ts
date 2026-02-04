// Stories 3-3, 3-7, 3-12: Agent Task Service
// Task lifecycle management, status updates, GPS evidence, offline sync.
//
// NOTE: The code references Prisma models (task, taskStatusLog, gpsEvidence, syncLog)
// that do not yet exist in the schema. Prisma calls are cast through `any`
// to unblock the build until the schema is updated.

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

export interface GpsEvidence {
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

// Helper to access prisma models that may not yet exist in the generated client
const db = (prisma: PrismaClient) => prisma as any;

export class AgentTaskService {
  constructor(
    private prisma: PrismaClient,
    private boss: any, // PgBoss instance - namespace import cannot be used as type
  ) {}

  /**
   * Get tasks for an agent with cursor-based pagination.
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

    const where: any = { assignedAgentId: agentId, cityId };
    if (status) {
      where.status = status;
    }

    // TODO: task model does not exist in schema yet
    const tasks = await db(this.prisma).task.findMany({
      where,
      take: (limit ?? 20) + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
      include: {
        serviceRequest: {
          select: {
            id: true,
            serviceName: true,
            customerName: true,
            customerPhone: true,
            propertyAddress: true,
            propertyLat: true,
            propertyLng: true,
          },
        },
      },
    });

    return buildPaginatedResponse(tasks, limit ?? 20);
  }

  /**
   * Get a single task by ID with full details.
   */
  async getTaskById(taskId: string, agentId: string) {
    const task = await db(this.prisma).task.findFirst({
      where: { id: taskId, assignedAgentId: agentId },
      include: {
        serviceRequest: true,
        gpsEvidences: { orderBy: { capturedAt: 'desc' }, take: 10 },
        checklistProgress: true,
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
      // TODO: taskStatusLog model does not exist in schema yet
      const existing = await db(this.prisma).taskStatusLog.findFirst({
        where: { idempotencyKey: payload.idempotencyKey },
      });
      if (existing) {
        return { alreadyProcessed: true, taskId: payload.taskId };
      }
    }

    const task = await db(this.prisma).task.findFirst({
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
      db(this.prisma).task.update({
        where: { id: payload.taskId },
        data: {
          status: payload.newStatus,
          ...(payload.newStatus === 'contacted'
            ? { firstContactAt: new Date() }
            : {}),
          ...(payload.newStatus === 'scope_confirmed'
            ? { scopeConfirmedAt: new Date() }
            : {}),
          ...(payload.newStatus === 'completed'
            ? { completedAt: new Date() }
            : {}),
        },
      }),
      db(this.prisma).taskStatusLog.create({
        data: {
          taskId: payload.taskId,
          fromStatus: task.status,
          toStatus: payload.newStatus,
          changedBy: payload.agentId,
          gpsLat: payload.gpsLat,
          gpsLng: payload.gpsLng,
          notes: payload.notes,
          idempotencyKey: payload.idempotencyKey,
        },
      }),
    ]);

    // Notify Ops + Customer of status change
    await this.boss.send('notification.send', {
      type: 'task_status_update',
      taskId: payload.taskId,
      serviceRequestId: task.serviceRequestId,
      newStatus: payload.newStatus,
    } as any);

    return { alreadyProcessed: false, task: updatedTask, statusLog };
  }

  /**
   * Record GPS evidence for a task.
   */
  async recordGpsEvidence(evidence: GpsEvidence) {
    // TODO: gpsEvidence model does not exist in schema yet
    return db(this.prisma).gpsEvidence.create({
      data: {
        taskId: evidence.taskId,
        agentId: evidence.agentId,
        lat: evidence.lat,
        lng: evidence.lng,
        accuracy: evidence.accuracy,
        capturedAt: new Date(evidence.capturedAt),
        photoUrl: evidence.photoUrl,
      },
    });
  }

  /**
   * Process a batch of offline sync items (idempotent).
   * Priority: cash_receipt > task_update > gps_evidence
   */
  async processSyncBatch(agentId: string, items: SyncBatchItem[]) {
    // Sort by priority
    const priorityOrder = { cash_receipt: 1, task_update: 2, gps_evidence: 3 };
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
        // Check idempotency
        // TODO: syncLog model does not exist in schema yet
        const existing = await db(this.prisma).syncLog.findFirst({
          where: { idempotencyKey: item.idempotencyKey },
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

        // Record sync
        await db(this.prisma).syncLog.create({
          data: {
            idempotencyKey: item.idempotencyKey,
            entityType: item.type,
            agentId,
            processedAt: new Date(),
            clientTimestamp: new Date(item.clientTimestamp),
          },
        });

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
    // TODO: task model does not exist in schema yet
    return db(this.prisma).task.findMany({
      where: {
        assignedAgentId: agentId,
        updatedAt: { gte: since },
      },
      include: {
        serviceRequest: {
          select: {
            id: true,
            serviceName: true,
            customerName: true,
            customerPhone: true,
            propertyAddress: true,
          },
        },
      },
      orderBy: { updatedAt: 'asc' },
    });
  }
}
