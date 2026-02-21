/**
 * Customer Services Service
 * Business logic for customer-facing service lifecycle operations.
 */

import { PrismaClient } from '@prisma/client';
import { BusinessError } from '../../shared/errors/business-error';

export class CustomerServicesService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * List customer's active ServiceInstances with related data.
   */
  async getMyServices(customerId: string) {
    const instances = await this.prisma.serviceInstance.findMany({
      where: {
        customerId,
        state: { notIn: ['cancelled'] },
      },
      include: {
        serviceDefinition: { select: { id: true, code: true, name: true, category: true, definition: true } },
        serviceRequests: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, requestNumber: true, status: true, paymentStatus: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const services = instances.map((inst) => {
      const def = inst.serviceDefinition.definition as any;
      const req = inst.serviceRequests[0];
      return {
        id: inst.id,
        requestNumber: req?.requestNumber ?? null,
        serviceRequestId: req?.id ?? null,
        currentState: inst.state,
        serviceNameEn: inst.serviceDefinition.name,
        serviceNameHi: inst.serviceDefinition.name,
        propertyAddress: inst.propertyAddress,
        propertyType: inst.propertyType,
        agentName: null,
        slaDeadline: inst.slaDeadline?.toISOString() ?? null,
        amountPaidPaise: inst.propertyValuePaise?.toString() ?? null,
        category: inst.serviceDefinition.category,
        paymentStatus: req?.paymentStatus ?? null,
        createdAt: inst.createdAt.toISOString(),
        updatedAt: inst.updatedAt.toISOString(),
      };
    });

    return { services };
  }

  /**
   * Get service recommendations based on filters.
   */
  async getRecommendations(filters: {
    propertyType?: string;
    ownershipStatus?: string;
    category?: string;
  }) {
    const where: any = { isActive: true };
    if (filters.category) where.category = filters.category;

    const definitions = await this.prisma.serviceDefinition.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return definitions.map((d) => {
      const def = d.definition as any;
      return {
        id: d.id,
        slug: d.code,
        nameEn: d.name,
        nameHi: d.name,
        baseFeePaise: def?.estimatedFees ?? null,
        propertyTypes: def?.propertyTypes ?? [],
        requiredDocuments: def?.requiredDocuments ?? [],
        tags: def?.tags ?? [],
        estimatedDaysTotal: def?.estimatedDaysTotal ?? null,
      };
    });
  }

  /**
   * Get a single ServiceInstance by ID with ownership check.
   */
  async getServiceById(id: string, customerId: string) {
    const instance = await this.prisma.serviceInstance.findUnique({
      where: { id },
      include: {
        serviceDefinition: true,
        serviceRequests: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, requestNumber: true, status: true },
        },
      },
    });

    if (!instance) {
      throw new BusinessError('SERVICE_NOT_FOUND', 'Service not found', 404);
    }

    if (instance.customerId !== customerId) {
      throw new BusinessError('FORBIDDEN', 'Not your service', 403);
    }

    const def = instance.serviceDefinition.definition as any;
    const req = instance.serviceRequests[0];

    return {
      id: instance.id,
      currentState: instance.state,
      currentStepIndex: instance.currentStepIndex,
      serviceNameEn: instance.serviceDefinition.name,
      serviceNameHi: instance.serviceDefinition.name,
      propertyAddress: instance.propertyAddress,
      propertyType: instance.propertyType,
      slaDeadline: instance.slaDeadline?.toISOString() ?? null,
      requestNumber: req?.requestNumber ?? null,
      createdAt: instance.createdAt.toISOString(),
      updatedAt: instance.updatedAt.toISOString(),
      serviceDefinition: {
        id: instance.serviceDefinition.id,
        code: instance.serviceDefinition.code,
        name: instance.serviceDefinition.name,
        category: instance.serviceDefinition.category,
        definition: instance.serviceDefinition.definition,
      },
    };
  }

  /**
   * Cancel a service instance.
   */
  async cancelService(id: string, customerId: string, reason: string) {
    const instance = await this.prisma.serviceInstance.findUnique({
      where: { id },
    });

    if (!instance) {
      throw new BusinessError('SERVICE_NOT_FOUND', 'Service not found', 404);
    }

    if (instance.customerId !== customerId) {
      throw new BusinessError('FORBIDDEN', 'Not your service', 403);
    }

    if (instance.state === 'cancelled' || instance.state === 'delivered') {
      throw new BusinessError(
        'INVALID_STATE',
        `Cannot cancel service in '${instance.state}' state`,
        422,
      );
    }

    const fromState = instance.state;

    await this.prisma.$transaction([
      this.prisma.serviceInstance.update({
        where: { id },
        data: { state: 'cancelled' },
      }),
      this.prisma.serviceStateHistory.create({
        data: {
          serviceInstanceId: id,
          fromState,
          toState: 'cancelled',
          changedBy: customerId,
          reason,
        },
      }),
    ]);

    return { id, state: 'cancelled' };
  }
}
