import { PrismaClient } from '@prisma/client';
import { UpsertCommissionConfigInput } from './commission-config.validation';

export class CommissionConfigService {
  constructor(private readonly prisma: PrismaClient) {}

  async list() {
    return this.prisma.commissionConfig.findMany({
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      include: {
        serviceDefinition: {
          select: { name: true, code: true },
        },
      },
    });
  }

  async upsert(input: UpsertCommissionConfigInput, updatedBy?: string) {
    return this.prisma.commissionConfig.upsert({
      where: {
        role_serviceDefinitionId: {
          role: input.role,
          serviceDefinitionId: input.serviceDefinitionId,
        },
      },
      update: {
        commissionAmountPaise: BigInt(input.commissionAmountPaise),
        isActive: true,
        updatedBy,
      },
      create: {
        role: input.role,
        serviceDefinitionId: input.serviceDefinitionId,
        commissionAmountPaise: BigInt(input.commissionAmountPaise),
        updatedBy,
      },
      include: {
        serviceDefinition: {
          select: { name: true, code: true },
        },
      },
    });
  }

  async remove(id: string) {
    return this.prisma.commissionConfig.delete({
      where: { id },
    });
  }
}
