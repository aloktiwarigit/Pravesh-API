import { PrismaClient } from '@prisma/client';
import { quizDataSchema, QuizData } from './franchise.types';
import { BusinessError } from '../../shared/errors/business-error';
import * as ErrorCodes from '../../shared/errors/error-codes';

/**
 * Story 14-15: Agent Training Modules per City
 *
 * City-specific training content: videos, PDFs, quizzes.
 * Organized into learning paths.
 * Agents must score >80% on mandatory modules to unlock task assignment.
 * Platform-wide modules (cityId = null) apply to all cities.
 */

const MIN_PASSING_SCORE = 80;

export class TrainingModuleService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a training module
   */
  async createModule(params: {
    cityId?: string;
    moduleName: string;
    description?: string;
    contentType: 'video' | 'pdf' | 'quiz';
    contentUrl?: string;
    quizData?: QuizData;
    learningPath?: string;
    isMandatory: boolean;
    sortOrder?: number;
    createdBy: string;
  }) {
    if (params.contentType === 'quiz' && params.quizData) {
      quizDataSchema.parse(params.quizData);
    }

    return this.prisma.trainingModule.create({
      data: {
        cityId: params.cityId || null,
        moduleName: params.moduleName,
        description: params.description,
        contentType: params.contentType,
        contentUrl: params.contentUrl,
        quizData: params.quizData as any || null,
        learningPath: params.learningPath,
        isMandatory: params.isMandatory,
        sortOrder: params.sortOrder || 0,
        createdBy: params.createdBy,
      },
    });
  }

  /**
   * Get modules for a city (includes platform-wide modules)
   */
  async getModulesForCity(cityId: string) {
    return this.prisma.trainingModule.findMany({
      where: {
        isActive: true,
        OR: [
          { cityId },
          { cityId: null }, // Platform-wide modules
        ],
      },
      orderBy: [
        { learningPath: 'asc' },
        { sortOrder: 'asc' },
      ],
    });
  }

  /**
   * Get learning paths for a city
   */
  async getLearningPaths(cityId: string) {
    const modules = await this.getModulesForCity(cityId);
    const paths: Record<string, typeof modules> = {};

    for (const module of modules) {
      const path = module.learningPath || 'General';
      if (!paths[path]) paths[path] = [];
      paths[path].push(module);
    }

    return paths;
  }

  /**
   * Submit quiz results
   */
  async submitQuizResult(agentId: string, moduleId: string, score: number) {
    const module = await this.prisma.trainingModule.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      throw new BusinessError(ErrorCodes.BUSINESS_CITY_NOT_FOUND, 'Training module not found', 404);
    }

    const passed = score >= MIN_PASSING_SCORE;

    const progress = await this.prisma.trainingProgress.upsert({
      where: {
        agentId_trainingModuleId: {
          agentId,
          trainingModuleId: moduleId,
        },
      },
      update: {
        quizScore: score,
        status: passed ? 'completed' : 'in_progress',
        completedAt: passed ? new Date() : null,
      },
      create: {
        agentId,
        trainingModuleId: moduleId,
        quizScore: score,
        status: passed ? 'completed' : 'in_progress',
        completedAt: passed ? new Date() : null,
      },
    });

    if (!passed && module.isMandatory) {
      throw new BusinessError(
        ErrorCodes.BUSINESS_TRAINING_SCORE_TOO_LOW,
        `Score ${score}% is below the required ${MIN_PASSING_SCORE}%. Please retry.`,
        422,
        { score, requiredScore: MIN_PASSING_SCORE }
      );
    }

    // Check if all mandatory modules are completed for this agent
    await this.checkAndUpdateTrainingStatus(agentId);

    return progress;
  }

  /**
   * Mark a non-quiz module as completed (video watched, PDF read)
   */
  async markModuleCompleted(agentId: string, moduleId: string) {
    const progress = await this.prisma.trainingProgress.upsert({
      where: {
        agentId_trainingModuleId: {
          agentId,
          trainingModuleId: moduleId,
        },
      },
      update: {
        status: 'completed',
        completedAt: new Date(),
      },
      create: {
        agentId,
        trainingModuleId: moduleId,
        status: 'completed',
        completedAt: new Date(),
      },
    });

    await this.checkAndUpdateTrainingStatus(agentId);
    return progress;
  }

  /**
   * Get training progress for an agent
   */
  async getAgentProgress(agentId: string, cityId: string) {
    const modules = await this.getModulesForCity(cityId);
    const progress = await this.prisma.trainingProgress.findMany({
      where: { agentId },
    });

    const progressMap = new Map(progress.map((p) => [p.trainingModuleId, p]));

    return modules.map((module) => {
      const p = progressMap.get(module.id);
      return {
        moduleId: module.id,
        moduleName: module.moduleName,
        contentType: module.contentType,
        isMandatory: module.isMandatory,
        learningPath: module.learningPath,
        status: p?.status || 'not_started',
        quizScore: p?.quizScore || null,
        completedAt: p?.completedAt?.toISOString() || null,
      };
    });
  }

  /**
   * Get training completion dashboard for Franchise Owner
   */
  async getTrainingDashboard(cityId: string) {
    const agents = await this.prisma.agent.findMany({
      where: { cityId, isActive: true },
      select: { id: true, name: true, trainingCompleted: true },
    });

    const totalAgents = agents.length;
    const completedAgents = agents.filter((a) => a.trainingCompleted).length;

    return {
      totalAgents,
      completedAgents,
      completionPercentage: totalAgents > 0 ? Math.round((completedAgents / totalAgents) * 100) : 0,
      agents: agents.map((a) => ({
        agentId: a.id,
        name: a.name,
        trainingCompleted: a.trainingCompleted,
      })),
    };
  }

  /**
   * Check if all mandatory modules are completed and update agent status
   */
  private async checkAndUpdateTrainingStatus(agentId: string) {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) return;

    const mandatoryModules = await this.prisma.trainingModule.findMany({
      where: {
        isActive: true,
        isMandatory: true,
        OR: [
          { cityId: agent.cityId },
          { cityId: null },
        ],
      },
    });

    const completedProgress = await this.prisma.trainingProgress.findMany({
      where: {
        agentId,
        status: 'completed',
        trainingModuleId: { in: mandatoryModules.map((m) => m.id) },
      },
    });

    const allMandatoryCompleted = completedProgress.length >= mandatoryModules.length;

    if (allMandatoryCompleted && !agent.trainingCompleted) {
      await this.prisma.agent.update({
        where: { id: agentId },
        data: { trainingCompleted: true },
      });
    }
  }
}
