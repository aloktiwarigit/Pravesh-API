/**
 * Dynamic pricing engine based on property value slabs.
 *
 * Story 4.4: Dynamic Pricing by Property Value Slabs
 */
import { PrismaClient } from '@prisma/client';
import { AppError } from '../../core/errors/app-error.js';

export class PricingService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Looks up the service fee based on property value slab.
   * Falls back to base fee from the service definition if no slab matches.
   *
   * Story 4.4 AC1, AC2
   */
  async calculateServiceFee(params: {
    serviceId: string;
    propertyValuePaise: number;
    cityId: string;
  }): Promise<{
    serviceFeePaise: number;
    slabId: string | null;
    slabName: string | null;
    isBaseFee: boolean;
  }> {
    // Look up matching slab by property value range
    const slab = await this.prisma.pricingSlab.findFirst({
      where: {
        serviceDefinitionId: params.serviceId,
        cityId: params.cityId,
        isActive: true,
        propertyValueMinPaise: { lte: BigInt(params.propertyValuePaise) },
        propertyValueMaxPaise: { gte: BigInt(params.propertyValuePaise) },
      },
    });

    if (slab) {
      await this.logPricingCalculation({
        serviceId: params.serviceId,
        propertyValuePaise: params.propertyValuePaise,
        cityId: params.cityId,
        slabId: slab.id,
        resultFeePaise: slab.serviceFeePaise,
        isBaseFee: false,
      });

      return {
        serviceFeePaise: slab.serviceFeePaise,
        slabId: slab.id,
        slabName: slab.slabName,
        isBaseFee: false,
      };
    }

    // Fallback: look up base fee from ServiceDefinition
    const serviceDefinition = await this.prisma.serviceDefinition.findUnique({
      where: { id: params.serviceId },
    });

    if (!serviceDefinition) {
      throw new AppError('SERVICE_NOT_FOUND', 'Service or pricing slab not found', 404);
    }

    const definition = serviceDefinition.definition as any;
    const baseFee = definition?.estimatedFees?.serviceFeeBasePaise;

    if (!baseFee) {
      throw new AppError('SERVICE_NOT_FOUND', 'No pricing slab or base fee configured', 404);
    }

    await this.logPricingCalculation({
      serviceId: params.serviceId,
      propertyValuePaise: params.propertyValuePaise,
      cityId: params.cityId,
      slabId: null,
      resultFeePaise: baseFee,
      isBaseFee: true,
    });

    return {
      serviceFeePaise: baseFee,
      slabId: null,
      slabName: null,
      isBaseFee: true,
    };
  }

  /**
   * Gets all pricing slabs for a service in a city.
   */
  async getSlabs(serviceId: string, cityId: string) {
    const slabs = await this.prisma.pricingSlab.findMany({
      where: {
        serviceDefinitionId: serviceId,
        cityId,
        isActive: true,
      },
      orderBy: { propertyValueMinPaise: 'asc' },
    });

    return slabs.map((s) => ({
      id: s.id,
      slabName: s.slabName,
      propertyValueMinPaise: s.propertyValueMinPaise.toString(),
      propertyValueMaxPaise: s.propertyValueMaxPaise.toString(),
      serviceFeePaise: s.serviceFeePaise.toString(),
    }));
  }

  private async logPricingCalculation(params: {
    serviceId: string;
    propertyValuePaise: number;
    cityId: string;
    slabId: string | null;
    resultFeePaise: number;
    isBaseFee: boolean;
  }) {
    await this.prisma.pricingCalculation.create({
      data: {
        serviceDefinitionId: params.serviceId,
        propertyValuePaise: BigInt(params.propertyValuePaise),
        cityId: params.cityId,
        slabId: params.slabId,
        resultFeePaise: params.resultFeePaise,
        isBaseFee: params.isBaseFee,
      },
    });
  }
}
