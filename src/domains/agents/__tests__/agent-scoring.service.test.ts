/**
 * Tests for scoreAgents function (agent-scoring.service.ts)
 * Stories 3-2 AC2, AC3: Agent eligibility (city, active, below max tasks)
 * and scoring formula (0.6 * proximity + 0.4 * availability).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scoreAgents } from '../agent-scoring.service';
import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Mock Prisma factory
// ---------------------------------------------------------------------------
function createMockPrisma() {
  return {
    agent: {
      findMany: vi.fn(),
    },
  } as unknown as PrismaClient;
}

// Property location for all tests (Lucknow, UP)
const PROPERTY_LAT = 26.8467;
const PROPERTY_LNG = 80.9462;
const CITY_ID = 'city-001';

describe('scoreAgents', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    vi.clearAllMocks();
  });

  // ============================================================
  // No agents available
  // ============================================================

  it('returns no selectedAgentId when no agents exist in city', async () => {
    (mockPrisma.agent.findMany as any).mockResolvedValue([]);

    const result = await scoreAgents(mockPrisma, CITY_ID, PROPERTY_LAT, PROPERTY_LNG);

    expect(result.selectedAgentId).toBeNull();
    expect(result.candidates).toHaveLength(0);
    expect(result.reason).toBe('no eligible agents in city');
  });

  // ============================================================
  // All agents at max capacity
  // ============================================================

  it('returns no selectedAgentId when all agents are at max capacity', async () => {
    const agents = [
      {
        id: 'agent-001',
        currentLat: 26.85,
        currentLng: 80.95,
        maxConcurrentTasks: 3,
        _count: { agentAssignmentLogs: 3 },
      },
      {
        id: 'agent-002',
        currentLat: 26.84,
        currentLng: 80.94,
        maxConcurrentTasks: 2,
        _count: { agentAssignmentLogs: 2 },
      },
    ];
    (mockPrisma.agent.findMany as any).mockResolvedValue(agents);

    const result = await scoreAgents(mockPrisma, CITY_ID, PROPERTY_LAT, PROPERTY_LNG);

    expect(result.selectedAgentId).toBeNull();
    expect(result.reason).toBe('all agents at max capacity');
    expect(result.candidates).toHaveLength(2);
  });

  // ============================================================
  // Successful agent selection
  // ============================================================

  it('selects the highest-scoring agent when agents are available', async () => {
    const agents = [
      {
        id: 'agent-001',
        currentLat: 26.8467, // Very close to property
        currentLng: 80.9462,
        maxConcurrentTasks: 5,
        _count: { agentAssignmentLogs: 0 }, // No current tasks
      },
      {
        id: 'agent-002',
        currentLat: 27.2,    // Farther from property
        currentLng: 81.5,
        maxConcurrentTasks: 5,
        _count: { agentAssignmentLogs: 3 }, // 3 current tasks
      },
    ];
    (mockPrisma.agent.findMany as any).mockResolvedValue(agents);

    const result = await scoreAgents(mockPrisma, CITY_ID, PROPERTY_LAT, PROPERTY_LNG);

    expect(result.selectedAgentId).not.toBeNull();
    // agent-001 is closer AND has fewer tasks, should win
    expect(result.selectedAgentId).toBe('agent-001');
    expect(result.reason).toBe('assigned to highest-scoring agent');
  });

  it('returns scored candidates sorted by score descending', async () => {
    const agents = [
      {
        id: 'agent-far',
        currentLat: 28.0, // Much farther
        currentLng: 82.0,
        maxConcurrentTasks: 5,
        _count: { agentAssignmentLogs: 2 },
      },
      {
        id: 'agent-near',
        currentLat: 26.85, // Close
        currentLng: 80.95,
        maxConcurrentTasks: 5,
        _count: { agentAssignmentLogs: 0 },
      },
    ];
    (mockPrisma.agent.findMany as any).mockResolvedValue(agents);

    const result = await scoreAgents(mockPrisma, CITY_ID, PROPERTY_LAT, PROPERTY_LNG);

    expect(result.candidates.length).toBeGreaterThan(0);
    // Candidates should be sorted by score descending
    for (let i = 1; i < result.candidates.length; i++) {
      expect(result.candidates[i - 1].score).toBeGreaterThanOrEqual(result.candidates[i].score);
    }
  });

  it('assigns MAX_DISTANCE_KM to agents without GPS coordinates', async () => {
    const agents = [
      {
        id: 'agent-no-gps',
        currentLat: null,
        currentLng: null,
        maxConcurrentTasks: 5,
        _count: { agentAssignmentLogs: 0 },
      },
    ];
    (mockPrisma.agent.findMany as any).mockResolvedValue(agents);

    const result = await scoreAgents(mockPrisma, CITY_ID, PROPERTY_LAT, PROPERTY_LNG);

    expect(result.selectedAgentId).toBe('agent-no-gps');
    // Score should be 0.4 (only availability component since distance penalty is max)
    // DISTANCE_WEIGHT * (1 - 1.0) + TASK_COUNT_WEIGHT * (1 - 0) = 0 + 0.4 = 0.4
    expect(result.candidates[0].score).toBeCloseTo(0.4, 2);
    expect(result.candidates[0].distance).toBe(50); // MAX_DISTANCE_KM
  });

  // ============================================================
  // Score values and formula verification
  // ============================================================

  it('scores a nearby agent with no tasks close to 1.0', async () => {
    const agents = [
      {
        id: 'agent-ideal',
        currentLat: PROPERTY_LAT,  // Same location as property
        currentLng: PROPERTY_LNG,
        maxConcurrentTasks: 5,
        _count: { agentAssignmentLogs: 0 },
      },
    ];
    (mockPrisma.agent.findMany as any).mockResolvedValue(agents);

    const result = await scoreAgents(mockPrisma, CITY_ID, PROPERTY_LAT, PROPERTY_LNG);

    expect(result.selectedAgentId).toBe('agent-ideal');
    // Distance ~0, tasks = 0 → score ≈ 0.6 * 1 + 0.4 * 1 = 1.0
    expect(result.candidates[0].score).toBeCloseTo(1.0, 1);
  });

  it('queries only active agents in the specified city', async () => {
    (mockPrisma.agent.findMany as any).mockResolvedValue([]);

    await scoreAgents(mockPrisma, CITY_ID, PROPERTY_LAT, PROPERTY_LNG);

    expect(mockPrisma.agent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cityId: CITY_ID, isActive: true },
      }),
    );
  });

  // ============================================================
  // Filtering out ineligible agents (at max capacity)
  // ============================================================

  it('filters out agents at max capacity and selects from eligible ones', async () => {
    const agents = [
      {
        id: 'agent-full',
        currentLat: 26.85,
        currentLng: 80.95,
        maxConcurrentTasks: 2,
        _count: { agentAssignmentLogs: 2 }, // At max
      },
      {
        id: 'agent-available',
        currentLat: 26.85,
        currentLng: 80.95,
        maxConcurrentTasks: 3,
        _count: { agentAssignmentLogs: 1 }, // Below max
      },
    ];
    (mockPrisma.agent.findMany as any).mockResolvedValue(agents);

    const result = await scoreAgents(mockPrisma, CITY_ID, PROPERTY_LAT, PROPERTY_LNG);

    expect(result.selectedAgentId).toBe('agent-available');
    // Only eligible candidates returned
    expect(result.candidates.every((c) => c.agentId !== 'agent-full')).toBe(true);
  });

  // ============================================================
  // Single eligible agent
  // ============================================================

  it('selects the only available agent when there is exactly one', async () => {
    const agents = [
      {
        id: 'sole-agent',
        currentLat: 26.9,
        currentLng: 81.0,
        maxConcurrentTasks: 5,
        _count: { agentAssignmentLogs: 1 },
      },
    ];
    (mockPrisma.agent.findMany as any).mockResolvedValue(agents);

    const result = await scoreAgents(mockPrisma, CITY_ID, PROPERTY_LAT, PROPERTY_LNG);

    expect(result.selectedAgentId).toBe('sole-agent');
    expect(result.candidates).toHaveLength(1);
  });
});
