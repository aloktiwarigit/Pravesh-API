/**
 * Tests for AgentAssignmentService
 * Story 3-2: Auto-assign and manual assign agents to service requests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AgentAssignmentService, AssignmentRequest } from '../agent-assignment.service';
import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Mock agent-scoring.service (scoreAgents)
// ---------------------------------------------------------------------------
vi.mock('../agent-scoring.service.js', () => ({
  scoreAgents: vi.fn(),
}));

import { scoreAgents } from '../agent-scoring.service.js';

// ---------------------------------------------------------------------------
// Mock Prisma factory
// ---------------------------------------------------------------------------
function createMockPrisma() {
  return {
    serviceRequest: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    agent: {
      findFirst: vi.fn(),
    },
    agentAssignmentLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  } as unknown as PrismaClient;
}

function createMockBoss() {
  return {
    send: vi.fn().mockResolvedValue(undefined),
  };
}

describe('AgentAssignmentService', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockBoss: ReturnType<typeof createMockBoss>;
  let service: AgentAssignmentService;

  const validRequest: AssignmentRequest = {
    serviceRequestId: 'sr-001',
    cityId: 'city-001',
    propertyLat: 26.8467,
    propertyLng: 80.9462,
    assignedBy: 'system',
  };

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockBoss = createMockBoss();
    service = new AgentAssignmentService(mockPrisma, mockBoss);
    vi.clearAllMocks();
  });

  // ===========================================================================
  // autoAssign
  // ===========================================================================

  describe('autoAssign', () => {
    it('assigns the selected agent from scoring and updates service request', async () => {
      const serviceRequest = { id: 'sr-001', cityId: 'city-001' };
      const assignment = { id: 'assign-001', serviceRequestId: 'sr-001', assignedAgentId: 'agent-001' };
      const scoringResult = {
        selectedAgentId: 'agent-001',
        reason: 'assigned to highest-scoring agent',
        candidates: [{ agentId: 'agent-001', score: 0.9, distance: 1.5 }],
      };

      (mockPrisma.serviceRequest.findUnique as any).mockResolvedValue(serviceRequest);
      (scoreAgents as any).mockResolvedValue(scoringResult);
      (mockPrisma.agentAssignmentLog.create as any).mockResolvedValue(assignment);
      (mockPrisma.serviceRequest.update as any).mockResolvedValue({});

      const result = await service.autoAssign(validRequest);

      expect(result.agentId).toBe('agent-001');
      expect(result.assignmentMethod).toBe('auto');
      expect(result.assignmentId).toBe('assign-001');

      expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sr-001' },
          data: expect.objectContaining({
            assignedAgentId: 'agent-001',
            status: 'assigned',
          }),
        }),
      );
    });

    it('sends FCM notification to assigned agent', async () => {
      const serviceRequest = { id: 'sr-001', cityId: 'city-001' };
      const assignment = { id: 'assign-001' };
      const scoringResult = {
        selectedAgentId: 'agent-001',
        reason: 'assigned to highest-scoring agent',
        candidates: [],
      };

      (mockPrisma.serviceRequest.findUnique as any).mockResolvedValue(serviceRequest);
      (scoreAgents as any).mockResolvedValue(scoringResult);
      (mockPrisma.agentAssignmentLog.create as any).mockResolvedValue(assignment);
      (mockPrisma.serviceRequest.update as any).mockResolvedValue({});

      await service.autoAssign(validRequest);

      expect(mockBoss.send).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({
          type: 'agent_assignment',
          userId: 'agent-001',
          channel: 'fcm',
        }),
      );
    });

    it('throws BUSINESS_NO_AGENT_AVAILABLE and notifies Ops when no agent is available', async () => {
      const serviceRequest = { id: 'sr-001', cityId: 'city-001' };
      const scoringResult = {
        selectedAgentId: null,
        reason: 'all agents at max capacity',
        candidates: [],
      };

      (mockPrisma.serviceRequest.findUnique as any).mockResolvedValue(serviceRequest);
      (scoreAgents as any).mockResolvedValue(scoringResult);

      await expect(service.autoAssign(validRequest)).rejects.toMatchObject({
        code: 'BUSINESS_NO_AGENT_AVAILABLE',
        statusCode: 422,
      });

      // Should have sent Ops notification
      expect(mockBoss.send).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({
          type: 'no_agent_available',
          serviceRequestId: 'sr-001',
        }),
      );
    });

    it('throws BUSINESS_SERVICE_REQUEST_NOT_FOUND when service request does not exist', async () => {
      (mockPrisma.serviceRequest.findUnique as any).mockResolvedValue(null);

      await expect(service.autoAssign(validRequest)).rejects.toMatchObject({
        code: 'BUSINESS_SERVICE_REQUEST_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('creates assignment log with auto method and scoring snapshot', async () => {
      const serviceRequest = { id: 'sr-001', cityId: 'city-001' };
      const scoringResult = {
        selectedAgentId: 'agent-001',
        reason: 'assigned to highest-scoring agent',
        candidates: [{ agentId: 'agent-001', score: 0.9, distance: 1.5 }],
      };

      (mockPrisma.serviceRequest.findUnique as any).mockResolvedValue(serviceRequest);
      (scoreAgents as any).mockResolvedValue(scoringResult);
      (mockPrisma.agentAssignmentLog.create as any).mockResolvedValue({ id: 'assign-001' });
      (mockPrisma.serviceRequest.update as any).mockResolvedValue({});

      await service.autoAssign(validRequest);

      expect(mockPrisma.agentAssignmentLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            serviceRequestId: 'sr-001',
            assignedAgentId: 'agent-001',
            assignmentMethod: 'auto',
            cityId: 'city-001',
            scoringSnapshot: expect.objectContaining({ selectedAgentId: 'agent-001' }),
          }),
        }),
      );
    });
  });

  // ===========================================================================
  // manualAssign
  // ===========================================================================

  describe('manualAssign', () => {
    const manualRequest: AssignmentRequest = {
      ...validRequest,
      assignedBy: 'ops-001',
      manualAgentId: 'agent-002',
    };

    it('manually assigns an agent when agent is active in city', async () => {
      const agent = { id: 'agent-002', cityId: 'city-001', isActive: true };
      const assignment = { id: 'assign-002', serviceRequestId: 'sr-001', assignedAgentId: 'agent-002' };

      (mockPrisma.agent.findFirst as any).mockResolvedValue(agent);
      (mockPrisma.agentAssignmentLog.create as any).mockResolvedValue(assignment);
      (mockPrisma.serviceRequest.update as any).mockResolvedValue({});

      const result = await service.manualAssign(manualRequest);

      expect(result.agentId).toBe('agent-002');
      expect(result.assignmentMethod).toBe('manual');
    });

    it('updates service request with manually assigned agent', async () => {
      const agent = { id: 'agent-002', cityId: 'city-001', isActive: true };
      (mockPrisma.agent.findFirst as any).mockResolvedValue(agent);
      (mockPrisma.agentAssignmentLog.create as any).mockResolvedValue({ id: 'assign-002' });
      (mockPrisma.serviceRequest.update as any).mockResolvedValue({});

      await service.manualAssign(manualRequest);

      expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sr-001' },
          data: expect.objectContaining({
            assignedAgentId: 'agent-002',
            status: 'assigned',
          }),
        }),
      );
    });

    it('throws VALIDATION_AGENT_ID_REQUIRED when manualAgentId is not provided', async () => {
      const requestWithoutAgent: AssignmentRequest = { ...validRequest };

      await expect(service.manualAssign(requestWithoutAgent)).rejects.toMatchObject({
        code: 'VALIDATION_AGENT_ID_REQUIRED',
        statusCode: 400,
      });
    });

    it('throws BUSINESS_AGENT_NOT_ELIGIBLE when agent is not active in city', async () => {
      (mockPrisma.agent.findFirst as any).mockResolvedValue(null);

      await expect(service.manualAssign(manualRequest)).rejects.toMatchObject({
        code: 'BUSINESS_AGENT_NOT_ELIGIBLE',
        statusCode: 422,
      });
    });

    it('verifies agent is in the correct city', async () => {
      (mockPrisma.agent.findFirst as any).mockResolvedValue(null);

      await expect(service.manualAssign(manualRequest)).rejects.toBeDefined();

      expect(mockPrisma.agent.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: 'agent-002',
            cityId: 'city-001',
            isActive: true,
          },
        }),
      );
    });
  });

  // ===========================================================================
  // reassign
  // ===========================================================================

  describe('reassign', () => {
    it('reassigns to a new agent and notifies both agents', async () => {
      const serviceRequest = {
        id: 'sr-001',
        cityId: 'city-001',
        assignedAgentId: 'agent-001', // Previous agent
      };
      const assignment = { id: 'reassign-001', serviceRequestId: 'sr-001', assignedAgentId: 'agent-002' };

      (mockPrisma.serviceRequest.findUnique as any).mockResolvedValue(serviceRequest);
      (mockPrisma.agentAssignmentLog.create as any).mockResolvedValue(assignment);
      (mockPrisma.serviceRequest.update as any).mockResolvedValue({});

      const result = await service.reassign('sr-001', 'agent-002', 'ops-001', 'Agent requested reassignment');

      expect(result.agentId).toBe('agent-002');
      expect(result.assignmentMethod).toBe('manual');

      // Should notify previous agent of unassignment
      expect(mockBoss.send).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({
          type: 'agent_unassigned',
          userId: 'agent-001',
        }),
      );
      // Should notify new agent of assignment
      expect(mockBoss.send).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({
          type: 'agent_assignment',
          userId: 'agent-002',
        }),
      );
    });

    it('only notifies new agent when no previous agent was assigned', async () => {
      const serviceRequest = {
        id: 'sr-001',
        cityId: 'city-001',
        assignedAgentId: null, // No previous agent
      };
      (mockPrisma.serviceRequest.findUnique as any).mockResolvedValue(serviceRequest);
      (mockPrisma.agentAssignmentLog.create as any).mockResolvedValue({ id: 'reassign-001' });
      (mockPrisma.serviceRequest.update as any).mockResolvedValue({});

      await service.reassign('sr-001', 'agent-002', 'ops-001', 'First assignment via reassign');

      // Should NOT send agent_unassigned notification
      const unassignedCalls = (mockBoss.send as any).mock.calls.filter(
        (call: any[]) => call[1]?.type === 'agent_unassigned',
      );
      expect(unassignedCalls).toHaveLength(0);

      // Should still notify the new agent
      expect(mockBoss.send).toHaveBeenCalledWith(
        'notification.send',
        expect.objectContaining({ type: 'agent_assignment', userId: 'agent-002' }),
      );
    });

    it('throws BUSINESS_SERVICE_REQUEST_NOT_FOUND when service request does not exist', async () => {
      (mockPrisma.serviceRequest.findUnique as any).mockResolvedValue(null);

      await expect(
        service.reassign('nonexistent', 'agent-002', 'ops-001', 'reason'),
      ).rejects.toMatchObject({
        code: 'BUSINESS_SERVICE_REQUEST_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('records the previous agent in the assignment log', async () => {
      const serviceRequest = {
        id: 'sr-001',
        cityId: 'city-001',
        assignedAgentId: 'agent-001',
      };
      (mockPrisma.serviceRequest.findUnique as any).mockResolvedValue(serviceRequest);
      (mockPrisma.agentAssignmentLog.create as any).mockResolvedValue({ id: 'reassign-001' });
      (mockPrisma.serviceRequest.update as any).mockResolvedValue({});

      await service.reassign('sr-001', 'agent-002', 'ops-001', 'Performance issue');

      expect(mockPrisma.agentAssignmentLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            previousAgentId: 'agent-001',
            assignedAgentId: 'agent-002',
            reason: 'Performance issue',
          }),
        }),
      );
    });
  });

  // ===========================================================================
  // getAssignmentHistory
  // ===========================================================================

  describe('getAssignmentHistory', () => {
    it('returns assignment history for a service request', async () => {
      const history = [
        { id: 'log-001', serviceRequestId: 'sr-001', assignedAgentId: 'agent-001' },
        { id: 'log-002', serviceRequestId: 'sr-001', assignedAgentId: 'agent-002' },
      ];
      (mockPrisma.agentAssignmentLog.findMany as any).mockResolvedValue(history);

      const result = await service.getAssignmentHistory('sr-001');

      expect(result).toHaveLength(2);
      expect(mockPrisma.agentAssignmentLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { serviceRequestId: 'sr-001' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });
  });
});
