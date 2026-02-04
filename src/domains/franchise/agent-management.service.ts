import { PrismaClient } from '@prisma/client';
import { BusinessError } from '../../shared/errors/business-error';
import * as ErrorCodes from '../../shared/errors/error-codes';

/**
 * Story 14-6: Franchise Owner - Local Agent Management
 *
 * City-scoped agent management: recruit, onboard, activate/deactivate,
 * view performance, set capacity, assign zones.
 */
export class AgentManagementService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create/invite a new agent for a city
   */
  async createAgent(params: {
    userId: string;
    cityId: string;
    name: string;
    phone: string;
    photoUrl?: string;
    serviceAreas?: Record<string, any>;
    expertiseTags?: string[];
    maxConcurrentTasks?: number;
  }) {
    try {
      return await this.prisma.agent.create({
        data: {
          userId: params.userId,
          cityId: params.cityId,
          name: params.name,
          phone: params.phone,
          photoUrl: params.photoUrl,
          serviceAreas: params.serviceAreas as any || null,
          expertiseTags: params.expertiseTags || [],
          maxConcurrentTasks: params.maxConcurrentTasks || 10,
          isActive: true,
          trainingCompleted: false,
        },
      });
    } catch (error: any) {
      if (error.code === 'P2002') {
        throw new BusinessError(
          ErrorCodes.BUSINESS_AGENT_NOT_FOUND,
          'An agent with this user ID already exists',
          409
        );
      }
      throw error;
    }
  }

  /**
   * Update agent profile
   */
  async updateAgent(agentId: string, data: {
    name?: string;
    phone?: string;
    photoUrl?: string;
    serviceAreas?: Record<string, any>;
    expertiseTags?: string[];
    maxConcurrentTasks?: number;
  }) {
    return this.prisma.agent.update({
      where: { id: agentId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.phone && { phone: data.phone }),
        ...(data.photoUrl !== undefined && { photoUrl: data.photoUrl }),
        ...(data.serviceAreas !== undefined && { serviceAreas: data.serviceAreas as any }),
        ...(data.expertiseTags !== undefined && { expertiseTags: data.expertiseTags }),
        ...(data.maxConcurrentTasks !== undefined && { maxConcurrentTasks: data.maxConcurrentTasks }),
      },
    });
  }

  /**
   * Activate an agent
   */
  async activateAgent(agentId: string) {
    return this.prisma.agent.update({
      where: { id: agentId },
      data: { isActive: true },
    });
  }

  /**
   * Deactivate an agent (cannot receive new assignments)
   */
  async deactivateAgent(agentId: string) {
    return this.prisma.agent.update({
      where: { id: agentId },
      data: { isActive: false },
    });
  }

  /**
   * List agents for a city with performance data
   */
  async listAgents(cityId: string, filters?: { isActive?: boolean }) {
    return this.prisma.agent.findMany({
      where: {
        cityId,
        ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Get agent details
   */
  async getAgent(agentId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      throw new BusinessError(ErrorCodes.BUSINESS_AGENT_NOT_FOUND, 'Agent not found', 404);
    }

    return agent;
  }

  /**
   * Assign agent to geographic zones within the city
   */
  async assignZones(agentId: string, zones: Record<string, any>) {
    return this.prisma.agent.update({
      where: { id: agentId },
      data: { serviceAreas: zones as any },
    });
  }

  /**
   * Mark training as completed
   */
  async markTrainingCompleted(agentId: string) {
    return this.prisma.agent.update({
      where: { id: agentId },
      data: { trainingCompleted: true },
    });
  }

  /**
   * Get agent count by city
   */
  async getAgentCount(cityId: string): Promise<number> {
    return this.prisma.agent.count({
      where: { cityId, isActive: true },
    });
  }
}
