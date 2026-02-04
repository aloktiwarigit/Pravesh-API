// Story 13-14: Ops NRI Dashboard Filter Service
import { PrismaClient } from '@prisma/client';

/**
 * TODO: Several features in this service depend on models/fields not yet in schema:
 * - serviceInstance does not have a `customer` relation or `isNri`/`hasVerifiedPoa` fields
 * - agentProfile model does not exist (Agent model is used instead)
 * - User model does not have a `dedicatedOpsContact` field
 * These are stubbed with TODO comments and return sensible defaults.
 */
export class NriFilterService {
  constructor(private prisma: PrismaClient) {}

  async getNriServiceRequests(filters?: {
    status?: string;
    cityId?: string;
  }) {
    // TODO: serviceInstance does not have customer.isNri relation in schema.
    // Using serviceInstance with available filters only.
    return this.prisma.serviceInstance.findMany({
      where: {
        ...(filters?.status ? { state: filters.status } : {}),
        ...(filters?.cityId ? { cityId: filters.cityId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getNriSpecialistAgents(cityId: string) {
    // TODO: Agent model does not have isNriSpecialist field.
    // Returning active agents for the city as a fallback.
    return this.prisma.agent.findMany({
      where: { isActive: true, cityId },
      select: { id: true, name: true, phone: true, expertiseTags: true },
    });
  }

  async assignDedicatedOpsContact(
    _customerId: string,
    _opsUserId: string
  ) {
    // TODO: User model does not have dedicatedOpsContact field in schema.
    // Stubbed - returns null until schema is extended.
    return null;
  }

  async getNriDashboardStats(cityId?: string) {
    // TODO: serviceInstance does not have customer.isNri or hasVerifiedPoa fields.
    // Returning zero counts as stubs.
    const where: any = {};
    if (cityId) where.cityId = cityId;

    const [total, pending, active] =
      await Promise.all([
        this.prisma.serviceInstance.count({ where }),
        this.prisma.serviceInstance.count({
          where: { ...where, state: 'requested' },
        }),
        this.prisma.serviceInstance.count({
          where: {
            ...where,
            state: { in: ['in_progress', 'assigned'] },
          },
        }),
      ]);

    return { total, pending, active, withPoa: 0 };
  }
}
