// Story 13-14: Ops NRI Dashboard Filter Service
import { PrismaClient } from '@prisma/client';

export class NriFilterService {
  constructor(private prisma: PrismaClient) {}

  async getNriServiceRequests(filters?: {
    status?: string;
    cityId?: string;
  }) {
    return this.prisma.serviceInstance.findMany({
      where: {
        ...(filters?.status ? { state: filters.status } : {}),
        ...(filters?.cityId ? { cityId: filters.cityId } : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getNriSpecialistAgents(cityId: string) {
    // Filter by 'nri' expertise tag for NRI specialists
    return this.prisma.agent.findMany({
      where: {
        isActive: true,
        cityId,
        expertiseTags: { has: 'nri' },
      },
      select: { id: true, name: true, phone: true, expertiseTags: true },
    });
  }

  async assignDedicatedOpsContact(
    customerId: string,
    opsUserId: string,
  ) {
    // Store dedicated ops contact in user profile data
    await this.prisma.user.update({
      where: { id: customerId },
      data: {
        profileData: {
          dedicatedOpsContact: opsUserId,
          assignedAt: new Date().toISOString(),
        },
      },
    });
    return { customerId, opsUserId };
  }

  async getNriDashboardStats(cityId?: string) {
    const where: Record<string, unknown> = {};
    if (cityId) where.cityId = cityId;

    // Query service requests for POA verification counts
    const [total, pending, active, withPoa] =
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
        this.prisma.serviceRequest.count({
          where: {
            ...(cityId ? { cityId } : {}),
            hasVerifiedPoa: true,
          },
        }),
      ]);

    return { total, pending, active, withPoa };
  }
}
