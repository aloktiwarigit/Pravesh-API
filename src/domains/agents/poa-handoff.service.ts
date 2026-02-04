// Story 13-8: POA-Linked Service Workflow Handoff Service
//
// NOTE: The code references a Prisma model (serviceRequest) that does not
// yet exist in the schema. Prisma calls are cast through `any` to unblock
// the build until the schema is updated.

import { PrismaClient } from '@prisma/client';
import PgBoss from 'pg-boss';

// Helper to access prisma models that may not yet exist in the generated client
const db = (prisma: PrismaClient) => prisma as any;

export class PoaHandoffService {
  constructor(
    private prisma: PrismaClient,
    private boss: any // PgBoss instance - namespace import cannot be used as type
  ) {}

  async getServiceWithPoaDetails(serviceRequestId: string) {
    // TODO: serviceRequest model does not exist in schema yet
    const sr = await db(this.prisma).serviceRequest.findUniqueOrThrow({
      where: { id: serviceRequestId },
    });

    return {
      ...sr,
      poaInfo: (sr as any).hasVerifiedPoa
        ? {
            attorneyName: (sr as any).authorizedAttorneyName,
            attorneyPhone: (sr as any).authorizedAttorneyPhone,
            attorneyWhatsapp: (sr as any).attorneyWhatsapp,
            poaDocumentId: (sr as any).poaDocumentId,
          }
        : null,
    };
  }

  async notifyAttorney(params: {
    serviceRequestId: string;
    message: string;
    actionRequired: string;
  }) {
    const sr = await db(this.prisma).serviceRequest.findUniqueOrThrow({
      where: { id: params.serviceRequestId },
    });

    const attorneyPhone = (sr as any).authorizedAttorneyPhone;
    if (!attorneyPhone) {
      throw new Error('No attorney phone on record');
    }

    await this.boss.send('notification.send', {
      type: 'attorney_action_required',
      phone: attorneyPhone,
      channel: 'whatsapp',
      data: {
        message: params.message,
        actionRequired: params.actionRequired,
        serviceRequestId: params.serviceRequestId,
      },
    } as any);
  }

  async notifyNriCustomerMilestone(params: {
    serviceRequestId: string;
    milestone: string;
    description: string;
  }) {
    const sr = await db(this.prisma).serviceRequest.findUniqueOrThrow({
      where: { id: params.serviceRequestId },
    });

    await this.boss.send('notification.send', {
      type: 'nri_milestone_update',
      userId: (sr as any).customerId,
      channel: 'whatsapp',
      data: {
        milestone: params.milestone,
        description: params.description,
      },
    } as any);
  }

  async flagPoaIssue(params: {
    serviceRequestId: string;
    issueType: 'unresponsive_attorney' | 'insufficient_scope';
    notes: string;
    agentId: string;
  }) {
    await db(this.prisma).serviceRequest.update({
      where: { id: params.serviceRequestId },
      data: {
        attorneyUnresponsiveFlag:
          params.issueType === 'unresponsive_attorney',
        poaScopeIssueFlag:
          params.issueType === 'insufficient_scope',
      },
    });

    // Notify Ops for coordination
    await this.boss.send('notification.send', {
      type: 'poa_issue_flagged',
      serviceRequestId: params.serviceRequestId,
      issueType: params.issueType,
      notes: params.notes,
      agentId: params.agentId,
    } as any);
  }
}
