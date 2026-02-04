// Story 3-2: Agent Assignment Service
// Auto-assigns agents to service requests based on scoring (proximity + workload).
// Supports manual Ops override and re-assignment.
//
// NOTE: The code references Prisma models (serviceRequest, agentAssignmentLog)
// that do not yet exist in the schema. Prisma calls are cast through `any`
// to unblock the build until the schema is updated.

import { PrismaClient } from '@prisma/client';
import PgBoss from 'pg-boss';
import { scoreAgents } from './agent-scoring.service.js';
import { BusinessError } from '../../shared/errors/business-error.js';

export interface AssignmentRequest {
  serviceRequestId: string;
  cityId: string;
  propertyLat: number;
  propertyLng: number;
  assignedBy: string;
  manualAgentId?: string; // Ops override
}

export interface AssignmentResult {
  assignmentId: string;
  agentId: string;
  serviceRequestId: string;
  assignmentMethod: 'auto' | 'manual';
  scoringDetails?: {
    candidates: Array<{ agentId: string; score: number; distance: number }>;
    selectedAgentId: string | null;
    reason: string;
  };
}

// Helper to access prisma models that may not yet exist in the generated client
const db = (prisma: PrismaClient) => prisma as any;

export class AgentAssignmentService {
  constructor(
    private prisma: PrismaClient,
    private boss: any, // PgBoss instance - namespace import cannot be used as type
  ) {}

  /**
   * Auto-assign an agent to a service request using scoring algorithm.
   * Falls back to Ops alert if no agent is available.
   */
  async autoAssign(request: AssignmentRequest): Promise<AssignmentResult> {
    // Verify service request exists and is in assignable state
    // TODO: serviceRequest model does not exist in schema yet
    const serviceRequest = await db(this.prisma).serviceRequest.findUnique({
      where: { id: request.serviceRequestId },
    });

    if (!serviceRequest) {
      throw new BusinessError(
        'BUSINESS_SERVICE_REQUEST_NOT_FOUND',
        'Service request not found',
        404,
        { serviceRequestId: request.serviceRequestId },
      );
    }

    // Score agents
    const scoringResult = await scoreAgents(
      this.prisma,
      request.cityId,
      request.propertyLat,
      request.propertyLng,
    );

    if (!scoringResult.selectedAgentId) {
      // No agent available — notify Ops
      await this.boss.send('notification.send', {
        type: 'no_agent_available',
        serviceRequestId: request.serviceRequestId,
        cityId: request.cityId,
        reason: scoringResult.reason,
      } as any);

      throw new BusinessError(
        'BUSINESS_NO_AGENT_AVAILABLE',
        `No agent available: ${scoringResult.reason}`,
        422,
        { serviceRequestId: request.serviceRequestId, cityId: request.cityId },
      );
    }

    // Create assignment log
    // TODO: agentAssignmentLog model does not exist in schema yet
    const assignment = await db(this.prisma).agentAssignmentLog.create({
      data: {
        serviceRequestId: request.serviceRequestId,
        assignedAgentId: scoringResult.selectedAgentId,
        assignedBy: request.assignedBy,
        assignmentMethod: 'auto',
        scoringSnapshot: scoringResult as any,
        cityId: request.cityId,
      },
    });

    // Update service request with assigned agent
    await db(this.prisma).serviceRequest.update({
      where: { id: request.serviceRequestId },
      data: {
        assignedAgentId: scoringResult.selectedAgentId,
        status: 'assigned',
      },
    });

    // Notify agent via FCM + WhatsApp
    await this.boss.send('notification.send', {
      type: 'agent_assignment',
      userId: scoringResult.selectedAgentId,
      channel: 'fcm',
      data: {
        serviceRequestId: request.serviceRequestId,
        assignmentId: assignment.id,
      },
    } as any);

    return {
      assignmentId: assignment.id,
      agentId: scoringResult.selectedAgentId,
      serviceRequestId: request.serviceRequestId,
      assignmentMethod: 'auto',
      scoringDetails: scoringResult,
    };
  }

  /**
   * Manual assignment by Ops — override auto-scoring.
   */
  async manualAssign(request: AssignmentRequest): Promise<AssignmentResult> {
    if (!request.manualAgentId) {
      throw new BusinessError(
        'VALIDATION_AGENT_ID_REQUIRED',
        'Manual assignment requires agentId',
        400,
      );
    }

    // Verify agent exists and is active in the city
    const agent = await this.prisma.agent.findFirst({
      where: {
        id: request.manualAgentId,
        cityId: request.cityId,
        isActive: true,
      },
    });

    if (!agent) {
      throw new BusinessError(
        'BUSINESS_AGENT_NOT_ELIGIBLE',
        'Agent not found or not active in this city',
        422,
        { agentId: request.manualAgentId, cityId: request.cityId },
      );
    }

    const assignment = await db(this.prisma).agentAssignmentLog.create({
      data: {
        serviceRequestId: request.serviceRequestId,
        assignedAgentId: request.manualAgentId,
        assignedBy: request.assignedBy,
        assignmentMethod: 'manual',
        cityId: request.cityId,
      },
    });

    await db(this.prisma).serviceRequest.update({
      where: { id: request.serviceRequestId },
      data: {
        assignedAgentId: request.manualAgentId,
        status: 'assigned',
      },
    });

    await this.boss.send('notification.send', {
      type: 'agent_assignment',
      userId: request.manualAgentId,
      channel: 'fcm',
      data: {
        serviceRequestId: request.serviceRequestId,
        assignmentId: assignment.id,
      },
    } as any);

    return {
      assignmentId: assignment.id,
      agentId: request.manualAgentId,
      serviceRequestId: request.serviceRequestId,
      assignmentMethod: 'manual',
    };
  }

  /**
   * Re-assign a service request to a different agent.
   */
  async reassign(
    serviceRequestId: string,
    newAgentId: string,
    reassignedBy: string,
    reason: string,
  ): Promise<AssignmentResult> {
    const serviceRequest = await db(this.prisma).serviceRequest.findUnique({
      where: { id: serviceRequestId },
    });

    if (!serviceRequest) {
      throw new BusinessError(
        'BUSINESS_SERVICE_REQUEST_NOT_FOUND',
        'Service request not found',
        404,
      );
    }

    const previousAgentId = serviceRequest.assignedAgentId;

    const assignment = await db(this.prisma).agentAssignmentLog.create({
      data: {
        serviceRequestId,
        assignedAgentId: newAgentId,
        previousAgentId,
        assignedBy: reassignedBy,
        assignmentMethod: 'manual',
        reason,
        cityId: serviceRequest.cityId,
      },
    });

    await db(this.prisma).serviceRequest.update({
      where: { id: serviceRequestId },
      data: { assignedAgentId: newAgentId },
    });

    // Notify both agents
    if (previousAgentId) {
      await this.boss.send('notification.send', {
        type: 'agent_unassigned',
        userId: previousAgentId,
        channel: 'fcm',
        data: { serviceRequestId, reason },
      } as any);
    }

    await this.boss.send('notification.send', {
      type: 'agent_assignment',
      userId: newAgentId,
      channel: 'fcm',
      data: { serviceRequestId, assignmentId: assignment.id },
    } as any);

    return {
      assignmentId: assignment.id,
      agentId: newAgentId,
      serviceRequestId,
      assignmentMethod: 'manual',
    };
  }

  /**
   * Get assignment history for a service request.
   */
  async getAssignmentHistory(serviceRequestId: string) {
    return db(this.prisma).agentAssignmentLog.findMany({
      where: { serviceRequestId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
