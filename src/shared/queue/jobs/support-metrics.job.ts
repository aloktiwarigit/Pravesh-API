// Story 10.12: pg-boss scheduled job for pre-computing support agent performance metrics
// Runs daily at midnight via cron: 0 0 * * *
// Job name: support.compute-metrics per {domain}.{action} convention (DA-4)
import { logger } from '../../utils/logger';
import { prisma } from '../../prisma/client';

export const SUPPORT_METRICS_JOB = 'support.compute-metrics';

/**
 * Computes performance metrics for all active support agents.
 * Metrics are stored in support_agent_metrics table for fast dashboard loads (<2s per NFR8).
 * Uses Prisma upsert to prevent duplicate entries.
 */
export async function handleSupportMetricsComputation() {
  const now = new Date();
  const periodEnd = new Date(now);
  periodEnd.setHours(0, 0, 0, 0);
  const periodStart = new Date(periodEnd);
  periodStart.setDate(periodStart.getDate() - 30);

  // Get all active support agents
  // In production: query from users table where role = SUPPORT_AGENT
  const agentIds = await prisma.supportEscalation.findMany({
    select: { assignedAgentId: true },
    distinct: ['assignedAgentId'],
    where: { assignedAgentId: { not: null } },
  });

  const uniqueAgentIds = [...new Set(agentIds.map(a => a.assignedAgentId).filter(Boolean))];

  for (const agentId of uniqueAgentIds) {
    if (!agentId) continue;

    // Get escalations for this agent in period
    const escalations = await prisma.supportEscalation.findMany({
      where: {
        assignedAgentId: agentId,
        createdAt: { gte: periodStart, lte: periodEnd },
      },
    });

    const casesHandled = escalations.length;
    const casesResolved = escalations.filter(e => e.status === 'RESOLVED').length;

    // Average first response time (minutes)
    const responded = escalations.filter(e => e.firstResponseAt != null);
    const avgFirstResponseMinutes = responded.length > 0
      ? responded.reduce((sum, e) => {
          return sum + (e.firstResponseAt!.getTime() - e.createdAt.getTime()) / 60000;
        }, 0) / responded.length
      : 0;

    // Average resolution time (hours)
    const resolved = escalations.filter(e => e.resolvedAt != null);
    const avgResolutionHours = resolved.length > 0
      ? resolved.reduce((sum, e) => {
          return sum + (e.resolvedAt!.getTime() - e.createdAt.getTime()) / 3600000;
        }, 0) / resolved.length
      : 0;

    // SLA adherence percentages
    const firstResponseSlaPercent = responded.length > 0
      ? (responded.filter(e => !e.firstResponseBreached).length / responded.length) * 100
      : 100;

    const resolutionSlaPercent = resolved.length > 0
      ? (resolved.filter(e => !e.resolutionBreached).length / resolved.length) * 100
      : 100;

    // Patterns logged by this agent
    const patternsLogged = await prisma.supportCasePattern.count({
      where: {
        loggedBy: agentId,
        createdAt: { gte: periodStart, lte: periodEnd },
      },
    });

    // Upsert metrics (no duplicates)
    await prisma.supportAgentMetrics.upsert({
      where: {
        agentId_periodStart_periodEnd: { agentId, periodStart, periodEnd },
      },
      create: {
        agentId,
        periodStart,
        periodEnd,
        casesHandled,
        casesResolved,
        avgFirstResponseMinutes: Math.round(avgFirstResponseMinutes * 10) / 10,
        avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
        firstResponseSlaPercent: Math.round(firstResponseSlaPercent * 10) / 10,
        resolutionSlaPercent: Math.round(resolutionSlaPercent * 10) / 10,
        patternsLogged,
      },
      update: {
        casesHandled,
        casesResolved,
        avgFirstResponseMinutes: Math.round(avgFirstResponseMinutes * 10) / 10,
        avgResolutionHours: Math.round(avgResolutionHours * 10) / 10,
        firstResponseSlaPercent: Math.round(firstResponseSlaPercent * 10) / 10,
        resolutionSlaPercent: Math.round(resolutionSlaPercent * 10) / 10,
        patternsLogged,
        computedAt: now,
      },
    });

    logger.info({ agentId, casesHandled, casesResolved }, 'Support metrics computed for agent');
  }

  logger.info({ agentCount: uniqueAgentIds.length }, 'Support metrics computation complete');
}
