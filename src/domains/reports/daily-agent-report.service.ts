import { PrismaClient } from '@prisma/client';

export class DailyAgentReportService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Generate daily report for an agent.
   * Aggregates tasks completed, checklists progressed, receipts collected.
   */
  async generateDailyReport(agentId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Checklist steps completed today
    const stepsCompleted = await this.prisma.checklistProgress.count({
      where: {
        completedBy: agentId,
        completedAt: { gte: startOfDay, lte: endOfDay },
        isCompleted: true,
      },
    });

    // Cash receipts collected today
    const receipts = await this.prisma.cashReceipt.findMany({
      where: {
        agentId,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
      select: { amountPaise: true },
    });

    const totalCollectedPaise = receipts.reduce(
      (sum, r) => sum + Number(r.amountPaise),
      0,
    );

    // Assignment logs today
    const assignments = await this.prisma.agentAssignmentLog.count({
      where: {
        assignedAgentId: agentId,
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    return {
      agentId,
      reportDate: startOfDay.toISOString(),
      metrics: {
        checklistStepsCompleted: stepsCompleted,
        cashReceiptsCollected: receipts.length,
        totalCashCollectedPaise: totalCollectedPaise.toString(),
        newAssignments: assignments,
      },
    };
  }

  /**
   * Generate summary report for all agents in a city for a given date.
   */
  async generateCitySummary(cityId: string, date: Date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const agents = await this.prisma.agent.findMany({
      where: { cityId, isActive: true },
      select: { id: true, name: true },
    });

    const reports = await Promise.all(
      agents.map(async (agent) => {
        const report = await this.generateDailyReport(agent.id, date);
        return { ...report, agentName: agent.name };
      }),
    );

    const totalSteps = reports.reduce((sum, r) => sum + r.metrics.checklistStepsCompleted, 0);
    const totalReceipts = reports.reduce((sum, r) => sum + r.metrics.cashReceiptsCollected, 0);

    return {
      cityId,
      reportDate: startOfDay.toISOString(),
      agentCount: agents.length,
      totals: {
        checklistStepsCompleted: totalSteps,
        cashReceiptsCollected: totalReceipts,
      },
      agentReports: reports,
    };
  }
}
