import { PrismaClient } from '@prisma/client';
import { customStepsSchema, conditionalRuleSchema, ProcessStep, ConditionalRule } from './franchise.types';
import { BusinessError } from '../../shared/errors/business-error';
import * as ErrorCodes from '../../shared/errors/error-codes';
import { z } from 'zod';

/**
 * Story 14-3: City-Specific Government Process Configuration
 *
 * Allows Franchise Owners to override service definition steps per city.
 * Supports conditional steps based on property type or other criteria.
 * Changes require Super Admin approval before activation.
 * The workflow engine reads city-specific process definitions when creating service instances.
 */
export class CityProcessOverrideService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a city-specific process override
   */
  async createProcessOverride(params: {
    cityId: string;
    serviceDefinitionId: string;
    customSteps: { steps: ProcessStep[] };
    conditionalRules?: ConditionalRule[];
    createdBy: string;
  }) {
    customStepsSchema.parse(params.customSteps);
    if (params.conditionalRules) {
      z.array(conditionalRuleSchema).parse(params.conditionalRules);
    }

    // Get the next version number for this city+service combination
    const existing = await this.prisma.cityProcessOverride.findMany({
      where: {
        cityId: params.cityId,
        serviceDefinitionId: params.serviceDefinitionId,
      },
      orderBy: { version: 'desc' },
      take: 1,
    });

    const nextVersion = existing.length > 0 ? existing[0].version + 1 : 1;

    return this.prisma.cityProcessOverride.create({
      data: {
        cityId: params.cityId,
        serviceDefinitionId: params.serviceDefinitionId,
        customSteps: params.customSteps as any,
        conditionalRules: params.conditionalRules as any || null,
        version: nextVersion,
        approvalStatus: 'pending_approval',
        createdBy: params.createdBy,
      },
    });
  }

  /**
   * Approve a process override (Super Admin only)
   */
  async approveProcessOverride(overrideId: string, approvedBy: string) {
    const override = await this.prisma.cityProcessOverride.findUnique({
      where: { id: overrideId },
    });

    if (!override) {
      throw new BusinessError(
        ErrorCodes.BUSINESS_CITY_NOT_FOUND,
        'Process override not found',
        404
      );
    }

    if (override.approvalStatus !== 'pending_approval') {
      throw new BusinessError(
        ErrorCodes.BUSINESS_PROCESS_PENDING_APPROVAL,
        `Cannot approve override with status: ${override.approvalStatus}`,
        422
      );
    }

    // Deactivate any existing active override for same city+service
    await this.prisma.cityProcessOverride.updateMany({
      where: {
        cityId: override.cityId,
        serviceDefinitionId: override.serviceDefinitionId,
        isActive: true,
        id: { not: overrideId },
      },
      data: { isActive: false },
    });

    // Activate the approved override
    return this.prisma.cityProcessOverride.update({
      where: { id: overrideId },
      data: {
        approvalStatus: 'approved',
        approvedBy,
        approvedAt: new Date(),
        isActive: true,
      },
    });
  }

  /**
   * Reject a process override (Super Admin only)
   */
  async rejectProcessOverride(overrideId: string, approvedBy: string, reason: string) {
    return this.prisma.cityProcessOverride.update({
      where: { id: overrideId },
      data: {
        approvalStatus: 'rejected',
        approvedBy,
        approvedAt: new Date(),
      },
    });
  }

  /**
   * Get the active process override for a city + service
   * Used by the workflow engine when creating service instances
   */
  async getActiveProcessOverride(cityId: string, serviceDefinitionId: string) {
    return this.prisma.cityProcessOverride.findFirst({
      where: {
        cityId,
        serviceDefinitionId,
        isActive: true,
        approvalStatus: 'approved',
      },
      orderBy: { version: 'desc' },
    });
  }

  /**
   * Get process steps including conditional steps based on context
   */
  async getProcessSteps(
    cityId: string,
    serviceDefinitionId: string,
    context?: Record<string, string>
  ): Promise<ProcessStep[]> {
    const override = await this.getActiveProcessOverride(cityId, serviceDefinitionId);

    if (!override) {
      return []; // Fallback to default service definition steps
    }

    const customSteps = override.customSteps as unknown as { steps: ProcessStep[] };
    let steps = [...customSteps.steps];

    // Apply conditional rules
    if (override.conditionalRules && context) {
      const rules = override.conditionalRules as unknown as ConditionalRule[];
      for (const rule of rules) {
        if (evaluateCondition(rule.condition, context)) {
          steps = [...steps, ...rule.additionalSteps];
        }
      }
    }

    // Sort by sortOrder
    steps.sort((a, b) => a.sortOrder - b.sortOrder);
    return steps;
  }

  /**
   * List all overrides for a city (pending and approved)
   */
  async listProcessOverrides(cityId: string) {
    return this.prisma.cityProcessOverride.findMany({
      where: { cityId },
      orderBy: [
        { serviceDefinitionId: 'asc' },
        { version: 'desc' },
      ],
    });
  }

  /**
   * List pending approvals (Super Admin)
   */
  async listPendingApprovals() {
    return this.prisma.cityProcessOverride.findMany({
      where: { approvalStatus: 'pending_approval' },
      include: { city: { select: { cityName: true, state: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }
}

/**
 * Simple condition evaluator for conditional process steps
 * Supports: "property_type == agricultural", "property_value > 5000000"
 */
function evaluateCondition(condition: string, context: Record<string, string>): boolean {
  const parts = condition.split(/\s+/);
  if (parts.length !== 3) return false;

  const [field, operator, value] = parts;
  const contextValue = context[field];
  if (contextValue === undefined) return false;

  switch (operator) {
    case '==':
      return contextValue === value;
    case '!=':
      return contextValue !== value;
    case '>':
      return Number(contextValue) > Number(value);
    case '<':
      return Number(contextValue) < Number(value);
    case '>=':
      return Number(contextValue) >= Number(value);
    case '<=':
      return Number(contextValue) <= Number(value);
    default:
      return false;
  }
}
