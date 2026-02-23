import { PrismaClient } from '@prisma/client';
import { haversineDistance } from '../../shared/utils/haversine';

export interface AgentScore {
  agentId: string;
  distance: number;
  taskCount: number;
  score: number;
}

export interface ScoringResult {
  candidates: AgentScore[];
  selectedAgentId: string | null;
  reason: string;
}

const DISTANCE_WEIGHT = 0.6;
const TASK_COUNT_WEIGHT = 0.4;
const MAX_DISTANCE_KM = 50; // Normalize distances within 50km radius

/**
 * Score eligible agents for a service request based on proximity and workload.
 * AC2: Agent eligibility - city match, active status, below max tasks.
 * AC3: Scoring formula - 0.6 * proximity + 0.4 * availability.
 */
export async function scoreAgents(
  prisma: PrismaClient,
  cityId: string,
  propertyLat: number,
  propertyLng: number,
): Promise<ScoringResult> {
  // AC2: Find eligible agents
  const agents = await prisma.agent.findMany({
    where: {
      cityId,
      isActive: true,
    },
    select: {
      id: true,
      currentLat: true,
      currentLng: true,
      maxConcurrentTasks: true,
      _count: {
        select: {
          agentAssignmentLogs: true,
        },
      },
    },
  });

  if (agents.length === 0) {
    return {
      candidates: [],
      selectedAgentId: null,
      reason: 'no eligible agents in city',
    };
  }

  // Filter agents at or above max task limit
  const eligible = agents.filter(
    (a) => a._count.agentAssignmentLogs < a.maxConcurrentTasks,
  );

  if (eligible.length === 0) {
    return {
      candidates: agents.map((a) => ({
        agentId: a.id,
        distance:
          a.currentLat && a.currentLng
            ? haversineDistance(propertyLat, propertyLng, a.currentLat, a.currentLng)
            : MAX_DISTANCE_KM,
        taskCount: a._count.agentAssignmentLogs,
        score: 0,
      })),
      selectedAgentId: null,
      reason: 'all agents at max capacity',
    };
  }

  // AC3: Score eligible agents
  const maxTaskCount = Math.max(
    ...eligible.map((a) => a._count.agentAssignmentLogs),
    1,
  );

  const candidates: AgentScore[] = eligible.map((agent) => {
    const distance =
      agent.currentLat && agent.currentLng
        ? haversineDistance(
            propertyLat,
            propertyLng,
            agent.currentLat,
            agent.currentLng,
          )
        : MAX_DISTANCE_KM;

    const normalizedDistance = Math.min(distance / MAX_DISTANCE_KM, 1);
    const normalizedTaskCount = agent._count.agentAssignmentLogs / maxTaskCount;

    const score =
      DISTANCE_WEIGHT * (1 - normalizedDistance) +
      TASK_COUNT_WEIGHT * (1 - normalizedTaskCount);

    return {
      agentId: agent.id,
      distance: Math.round(distance * 100) / 100,
      taskCount: agent._count.agentAssignmentLogs,
      score: Math.round(score * 1000) / 1000,
    };
  });

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  return {
    candidates,
    selectedAgentId: candidates[0].agentId,
    reason: 'assigned to highest-scoring agent',
  };
}
