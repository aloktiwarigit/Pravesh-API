// Story 13-8: POA-Linked Service Workflow Handoff Service

import { PrismaClient } from '@prisma/client';
import PgBoss from 'pg-boss';

export class PoaHandoffService {
  constructor(
    private prisma: PrismaClient,
    private boss: any // PgBoss instance - namespace import cannot be used as type
  ) {}

  async getServiceWithPoaDetails(serviceRequestId: string) {
    const sr = await this.prisma.serviceRequest.findUniqueOrThrow({
      where: { id: serviceRequestId },
    });

    return {
      ...sr,
      poaInfo: sr.hasVerifiedPoa
        ? {
            attorneyName: sr.authorizedAttorneyName,
            attorneyPhone: sr.authorizedAttorneyPhone,
            attorneyWhatsapp: sr.attorneyWhatsapp,
            poaDocumentId: sr.poaDocumentId,
          }
        : null,
    };
  }

  async notifyAttorney(params: {
    serviceRequestId: string;
    message: string;
    actionRequired: string;
  }) {
    const sr = await this.prisma.serviceRequest.findUniqueOrThrow({
      where: { id: params.serviceRequestId },
    });

    const attorneyPhone = sr.authorizedAttorneyPhone;
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
    } as Record<string, unknown>);
  }

  async notifyNriCustomerMilestone(params: {
    serviceRequestId: string;
    milestone: string;
    description: string;
  }) {
    const sr = await this.prisma.serviceRequest.findUniqueOrThrow({
      where: { id: params.serviceRequestId },
    });

    await this.boss.send('notification.send', {
      type: 'nri_milestone_update',
      userId: sr.customerId,
      channel: 'whatsapp',
      data: {
        milestone: params.milestone,
        description: params.description,
      },
    } as Record<string, unknown>);
  }

  async flagPoaIssue(params: {
    serviceRequestId: string;
    issueType: 'unresponsive_attorney' | 'insufficient_scope';
    notes: string;
    agentId: string;
  }) {
    // Store POA issue flags in metadata since these are rare edge-case flags
    const sr = await this.prisma.serviceRequest.findUniqueOrThrow({
      where: { id: params.serviceRequestId },
    });

    const existingMetadata = (sr.metadata as Record<string, unknown>) ?? {};
    await this.prisma.serviceRequest.update({
      where: { id: params.serviceRequestId },
      data: {
        metadata: {
          ...existingMetadata,
          attorneyUnresponsiveFlag: params.issueType === 'unresponsive_attorney',
          poaScopeIssueFlag: params.issueType === 'insufficient_scope',
          poaIssueNotes: params.notes,
          poaIssueFlaggedBy: params.agentId,
          poaIssueFlaggedAt: new Date().toISOString(),
        },
      },
    });

    // Notify Ops for coordination
    await this.boss.send('notification.send', {
      type: 'poa_issue_flagged',
      serviceRequestId: params.serviceRequestId,
      issueType: params.issueType,
      notes: params.notes,
      agentId: params.agentId,
    } as Record<string, unknown>);
  }
}
