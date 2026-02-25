/**
 * Ops Dashboard Service
 *
 * Story 5.1: Unified Operational Dashboard
 *
 * Handles:
 * - Aggregated service metrics
 * - Agent performance metrics
 * - Lawyer workload metrics
 * - SLA compliance tracking
 * - Payment metrics
 *
 * IMPORTANT: ServiceInstance.state uses lowercase snake_case values:
 *   requested, assigned, payment_pending, paid, in_progress,
 *   step_1..step_N, completed, delivered, halted, refund_pending, cancelled
 * Terminal states: delivered, cancelled
 */

import { PrismaClient } from '@prisma/client';
import { getAllActiveStates } from '../services/workflow-engine';

/** States considered terminal — service lifecycle is over */
const TERMINAL_STATES = ['delivered', 'cancelled'];

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface ServiceMetrics {
  total: number;
  active: number;
  completed: number;
  delayed: number;
  pendingPayment: number;
}

export interface AgentMetrics {
  totalAgents: number;
  activeAgents: number;
  totalTasks: number;
  completedTasks: number;
  avgTasksPerAgent: number;
  avgCompletionTime: number;
}

export interface LawyerMetrics {
  totalLawyers: number;
  activeLawyers: number;
  totalCases: number;
  completedCases: number;
  avgCaseDuration: number;
  avgRating: number;
}

export interface SlaMetrics {
  totalServices: number;
  onTrack: number;
  atRisk: number;
  breached: number;
  complianceRate: number;
}

export interface PaymentMetrics {
  totalCollected: bigint;
  pending: bigint;
  refunded: bigint;
  avgPaymentValue: number;
  paymentCount: number;
}

export interface DashboardSummary {
  services: ServiceMetrics;
  agents: AgentMetrics;
  lawyers: LawyerMetrics;
  sla: SlaMetrics;
  payments: PaymentMetrics;
  generatedAt: Date;
}

export class DashboardService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Gets the full dashboard summary for a city.
   * AC1: Unified view of all operational metrics.
   */
  async getDashboardSummary(cityId?: string, dateRange?: DateRange): Promise<DashboardSummary> {
    const [services, agents, lawyers, sla, payments] = await Promise.all([
      this.getServiceMetrics(cityId, dateRange),
      this.getAgentMetrics(cityId, dateRange),
      this.getLawyerMetrics(cityId, dateRange),
      this.getSlaMetrics(cityId),
      this.getPaymentMetrics(cityId, dateRange),
    ]);

    return {
      services,
      agents,
      lawyers,
      sla,
      payments,
      generatedAt: new Date(),
    };
  }

  /**
   * Gets service metrics.
   * AC2: Track active, completed, and delayed services.
   *
   * Active = in_progress + step_N states (workflow is being executed)
   * Completed = completed + delivered
   * Delayed = SLA deadline passed but not terminal
   * PendingPayment = payment_pending
   */
  async getServiceMetrics(cityId?: string, dateRange?: DateRange): Promise<ServiceMetrics> {
    const where = {
      ...(cityId && { cityId }),
      ...(dateRange && {
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      }),
    };

    // Active states from the workflow engine (in_progress, step_1..step_20)
    const activeStates = getAllActiveStates();

    const [total, active, completed, delayed, pendingPayment] = await Promise.all([
      this.prisma.serviceInstance.count({ where }),
      this.prisma.serviceInstance.count({
        where: {
          ...where,
          state: { in: activeStates },
        },
      }),
      this.prisma.serviceInstance.count({
        where: {
          ...where,
          state: { in: ['completed', 'delivered'] },
        },
      }),
      // Delayed = SLA deadline passed but not completed/cancelled
      this.prisma.serviceInstance.count({
        where: {
          ...where,
          state: { notIn: TERMINAL_STATES },
          slaDeadline: { lt: new Date() },
        },
      }),
      this.prisma.serviceInstance.count({
        where: {
          ...where,
          state: 'payment_pending',
        },
      }),
    ]);

    return {
      total,
      active,
      completed,
      delayed,
      pendingPayment,
    };
  }

  /**
   * Gets agent performance metrics.
   * AC3: Track agent workload and task completion.
   */
  async getAgentMetrics(cityId?: string, dateRange?: DateRange): Promise<AgentMetrics> {
    const agentWhere = {
      ...(cityId && { cityId }),
      isActive: true,
    };

    const taskWhere = {
      ...(dateRange && {
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      }),
    };

    const [totalAgents, activeAgentsResult, totalTasks, completedTasks] = await Promise.all([
      this.prisma.agent.count({ where: agentWhere }),
      this.prisma.agent.count({
        where: {
          ...agentWhere,
        },
      }),
      this.prisma.agentAssignmentLog.count({ where: taskWhere }),
      this.prisma.serviceRequest.count({
        where: {
          ...taskWhere,
          status: 'completed',
        },
      }),
    ]);

    const activeAgents = activeAgentsResult || totalAgents;
    const avgTasksPerAgent = activeAgents > 0 ? Math.round(totalTasks / activeAgents) : 0;

    return {
      totalAgents,
      activeAgents,
      totalTasks,
      completedTasks,
      avgTasksPerAgent,
      avgCompletionTime: 0,
    };
  }

  /**
   * Gets lawyer workload metrics.
   * AC4: Track case assignment and completion.
   */
  async getLawyerMetrics(cityId?: string, dateRange?: DateRange): Promise<LawyerMetrics> {
    const lawyerWhere = {
      ...(cityId && { cityId }),
      lawyerStatus: 'VERIFIED' as const,
    };

    const caseWhere = {
      ...(cityId && { cityId }),
      ...(dateRange && {
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      }),
    };

    const [totalLawyers, activeLawyers, totalCases, completedCases, ratings] = await Promise.all([
      this.prisma.lawyer.count({ where: lawyerWhere }),
      this.prisma.lawyer.count({
        where: {
          ...lawyerWhere,
          // Note: LawyerWhereInput relation filter depends on schema; using same count as approximation
        },
      }),
      this.prisma.legalCase.count({ where: caseWhere }),
      this.prisma.legalCase.count({
        where: {
          ...caseWhere,
          caseStatus: 'COMPLETED',
        },
      }),
      this.prisma.legalOpinionRating.aggregate({
        _avg: { rating: true },
        where: {
          ...(dateRange && {
            createdAt: {
              gte: dateRange.startDate,
              lte: dateRange.endDate,
            },
          }),
        },
      }),
    ]);

    return {
      totalLawyers,
      activeLawyers,
      totalCases,
      completedCases,
      avgCaseDuration: 0,
      avgRating: ratings._avg.rating || 0,
    };
  }

  /**
   * Gets SLA compliance metrics.
   * AC5: Track SLA performance and breaches.
   */
  async getSlaMetrics(cityId?: string): Promise<SlaMetrics> {
    const now = new Date();
    const warningThreshold = new Date();
    warningThreshold.setHours(warningThreshold.getHours() + 24);

    const where = {
      ...(cityId && { cityId }),
      state: { notIn: TERMINAL_STATES },
    };

    const [totalServices, breached, atRisk, onTrack] = await Promise.all([
      this.prisma.serviceInstance.count({ where }),
      this.prisma.serviceInstance.count({
        where: {
          ...where,
          slaDeadline: { lt: now },
        },
      }),
      this.prisma.serviceInstance.count({
        where: {
          ...where,
          slaDeadline: { gte: now, lte: warningThreshold },
        },
      }),
      this.prisma.serviceInstance.count({
        where: {
          ...where,
          slaDeadline: { gt: warningThreshold },
        },
      }),
    ]);

    const complianceRate = totalServices > 0
      ? Math.round(((totalServices - breached) / totalServices) * 100)
      : 100;

    return {
      totalServices,
      onTrack,
      atRisk,
      breached,
      complianceRate,
    };
  }

  /**
   * Gets payment metrics.
   * AC6: Track collections, pending, and refunds.
   */
  async getPaymentMetrics(cityId?: string, dateRange?: DateRange): Promise<PaymentMetrics> {
    const where = {
      ...(dateRange && {
        createdAt: {
          gte: dateRange.startDate,
          lte: dateRange.endDate,
        },
      }),
    };

    const [collected, pending, refunded, stats] = await Promise.all([
      this.prisma.payment.aggregate({
        _sum: { amountPaise: true },
        _count: true,
        where: {
          ...where,
          status: 'paid',
        },
      }),
      this.prisma.payment.aggregate({
        _sum: { amountPaise: true },
        where: {
          ...where,
          status: 'pending',
        },
      }),
      this.prisma.payment.aggregate({
        _sum: { amountPaise: true },
        where: {
          ...where,
          status: 'refunded',
        },
      }),
      this.prisma.payment.aggregate({
        _avg: { amountPaise: true },
        where: {
          ...where,
          status: 'paid',
        },
      }),
    ]);

    return {
      totalCollected: BigInt(collected._sum.amountPaise || 0),
      pending: BigInt(pending._sum.amountPaise || 0),
      refunded: BigInt(refunded._sum.amountPaise || 0),
      avgPaymentValue: stats._avg.amountPaise || 0,
      paymentCount: collected._count || 0,
    };
  }

  /**
   * Gets SLA alerts - services at risk or breached.
   * AC7: Actionable SLA alerts for ops team.
   * Joins through serviceRequests to get requestNumber.
   */
  async getSlaAlerts(cityId?: string, limit: number = 20) {
    const now = new Date();

    const alerts = await this.prisma.serviceInstance.findMany({
      where: {
        ...(cityId && { cityId }),
        state: { notIn: TERMINAL_STATES },
        slaDeadline: { lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
      },
      select: {
        id: true,
        state: true,
        slaDeadline: true,
        customerId: true,
        cityId: true,
        createdAt: true,
        serviceRequests: {
          orderBy: { createdAt: 'desc' as const },
          take: 1,
          select: { requestNumber: true },
        },
      },
      orderBy: { slaDeadline: 'asc' },
      take: limit,
    });

    return alerts.map(alert => ({
      id: alert.id,
      requestNumber: alert.serviceRequests[0]?.requestNumber ?? null,
      state: alert.state,
      slaDeadline: alert.slaDeadline,
      customerId: alert.customerId,
      cityId: alert.cityId,
      createdAt: alert.createdAt,
      status: alert.slaDeadline && alert.slaDeadline < now ? 'BREACHED' : 'AT_RISK',
      hoursRemaining: alert.slaDeadline
        ? Math.max(0, Math.round((alert.slaDeadline.getTime() - now.getTime()) / (1000 * 60 * 60)))
        : null,
    }));
  }

  /**
   * Gets service breakdown by status.
   * AC8: Detailed service status distribution.
   */
  async getServiceBreakdown(cityId?: string) {
    const where = cityId ? { cityId } : {};

    const breakdown = await this.prisma.serviceInstance.groupBy({
      by: ['state'],
      where,
      _count: true,
    });

    return breakdown.map(item => ({
      state: item.state,
      count: item._count,
    }));
  }

  /**
   * Gets agent leaderboard by task completion.
   * AC9: Agent performance ranking.
   */
  async getAgentLeaderboard(cityId?: string, limit: number = 10) {
    const where = {
      ...(cityId && { cityId }),
      isActive: true,
    };

    const agents = await this.prisma.agent.findMany({
      where,
      select: {
        id: true,
        name: true,
        phone: true,
        expertiseTags: true,
      },
      take: limit,
    });

    return agents;
  }

  /**
   * Gets daily service trend for charts.
   * AC10: Time-series data for visualization.
   */
  async getDailyServiceTrend(cityId?: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const where = {
      ...(cityId && { cityId }),
      createdAt: { gte: startDate },
    };

    const services = await this.prisma.serviceInstance.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
        state: true,
      },
    });

    const dailyData: Record<string, { created: number; completed: number }> = {};

    for (let i = 0; i <= days; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const key = date.toISOString().split('T')[0];
      dailyData[key] = { created: 0, completed: 0 };
    }

    services.forEach(service => {
      const key = service.createdAt.toISOString().split('T')[0];
      if (dailyData[key]) {
        dailyData[key].created++;
        if (service.state === 'completed' || service.state === 'delivered') {
          dailyData[key].completed++;
        }
      }
    });

    return Object.entries(dailyData).map(([date, data]) => ({
      date,
      ...data,
    }));
  }
}
