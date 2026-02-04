/**
 * Dynamic pricing engine based on property value slabs.
 *
 * Story 4.4: Dynamic Pricing by Property Value Slabs
 *
 * TODO: PricingSlab, PricingCalculation, and Service models do not exist
 * in the Prisma schema yet. All prisma calls are stubbed until these models are added.
 */
import { PrismaClient } from '@prisma/client';
import { AppError } from '../../core/errors/app-error.js';

interface PricingSlabRecord {
  id: string;
  serviceId: string;
  cityId: string;
  slabName: string;
  propertyValueMinPaise: number;
  propertyValueMaxPaise: number;
  serviceFeePaise: number;
  isActive: boolean;
}

export class PricingService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Looks up the service fee based on property value slab.
   * Falls back to base fee from the service if no slab matches.
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
    // TODO: PricingSlab model does not exist in schema. Stubbed with defaults.
    // In production, query pricingSlab here.
    const slab = null as PricingSlabRecord | null;

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

    // TODO: Service model does not exist in schema. Use ServiceDefinition if applicable.
    // Stubbed: throw not found since we cannot look up base fee.
    throw new AppError('SERVICE_NOT_FOUND', 'Service or pricing slab not found', 404);
  }

  /**
   * Gets all pricing slabs for a service in a city.
   */
  async getSlabs(serviceId: string, cityId: string) {
    // TODO: PricingSlab model does not exist in schema. Stubbed.
    const slabs: PricingSlabRecord[] = [];

    return slabs.map((s) => ({
      id: s.id,
      slabName: s.slabName,
      propertyValueMinPaise: s.propertyValueMinPaise.toString(),
      propertyValueMaxPaise: s.propertyValueMaxPaise.toString(),
      serviceFeePaise: s.serviceFeePaise.toString(),
    }));
  }

  private async logPricingCalculation(_params: {
    serviceId: string;
    propertyValuePaise: number;
    cityId: string;
    slabId: string | null;
    resultFeePaise: number;
    isBaseFee: boolean;
  }) {
    // TODO: PricingCalculation model does not exist in schema. Stubbed.
  }
}
