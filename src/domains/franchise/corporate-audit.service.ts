import { PrismaClient } from '@prisma/client';
import { auditChecklistItemSchema, correctiveActionSchema, AuditStatus } from './franchise.types';
import { BusinessError } from '../../shared/errors/business-error';
import * as ErrorCodes from '../../shared/errors/error-codes';
import { z } from 'zod';

/**
 * Story 14-16: Corporate Audit Workflow for Franchises
 *
 * Full audit lifecycle: scheduled -> in_progress -> findings_shared ->
 * corrective_actions -> closed
 * Supports recurring audits (quarterly/annual).
 * Confidential: only Super Admin and audited Franchise Owner can view.
 */
export class CorporateAuditService {
  constructor(private prisma: PrismaClient) {}

  private static VALID_TRANSITIONS: Record<string, string[]> = {
    scheduled: ['in_progress', 'closed'],
    in_progress: ['findings_shared'],
    findings_shared: ['corrective_actions', 'closed'],
    corrective_actions: ['closed'],
    closed: [],
  };

  /**
   * Create an audit
   */
  async createAudit(params: {
    franchiseId: string;
    cityId: string;
    auditType: 'financial' | 'operational' | 'quality';
    scheduledDate: string;
    auditorName: string;
    isRecurring: boolean;
    recurringSchedule?: 'quarterly' | 'annual';
    createdBy: string;
  }) {
    // Verify franchise exists
    const franchise = await this.prisma.franchise.findUnique({
      where: { id: params.franchiseId },
    });

    if (!franchise) {
      throw new BusinessError(
        ErrorCodes.BUSINESS_FRANCHISE_NOT_FOUND,
        'Franchise not found',
        404
      );
    }

    // Default checklist based on audit type
    const defaultChecklist = this.getDefaultChecklist(params.auditType);

    return this.prisma.corporateAudit.create({
      data: {
        franchiseId: params.franchiseId,
        cityId: params.cityId,
        auditType: params.auditType,
        scheduledDate: new Date(params.scheduledDate),
        auditorName: params.auditorName,
        checklist: defaultChecklist as any,
        isRecurring: params.isRecurring,
        recurringSchedule: params.recurringSchedule,
        createdBy: params.createdBy,
        status: 'scheduled',
      },
    });
  }

  /**
   * Update audit status with validation
   */
  async updateStatus(auditId: string, newStatus: AuditStatus) {
    const audit = await this.prisma.corporateAudit.findUnique({
      where: { id: auditId },
    });

    if (!audit) {
      throw new BusinessError(ErrorCodes.BUSINESS_AUDIT_INVALID_STATUS, 'Audit not found', 404);
    }

    const validTransitions = CorporateAuditService.VALID_TRANSITIONS[audit.status];
    if (!validTransitions?.includes(newStatus)) {
      throw new BusinessError(
        ErrorCodes.BUSINESS_AUDIT_INVALID_STATUS,
        `Cannot transition from "${audit.status}" to "${newStatus}"`,
        422
      );
    }

    const updateData: any = { status: newStatus };
    if (newStatus === 'closed') {
      updateData.closedAt = new Date();
    }

    const updated = await this.prisma.corporateAudit.update({
      where: { id: auditId },
      data: updateData,
    });

    // If recurring and closed, schedule next audit
    if (newStatus === 'closed' && audit.isRecurring && audit.recurringSchedule) {
      await this.scheduleNextRecurringAudit(audit);
    }

    return updated;
  }

  /**
   * Upload audit findings
   */
  async uploadFindings(auditId: string, params: {
    findings: Record<string, any>[];
    findingsReportUrl: string;
  }) {
    return this.prisma.corporateAudit.update({
      where: { id: auditId },
      data: {
        findings: params.findings as any,
        findingsReportUrl: params.findingsReportUrl,
        status: 'findings_shared',
      },
    });
  }

  /**
   * Franchise owner responds to findings
   */
  async respondToFindings(auditId: string, response: string) {
    return this.prisma.corporateAudit.update({
      where: { id: auditId },
      data: { franchiseResponse: response },
    });
  }

  /**
   * Set corrective actions
   */
  async setCorrectiveActions(auditId: string, actions: z.infer<typeof correctiveActionSchema>[]) {
    z.array(correctiveActionSchema).parse(actions);

    return this.prisma.corporateAudit.update({
      where: { id: auditId },
      data: {
        correctiveActions: actions as any,
        status: 'corrective_actions',
      },
    });
  }

  /**
   * Update checklist items
   */
  async updateChecklist(auditId: string, checklist: z.infer<typeof auditChecklistItemSchema>[]) {
    z.array(auditChecklistItemSchema).parse(checklist);

    return this.prisma.corporateAudit.update({
      where: { id: auditId },
      data: { checklist: checklist as any },
    });
  }

  /**
   * Get audit details (only Super Admin or the audited Franchise Owner)
   */
  async getAudit(auditId: string) {
    const audit = await this.prisma.corporateAudit.findUnique({
      where: { id: auditId },
      include: {
        franchise: { select: { ownerName: true, ownerUserId: true } },
        city: { select: { cityName: true, state: true } },
      },
    });

    if (!audit) {
      throw new BusinessError(ErrorCodes.BUSINESS_AUDIT_INVALID_STATUS, 'Audit not found', 404);
    }

    return audit;
  }

  /**
   * List audits for a franchise
   */
  async listAuditsForFranchise(franchiseId: string) {
    return this.prisma.corporateAudit.findMany({
      where: { franchiseId },
      include: { city: { select: { cityName: true } } },
      orderBy: { scheduledDate: 'desc' },
    });
  }

  /**
   * List all audits (Super Admin)
   */
  async listAllAudits(filters?: { status?: string; cityId?: string }) {
    return this.prisma.corporateAudit.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.cityId && { cityId: filters.cityId }),
      },
      include: {
        franchise: { select: { ownerName: true } },
        city: { select: { cityName: true } },
      },
      orderBy: { scheduledDate: 'desc' },
    });
  }

  /**
   * Get audit history summary for a franchise
   */
  async getAuditSummary(franchiseId: string) {
    const audits = await this.prisma.corporateAudit.findMany({
      where: { franchiseId },
    });

    const totalAudits = audits.length;
    const closedAudits = audits.filter((a) => a.status === 'closed').length;
    const findingsCount = audits.filter((a) => a.findings !== null).length;
    const unresolvedCount = audits.filter(
      (a) => a.status === 'findings_shared' || a.status === 'corrective_actions'
    ).length;

    return {
      franchiseId,
      totalAudits,
      closedAudits,
      findingsCount,
      unresolvedCount,
      allResolved: unresolvedCount === 0,
    };
  }

  /**
   * Get default checklist based on audit type
   */
  private getDefaultChecklist(auditType: string) {
    const checklists: Record<string, any[]> = {
      financial: [
        { item: 'Revenue reconciliation', status: 'pending' },
        { item: 'Cash handling procedures', status: 'pending' },
        { item: 'Payout accuracy', status: 'pending' },
        { item: 'Tax compliance', status: 'pending' },
      ],
      operational: [
        { item: 'Agent compliance', status: 'pending' },
        { item: 'SLA adherence', status: 'pending' },
        { item: 'Process compliance', status: 'pending' },
        { item: 'Customer feedback handling', status: 'pending' },
      ],
      quality: [
        { item: 'Customer satisfaction scores', status: 'pending' },
        { item: 'Document quality', status: 'pending' },
        { item: 'Service delivery timeliness', status: 'pending' },
        { item: 'Brand consistency', status: 'pending' },
      ],
    };

    return checklists[auditType] || [];
  }

  /**
   * Schedule next recurring audit
   */
  private async scheduleNextRecurringAudit(audit: any) {
    const nextDate = new Date(audit.scheduledDate);
    if (audit.recurringSchedule === 'quarterly') {
      nextDate.setMonth(nextDate.getMonth() + 3);
    } else if (audit.recurringSchedule === 'annual') {
      nextDate.setFullYear(nextDate.getFullYear() + 1);
    }

    await this.prisma.corporateAudit.create({
      data: {
        franchiseId: audit.franchiseId,
        cityId: audit.cityId,
        auditType: audit.auditType,
        scheduledDate: nextDate,
        auditorName: audit.auditorName,
        checklist: this.getDefaultChecklist(audit.auditType) as any,
        isRecurring: true,
        recurringSchedule: audit.recurringSchedule,
        createdBy: audit.createdBy,
        status: 'scheduled',
      },
    });
  }
}
