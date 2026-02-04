// Story 3-17: Dispute Flagging Service
// Agents flag issues during field operations (document discrepancies,
// customer disputes, property boundary issues, etc.).
//
// NOTE: The code references Prisma models (dispute, disputeComment) that do
// not yet exist in the schema. Prisma calls are cast through `any` to unblock
// the build until the schema is updated.

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

// Helper to access prisma models that may not yet exist in the generated client
const db = (prisma: PrismaClient) => prisma as any;

export class DisputeService {
  constructor(
    private prisma: PrismaClient,
    private boss: any, // PgBoss instance - namespace import cannot be used as type
  ) {}

  /**
   * Create a dispute flag.
   */
  async createDispute(payload: CreateDisputePayload) {
    // TODO: dispute model does not exist in schema yet
    const dispute = await db(this.prisma).dispute.create({
      data: {
        taskId: payload.taskId,
        serviceRequestId: payload.serviceRequestId,
        raisedBy: payload.agentId,
        cityId: payload.cityId,
        category: payload.category,
        severity: payload.severity,
        title: payload.title,
        description: payload.description,
        gpsLat: payload.gpsLat,
        gpsLng: payload.gpsLng,
        photoUrls: payload.photoUrls || [],
        documentIds: payload.documentIds || [],
        status: 'open',
      },
    });

    // Auto-escalate critical disputes
    if (payload.severity === 'critical') {
      await db(this.prisma).dispute.update({
        where: { id: dispute.id },
        data: { status: 'escalated', escalatedAt: new Date() },
      });

      await this.boss.send('notification.send', {
        type: 'dispute_critical_escalation',
        disputeId: dispute.id,
        serviceRequestId: payload.serviceRequestId,
        cityId: payload.cityId,
        severity: 'critical',
      } as any);
    } else {
      // Notify Ops of new dispute
      await this.boss.send('notification.send', {
        type: 'dispute_flagged',
        disputeId: dispute.id,
        serviceRequestId: payload.serviceRequestId,
        category: payload.category,
        severity: payload.severity,
      } as any);
    }

    return dispute;
  }

  /**
   * Get disputes for an agent.
   */
  async getAgentDisputes(agentId: string, status?: DisputeStatus) {
    const where: any = { raisedBy: agentId };
    if (status) where.status = status;

    return db(this.prisma).dispute.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get disputes for a service request (Ops view).
   */
  async getServiceDisputes(serviceRequestId: string) {
    return db(this.prisma).dispute.findMany({
      where: { serviceRequestId },
      orderBy: { createdAt: 'desc' },
      include: {
        agent: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Get a single dispute by ID.
   */
  async getDisputeById(disputeId: string) {
    const dispute = await db(this.prisma).dispute.findUnique({
      where: { id: disputeId },
      include: {
        agent: { select: { id: true, name: true, phone: true } },
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
    const dispute = await db(this.prisma).dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new BusinessError(
        'BUSINESS_DISPUTE_NOT_FOUND',
        'Dispute not found',
        404,
      );
    }

    // TODO: disputeComment model does not exist in schema yet
    return db(this.prisma).disputeComment.create({
      data: {
        disputeId,
        authorId,
        authorRole,
        content,
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
    const dispute = await db(this.prisma).dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      throw new BusinessError(
        'BUSINESS_DISPUTE_NOT_FOUND',
        'Dispute not found',
        404,
      );
    }

    const updated = await db(this.prisma).dispute.update({
      where: { id: disputeId },
      data: {
        status: newStatus,
        ...(newStatus === 'escalated' ? { escalatedAt: new Date() } : {}),
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
      agentId: dispute.raisedBy,
    } as any);

    return updated;
  }

  /**
   * Resolve or dismiss a dispute.
   */
  async resolveDispute(payload: ResolveDisputePayload) {
    const dispute = await db(this.prisma).dispute.findUnique({
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

    const updated = await db(this.prisma).dispute.update({
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
      agentId: dispute.raisedBy,
      resolution: payload.resolution,
    } as any);

    return updated;
  }
}
