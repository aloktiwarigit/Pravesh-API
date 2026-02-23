// Story 3-17: Dispute Flagging Service
// Agents flag issues during field operations (document discrepancies,
// customer disputes, property boundary issues, etc.).

import { PrismaClient } from '@prisma/client';
import PgBoss from 'pg-boss';
import { BusinessError } from '../../shared/errors/business-error.js';

export type DisputeCategory =
  | 'document_discrepancy'
  | 'boundary_dispute'
  | 'ownership_conflict'
  | 'customer_uncooperative'
  | 'government_office_issue'
  | 'payment_dispute'
  | 'other';

export type DisputeSeverity = 'low' | 'medium' | 'high' | 'critical';

export type DisputeStatus =
  | 'open'
  | 'under_review'
  | 'escalated'
  | 'resolved'
  | 'dismissed';

export interface CreateDisputePayload {
  taskId: string;
  serviceRequestId: string;
  agentId: string;
  cityId: string;
  category: DisputeCategory;
  severity: DisputeSeverity;
  title: string;
  description: string;
  gpsLat?: number;
  gpsLng?: number;
  photoUrls?: string[];
  documentIds?: string[];
}

export interface ResolveDisputePayload {
  disputeId: string;
  resolvedBy: string;
  resolution: string;
  newStatus: 'resolved' | 'dismissed';
}

export class DisputeService {
  constructor(
    private prisma: PrismaClient,
    private boss: any, // PgBoss instance - namespace import cannot be used as type
  ) {}

  /**
   * Create a dispute flag.
   */
  async createDispute(payload: CreateDisputePayload) {
    const dispute = await this.prisma.dispute.create({
      data: {
        serviceRequestId: payload.serviceRequestId,
        agentId: payload.agentId,
        cityId: payload.cityId,
        category: payload.category,
        severity: payload.severity,
        description: payload.description,
        status: 'open',
        metadata: {
          taskId: payload.taskId,
          title: payload.title,
          gpsLat: payload.gpsLat,
          gpsLng: payload.gpsLng,
          photoUrls: payload.photoUrls || [],
          documentIds: payload.documentIds || [],
        },
      },
    });

    // Auto-escalate critical disputes
    if (payload.severity === 'critical') {
      await this.prisma.dispute.update({
        where: { id: dispute.id },
        data: {
          status: 'investigating',
          metadata: {
            ...(dispute.metadata as Record<string, unknown> ?? {}),
            escalatedAt: new Date().toISOString(),
          },
        },
      });

      await this.boss.send('notification.send', {
        type: 'dispute_critical_escalation',
        disputeId: dispute.id,
        serviceRequestId: payload.serviceRequestId,
        cityId: payload.cityId,
        severity: 'critical',
      } as Record<string, unknown>);
    } else {
      // Notify Ops of new dispute
      await this.boss.send('notification.send', {
        type: 'dispute_flagged',
        disputeId: dispute.id,
        serviceRequestId: payload.serviceRequestId,
        category: payload.category,
        severity: payload.severity,
      } as Record<string, unknown>);
    }

    return dispute;
  }

  /**
   * Get disputes for an agent.
   */
  async getAgentDisputes(agentId: string, status?: DisputeStatus) {
    const where: Record<string, unknown> = { agentId };
    if (status) where.status = status;

    return this.prisma.dispute.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get disputes for a service request (Ops view).
   */
  async getServiceDisputes(serviceRequestId: string) {
    return this.prisma.dispute.findMany({
      where: { serviceRequestId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get a single dispute by ID.
   */
  async getDisputeById(disputeId: string) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
      include: {
        comments: { orderBy: { createdAt: 'asc' } },
      },
    });

    if (!dispute) {
      throw new BusinessError(
        'BUSINESS_DISPUTE_NOT_FOUND',
        'Dispute not found',
        404,
      );
    }

    return dispute;
  }

  /**
   * Add a comment to a dispute.
   */
  async addComment(
    disputeId: string,
    authorId: string,
    authorRole: string,
    content: string,
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new BusinessError(
        'BUSINESS_DISPUTE_NOT_FOUND',
        'Dispute not found',
        404,
      );
    }

    return this.prisma.disputeComment.create({
      data: {
        disputeId,
        authorId,
        body: content,
      },
    });
  }

  /**
   * Update dispute status (Ops: escalate, under_review).
   */
  async updateStatus(
    disputeId: string,
    newStatus: DisputeStatus,
    updatedBy: string,
  ) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new BusinessError(
        'BUSINESS_DISPUTE_NOT_FOUND',
        'Dispute not found',
        404,
      );
    }

    const updated = await this.prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: newStatus,
        ...(newStatus === 'resolved' || newStatus === 'dismissed'
          ? { resolvedAt: new Date(), resolvedBy: updatedBy }
          : {}),
      },
    });

    // Notify agent of status change
    await this.boss.send('notification.send', {
      type: 'dispute_status_update',
      disputeId,
      newStatus,
      agentId: dispute.agentId,
    } as Record<string, unknown>);

    return updated;
  }

  /**
   * Resolve or dismiss a dispute.
   */
  async resolveDispute(payload: ResolveDisputePayload) {
    const dispute = await this.prisma.dispute.findUnique({
      where: { id: payload.disputeId },
    });

    if (!dispute) {
      throw new BusinessError(
        'BUSINESS_DISPUTE_NOT_FOUND',
        'Dispute not found',
        404,
      );
    }

    if (dispute.status === 'resolved' || dispute.status === 'dismissed') {
      throw new BusinessError(
        'BUSINESS_DISPUTE_ALREADY_CLOSED',
        'Dispute is already closed',
        422,
      );
    }

    const updated = await this.prisma.dispute.update({
      where: { id: payload.disputeId },
      data: {
        status: payload.newStatus,
        resolution: payload.resolution,
        resolvedBy: payload.resolvedBy,
        resolvedAt: new Date(),
      },
    });

    await this.boss.send('notification.send', {
      type: 'dispute_resolved',
      disputeId: payload.disputeId,
      agentId: dispute.agentId,
      resolution: payload.resolution,
    } as Record<string, unknown>);

    return updated;
  }
}
