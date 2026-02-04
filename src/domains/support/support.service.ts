import { PrismaClient } from '@prisma/client';
import {
  CustomerSearchInput,
  ServiceFilterInput,
  SendMessageInput,
  CreateTemplateInput,
  CreateReminderInput,
  UpdateReminderInput,
  ReminderFilterInput,
  AddPerformanceNoteInput,
  CreateEscalationInput,
  SendCustomerMessageInput,
  PerformanceFilterInput,
} from './support.validation';
import {
  CustomerSearchResult,
  CustomerProfileDetail,
  SupportOverviewMetrics,
} from './support.types';

const prisma = new PrismaClient();

// SLA constants (Story 10.7)
const FIRST_RESPONSE_HOURS = 2;
const STANDARD_RESOLUTION_HOURS = 24;
const COMPLEX_RESOLUTION_HOURS = 72;

export class SupportService {
  // ============================================================
  // Story 10.1: Customer Search & Case Lookup
  // ============================================================

  async searchCustomers(input: CustomerSearchInput): Promise<CustomerSearchResult[]> {
    const { query, searchType, limit } = input;
    const where: any = {};

    if (searchType === 'phone' || (!searchType && /^\d+/.test(query))) {
      where.phone = { contains: query };
    } else if (searchType === 'customer_id') {
      where.id = query;
    } else if (searchType === 'service_id') {
      // Search via payment or service relation
      where.id = query; // Simplified: direct ID lookup
    } else {
      where.name = { contains: query, mode: 'insensitive' };
    }

    const customers = await prisma.$queryRaw`
      SELECT
        u.id AS "customerId",
        u.name,
        u.phone,
        u.city_id AS "city",
        u.language_preference AS "preferredLanguage",
        COUNT(DISTINCT sr.id) AS "totalServices",
        COUNT(DISTINCT CASE WHEN sr.status IN ('active', 'in_progress', 'assigned') THEN sr.id END) AS "activeServices",
        MAX(sr.created_at) AS "lastServiceDate"
      FROM users u
      LEFT JOIN service_requests sr ON sr.customer_id = u.id
      WHERE u.role = 'CUSTOMER'
        AND (u.name ILIKE ${'%' + query + '%'} OR u.phone LIKE ${'%' + query + '%'} OR u.id = ${query})
      GROUP BY u.id
      LIMIT ${limit}
    `;

    // Fallback to Prisma query if raw fails
    return (customers as any[]).map((c: any) => ({
      customerId: c.customerId,
      name: c.name || '',
      phone: c.phone || '',
      city: c.city || '',
      totalServices: Number(c.totalServices) || 0,
      activeServices: Number(c.activeServices) || 0,
      lastServiceDate: c.lastServiceDate?.toISOString() ?? null,
      preferredLanguage: c.preferredLanguage ?? 'en',
    }));
  }

  async getCustomerProfile(customerId: string): Promise<CustomerProfileDetail> {
    // Fetch customer with all related data
    const customer = await prisma.$queryRaw`
      SELECT id, name, phone, city_id, language_preference
      FROM users WHERE id = ${customerId}
    `;

    const customerData = (customer as any[])[0];

    // Fetch service requests
    const services = await prisma.$queryRaw`
      SELECT id, service_type, status, created_at
      FROM service_requests
      WHERE customer_id = ${customerId}
      ORDER BY created_at DESC
    `;

    // Fetch payments
    const payments = await prisma.payment.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      customer: {
        customerId: customerData?.id ?? customerId,
        name: customerData?.name ?? '',
        phone: customerData?.phone ?? '',
        city: customerData?.city_id ?? '',
        totalServices: (services as any[]).length,
        activeServices: (services as any[]).filter((s: any) => ['active', 'in_progress', 'assigned'].includes(s.status)).length,
        lastServiceDate: (services as any[])[0]?.created_at?.toISOString() ?? null,
        preferredLanguage: customerData?.language_preference ?? 'en',
      },
      serviceRequests: (services as any[]).map((s: any) => ({
        serviceId: s.id,
        serviceType: s.service_type,
        status: s.status,
        assignedAgent: null,
        slaStatus: 'on_track' as const,
        paymentStatus: 'unknown',
        milestones: [],
        escalations: [],
        createdAt: s.created_at?.toISOString() ?? '',
      })),
      paymentHistory: payments.map(p => ({
        paymentId: p.id,
        amountPaise: p.amountPaise,
        status: p.status,
        method: p.paymentMethodType,
        paidAt: p.paidAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
      communicationTimeline: [],
      dealerAttribution: null,
      assignedAgents: [],
    };
  }

  async getCustomerServices(input: ServiceFilterInput) {
    const where: any = { customerId: input.customerId };
    if (input.status) {
      if (input.status === 'active') where.status = { in: ['active', 'in_progress', 'assigned'] };
      else if (input.status === 'completed') where.status = 'completed';
      else if (input.status === 'halted') where.status = 'halted';
    }
    if (input.dateFrom) where.createdAt = { ...(where.createdAt || {}), gte: new Date(input.dateFrom) };
    if (input.dateTo) where.createdAt = { ...(where.createdAt || {}), lte: new Date(input.dateTo) };

    return prisma.$queryRaw`
      SELECT id, service_type, status, created_at
      FROM service_requests
      WHERE customer_id = ${input.customerId}
      ORDER BY created_at DESC
      LIMIT ${input.limit}
    `;
  }

  async getAssignedCasesCount(agentId: string): Promise<number> {
    return prisma.supportEscalation.count({
      where: {
        assignedAgentId: agentId,
        status: { in: ['OPEN', 'IN_PROGRESS'] },
      },
    });
  }

  // ============================================================
  // Story 10.2: Internal Messaging with Field Agents
  // ============================================================

  async sendMessage(senderId: string, input: SendMessageInput) {
    const message = await prisma.supportAgentMessage.create({
      data: {
        senderId,
        recipientId: input.recipientId,
        serviceId: input.serviceId,
        messageText: input.messageText,
        attachmentUrl: input.attachmentUrl,
        attachmentType: input.attachmentType,
      },
    });

    return message;
  }

  async getThreadMessages(serviceId: string, userId: string) {
    return prisma.supportAgentMessage.findMany({
      where: {
        serviceId,
        OR: [
          { senderId: userId },
          { recipientId: userId },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
  }

  async markThreadResolved(serviceId: string) {
    await prisma.supportAgentMessage.updateMany({
      where: { serviceId },
      data: { threadStatus: 'RESOLVED' },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return prisma.supportAgentMessage.count({
      where: { recipientId: userId, readStatus: false, threadStatus: 'ACTIVE' },
    });
  }

  async markMessagesRead(serviceId: string, recipientId: string) {
    await prisma.supportAgentMessage.updateMany({
      where: { serviceId, recipientId, readStatus: false },
      data: { readStatus: true },
    });
  }

  // ============================================================
  // Story 10.3: Pre-Built Communication Templates
  // ============================================================

  async getTemplates(category?: string) {
    return prisma.supportTemplate.findMany({
      where: {
        isActive: true,
        ...(category ? { category: category as any } : {}),
      },
      orderBy: { category: 'asc' },
      take: 50,
    });
  }

  async createTemplate(createdBy: string, input: CreateTemplateInput) {
    return prisma.supportTemplate.create({
      data: {
        category: input.category as any,
        templateTextEn: input.templateTextEn,
        templateTextHi: input.templateTextHi,
        placeholders: input.placeholders,
        createdBy,
      },
    });
  }

  async updateTemplate(templateId: string, input: Partial<CreateTemplateInput>) {
    return prisma.supportTemplate.update({
      where: { id: templateId },
      data: {
        ...(input.category ? { category: input.category as any } : {}),
        ...(input.templateTextEn ? { templateTextEn: input.templateTextEn } : {}),
        ...(input.templateTextHi ? { templateTextHi: input.templateTextHi } : {}),
        ...(input.placeholders ? { placeholders: input.placeholders } : {}),
      },
    });
  }

  async deleteTemplate(templateId: string) {
    // Soft delete
    return prisma.supportTemplate.update({
      where: { id: templateId },
      data: { isActive: false },
    });
  }

  async logTemplateUsage(usedBy: string, templateId: string, serviceId?: string) {
    return prisma.supportTemplateUsage.create({
      data: { templateId, usedBy, serviceId },
    });
  }

  // ============================================================
  // Story 10.4: Follow-Up Reminder Scheduling
  // ============================================================

  async createReminder(supportAgentId: string, input: CreateReminderInput) {
    const reminder = await prisma.supportReminder.create({
      data: {
        supportAgentId,
        serviceId: input.serviceId,
        reminderDatetime: new Date(input.reminderDatetime),
        reminderType: input.reminderType as any,
        notes: input.notes,
      },
    });

    return reminder;
  }

  async getReminders(supportAgentId: string, filters?: ReminderFilterInput) {
    const where: any = { supportAgentId };
    if (filters?.status) where.status = filters.status;
    if (filters?.dateFrom || filters?.dateTo) {
      where.reminderDatetime = {};
      if (filters?.dateFrom) where.reminderDatetime.gte = new Date(filters.dateFrom);
      if (filters?.dateTo) where.reminderDatetime.lte = new Date(filters.dateTo);
    }

    return prisma.supportReminder.findMany({
      where,
      orderBy: { reminderDatetime: 'asc' },
      take: 50,
    });
  }

  async updateReminder(reminderId: string, supportAgentId: string, input: UpdateReminderInput) {
    const data: any = { status: input.status };
    if (input.status === 'COMPLETED') data.completedAt = new Date();
    if (input.status === 'SNOOZED' && input.snoozedUntil) {
      data.snoozedUntil = new Date(input.snoozedUntil);
      data.reminderDatetime = new Date(input.snoozedUntil);
    }

    return prisma.supportReminder.update({
      where: { id: reminderId },
      data,
    });
  }

  async getOverdueCount(supportAgentId: string): Promise<number> {
    return prisma.supportReminder.count({
      where: {
        supportAgentId,
        status: 'PENDING',
        reminderDatetime: { lt: new Date() },
      },
    });
  }

  // ============================================================
  // Story 10.5: Case Pattern Logging
  // ============================================================

  async logPatterns(serviceId: string, loggedBy: string, patterns: Array<{ patternCategory: string; notes?: string }>) {
    const service = await prisma.payment.findFirst({
      where: { serviceRequestId: serviceId },
      select: { customerId: true },
    });

    const customerId = service?.customerId ?? 'unknown';

    return prisma.$transaction(
      patterns.map(p =>
        prisma.supportCasePattern.create({
          data: {
            serviceId,
            customerId,
            patternCategory: p.patternCategory as any,
            notes: p.notes,
            loggedBy,
          },
        }),
      ),
    );
  }

  async getPatternReport(dateFrom: Date, dateTo: Date) {
    const results = await prisma.supportCasePattern.groupBy({
      by: ['patternCategory'],
      _count: { id: true },
      where: {
        createdAt: { gte: dateFrom, lte: dateTo },
      },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    });

    return results.map(r => ({
      category: r.patternCategory,
      count: r._count.id,
    }));
  }

  async getPatternsByService(serviceId: string) {
    return prisma.supportCasePattern.findMany({
      where: { serviceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ============================================================
  // Story 10.6: Agent Performance Notes (Immutable)
  // ============================================================

  async addPerformanceNote(loggedBy: string, input: AddPerformanceNoteInput) {
    return prisma.agentPerformanceNote.create({
      data: {
        agentId: input.agentId,
        serviceId: input.serviceId,
        noteType: input.noteType as any,
        notes: input.notes,
        loggedBy,
      },
    });
  }

  async getAgentPerformanceNotes(agentId: string, limit: number = 20) {
    return prisma.agentPerformanceNote.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getAgentNoteCount(agentId: string): Promise<number> {
    return prisma.agentPerformanceNote.count({ where: { agentId } });
  }

  // ============================================================
  // Story 10.7: Support Escalation SLA Tracking
  // ============================================================

  async createEscalation(input: CreateEscalationInput) {
    const now = new Date();
    const resolutionHours = input.severity === 'COMPLEX'
      ? COMPLEX_RESOLUTION_HOURS
      : STANDARD_RESOLUTION_HOURS;

    const escalation = await prisma.supportEscalation.create({
      data: {
        serviceId: input.serviceId,
        customerId: input.customerId,
        escalationType: input.escalationType as any,
        escalationReason: input.escalationReason,
        severity: (input.severity as any) ?? 'STANDARD',
        firstResponseDue: new Date(now.getTime() + FIRST_RESPONSE_HOURS * 60 * 60 * 1000),
        resolutionDue: new Date(now.getTime() + resolutionHours * 60 * 60 * 1000),
      },
    });

    return escalation;
  }

  async recordFirstResponse(escalationId: string, agentId: string) {
    const escalation = await prisma.supportEscalation.findUnique({
      where: { id: escalationId },
    });
    if (!escalation || escalation.firstResponseAt) return escalation;

    const now = new Date();
    const breached = now > escalation.firstResponseDue;

    return prisma.supportEscalation.update({
      where: { id: escalationId },
      data: {
        firstResponseAt: now,
        firstResponseBreached: breached,
        assignedAgentId: agentId,
        status: 'IN_PROGRESS',
      },
    });
  }

  async resolveEscalation(escalationId: string) {
    const escalation = await prisma.supportEscalation.findUnique({
      where: { id: escalationId },
    });
    if (!escalation) throw new Error('Escalation not found');

    const now = new Date();
    const breached = now > escalation.resolutionDue;

    return prisma.supportEscalation.update({
      where: { id: escalationId },
      data: {
        resolvedAt: now,
        resolutionBreached: breached,
        status: 'RESOLVED',
      },
    });
  }

  async getEscalationsQueue(agentId?: string) {
    return prisma.supportEscalation.findMany({
      where: {
        status: { in: ['OPEN', 'IN_PROGRESS', 'ESCALATED_TO_OPS'] },
        ...(agentId ? { assignedAgentId: agentId } : {}),
      },
      orderBy: [
        { firstResponseDue: 'asc' },
        { resolutionDue: 'asc' },
      ],
      take: 50,
    });
  }

  // ============================================================
  // Story 10.10: Customer Communication
  // ============================================================

  async sendCustomerMessage(senderId: string, input: SendCustomerMessageInput) {
    const message = await prisma.supportCustomerMessage.create({
      data: {
        serviceId: input.serviceId,
        senderId,
        senderType: 'SUPPORT_AGENT',
        recipientId: input.recipientId,
        subject: input.subject,
        messageText: input.messageText,
        attachmentUrl: input.attachmentUrl,
        deliveryChannel: input.deliveryChannel as any,
        deliveryStatus: 'SENT',
      },
    });

    // Check and record first response for escalation
    await this.checkAndRecordFirstResponse(input.serviceId, senderId);

    return message;
  }

  async getServiceCommunications(serviceId: string) {
    return prisma.supportCustomerMessage.findMany({
      where: { serviceId },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
  }

  async handleCustomerReply(customerId: string, serviceId: string, messageText: string) {
    // Find assigned support agent
    const escalation = await prisma.supportEscalation.findFirst({
      where: { serviceId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
    });

    const message = await prisma.supportCustomerMessage.create({
      data: {
        serviceId,
        senderId: customerId,
        senderType: 'CUSTOMER',
        recipientId: escalation?.assignedAgentId ?? '',
        messageText,
        deliveryChannel: 'PUSH_ONLY',
        deliveryStatus: 'SENT',
      },
    });

    return message;
  }

  private async checkAndRecordFirstResponse(serviceId: string, agentId: string) {
    const escalation = await prisma.supportEscalation.findFirst({
      where: { serviceId, status: 'OPEN', firstResponseAt: null },
    });
    if (escalation) {
      await this.recordFirstResponse(escalation.id, agentId);
    }
  }

  // ============================================================
  // Story 10.11: Overview Metrics
  // ============================================================

  async getOverviewMetrics(agentId: string): Promise<SupportOverviewMetrics> {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const [activeCount, resolvedToday] = await Promise.all([
      prisma.supportEscalation.count({
        where: { assignedAgentId: agentId, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      }),
      prisma.supportEscalation.count({
        where: { assignedAgentId: agentId, status: 'RESOLVED', resolvedAt: { gte: todayStart } },
      }),
    ]);

    // Calculate average response/resolution times
    const responded = await prisma.supportEscalation.findMany({
      where: { assignedAgentId: agentId, firstResponseAt: { not: null } },
      select: { createdAt: true, firstResponseAt: true, resolvedAt: true },
      take: 50,
      orderBy: { createdAt: 'desc' },
    });

    let avgFirstResponseMinutes = 0;
    let avgResolutionHours = 0;

    if (responded.length > 0) {
      const totalResponse = responded.reduce((sum, e) => {
        return sum + ((e.firstResponseAt!.getTime() - e.createdAt.getTime()) / 60000);
      }, 0);
      avgFirstResponseMinutes = Math.round((totalResponse / responded.length) * 10) / 10;

      const resolved = responded.filter(e => e.resolvedAt);
      if (resolved.length > 0) {
        const totalResolution = resolved.reduce((sum, e) => {
          return sum + ((e.resolvedAt!.getTime() - e.createdAt.getTime()) / 3600000);
        }, 0);
        avgResolutionHours = Math.round((totalResolution / resolved.length) * 10) / 10;
      }
    }

    return {
      activeEscalations: activeCount,
      resolvedToday,
      avgFirstResponseMinutes,
      avgResolutionHours,
    };
  }

  // ============================================================
  // Story 10.12: Agent Performance Metrics
  // ============================================================

  async getAgentPerformance(filters: PerformanceFilterInput) {
    const latestMetrics = await prisma.supportAgentMetrics.findMany({
      orderBy: { periodEnd: 'desc' },
      distinct: ['agentId'],
      take: 100,
    });

    let result = latestMetrics.map(m => ({
      agentId: m.agentId,
      agentName: '', // Would be joined from user table
      city: '',
      casesHandled: m.casesHandled,
      avgFirstResponseMinutes: m.avgFirstResponseMinutes,
      avgResolutionHours: m.avgResolutionHours,
      firstResponseSlaPercent: m.firstResponseSlaPercent,
      resolutionSlaPercent: m.resolutionSlaPercent,
      customerSatisfaction: m.customerSatisfaction,
      periodStart: m.periodStart.toISOString(),
      periodEnd: m.periodEnd.toISOString(),
    }));

    // Tier filter
    if (filters.tier) {
      result.sort((a, b) => b.resolutionSlaPercent - a.resolutionSlaPercent);
      const third = Math.ceil(result.length / 3);
      if (filters.tier === 'top') result = result.slice(0, third);
      else if (filters.tier === 'middle') result = result.slice(third, third * 2);
      else result = result.slice(third * 2);
    }

    return result;
  }

  async getAgentDetailedMetrics(agentId: string) {
    const metrics = await prisma.supportAgentMetrics.findMany({
      where: { agentId },
      orderBy: { periodEnd: 'asc' },
      take: 12,
    });

    const patterns = await prisma.supportCasePattern.findMany({
      where: { loggedBy: agentId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const noteCount = await prisma.agentPerformanceNote.count({
      where: { agentId },
    });

    return { metrics, patterns, noteCount };
  }

  generateCsv(data: any[]): string {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row =>
      Object.values(row)
        .map(val => this.sanitizeCsvCell(String(val ?? '')))
        .join(',')
    );
    return [headers, ...rows].join('\n');
  }

  /**
   * Sanitize a CSV cell value to prevent CSV injection.
   * If a cell starts with =, +, -, or @, prefix with a single quote
   * to prevent spreadsheet formula execution.
   */
  private sanitizeCsvCell(value: string): string {
    if (/^[=+\-@]/.test(value)) {
      return `'${value}`;
    }
    // Escape values containing commas or quotes
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

export const supportService = new SupportService();
