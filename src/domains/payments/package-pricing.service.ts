/**
 * Package pricing service for bundled services with discounts.
 *
 * Story 4.5: Package Discount Application
 */
import { PrismaClient } from '@prisma/client';
import { PricingService } from './pricing.service.js';

export interface PackagePricingResult {
  individualItems: Array<{
    serviceId: string;
    serviceName: string;
    serviceFeePaise: bigint;
    slabId: string | null;
  }>;
  subtotalPaise: bigint;
  discountPercentage: number;
  discountAmountPaise: bigint;
  packagePricePaise: bigint;
}

export class PackagePricingService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly pricingService: PricingService,
  ) {}

  /**
   * Calculates package pricing: sum individual fees, apply discount%.
   * All arithmetic is BigInt integer - no floating point.
   *
   * discount = (total * BigInt(discountPct)) / 100n
   * price = total - discount
   *
   * Story 4.5 AC1-AC4
   */
  async calculatePackagePrice(params: {
    packageId: string;
    propertyValuePaise: bigint;
    cityId: string;
  }): Promise<PackagePricingResult> {
    const pkg = await this.prisma.package.findUnique({
      where: { id: params.packageId },
      include: {
        packageItems: {
          include: { serviceDefinition: true },
        },
      },
    });

    if (!pkg) {
      throw new Error('Package not found');
    }

    // Calculate individual fees for each service in the package
    const individualItems: PackagePricingResult['individualItems'] = [];
    let subtotalPaise = 0n;

    for (const pkgItem of pkg.packageItems) {
      const pricing = await this.pricingService.calculateServiceFee({
        serviceId: pkgItem.serviceDefinitionId,
        propertyValuePaise: Number(params.propertyValuePaise),
        cityId: params.cityId,
      });

      individualItems.push({
        serviceId: pkgItem.serviceDefinitionId,
        serviceName: pkgItem.serviceDefinition.name,
        serviceFeePaise: BigInt(pricing.serviceFeePaise),
        slabId: pricing.slabId,
      });

      subtotalPaise += BigInt(pricing.serviceFeePaise);
    }

    // Apply discount using BigInt integer arithmetic
    const discountPercentage = pkg.discountPercent;
    const discountAmountPaise = (subtotalPaise * BigInt(discountPercentage)) / 100n;
    const packagePricePaise = subtotalPaise - discountAmountPaise;

    return {
      individualItems,
      subtotalPaise,
      discountPercentage,
      discountAmountPaise,
      packagePricePaise,
    };
  }
}
