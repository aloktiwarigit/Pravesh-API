import { PrismaClient } from '@prisma/client';
import { feeConfigSchema, FeeConfig } from './franchise.types';
import { BusinessError } from '../../shared/errors/business-error';
import * as ErrorCodes from '../../shared/errors/error-codes';

/**
 * Story 14-2: City-Specific Service Fee Schedules
 *
 * Manages fee schedules per city per service definition.
 * Supports tiered pricing based on property value slabs.
 * Changes apply only to NEW service requests.
 * Future-dated fee schedules supported.
 */
export class CityServiceFeeService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create a fee schedule for a city + service combination
   */
  async createFeeSchedule(params: {
    cityId: string;
    serviceDefinitionId: string;
    feeConfig: FeeConfig;
    effectiveFrom: string;
    effectiveTo?: string;
    createdBy: string;
  }) {
    const validatedConfig = feeConfigSchema.parse(params.feeConfig);

    const effectiveFrom = new Date(params.effectiveFrom);
    const effectiveTo = params.effectiveTo ? new Date(params.effectiveTo) : null;

    // Check for overlapping active schedules
    const existing = await this.prisma.cityServiceFee.findFirst({
      where: {
        cityId: params.cityId,
        serviceDefinitionId: params.serviceDefinitionId,
        isActive: true,
        effectiveFrom: { lte: effectiveTo || new Date('2099-12-31') },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: effectiveFrom } },
        ],
      },
    });

    if (existing) {
      throw new BusinessError(
        ErrorCodes.BUSINESS_FEE_SCHEDULE_CONFLICT,
        'An active fee schedule already exists for this date range',
        409,
        { existingId: existing.id }
      );
    }

    return this.prisma.cityServiceFee.create({
      data: {
        cityId: params.cityId,
        serviceDefinitionId: params.serviceDefinitionId,
        feeConfig: validatedConfig as any,
        effectiveFrom,
        effectiveTo,
        createdBy: params.createdBy,
      },
    });
  }

  /**
   * Get the currently effective fee schedule for a city + service
   */
  async getEffectiveFeeSchedule(cityId: string, serviceDefinitionId: string) {
    const now = new Date();
    return this.prisma.cityServiceFee.findFirst({
      where: {
        cityId,
        serviceDefinitionId,
        isActive: true,
        effectiveFrom: { lte: now },
        OR: [
          { effectiveTo: null },
          { effectiveTo: { gte: now } },
        ],
      },
      orderBy: { effectiveFrom: 'desc' },
    });
  }

  /**
   * List all fee schedules for a city
   */
  async listFeeSchedules(cityId: string) {
    return this.prisma.cityServiceFee.findMany({
      where: { cityId },
      orderBy: [
        { serviceDefinitionId: 'asc' },
        { effectiveFrom: 'desc' },
      ],
    });
  }

  /**
   * Calculate fee for a service based on property value
   */
  async calculateFee(cityId: string, serviceDefinitionId: string, propertyValuePaise: number): Promise<{
    baseFeePaise: number;
    slabFeePaise: number;
    gstPaise: number;
    totalPaise: number;
  }> {
    const schedule = await this.getEffectiveFeeSchedule(cityId, serviceDefinitionId);
    if (!schedule) {
      throw new BusinessError(
        ErrorCodes.BUSINESS_CITY_NOT_FOUND,
        'No fee schedule found for this city and service',
        404
      );
    }

    const config = schedule.feeConfig as unknown as FeeConfig;
    let feePaise = config.baseFeePaise;

    // Apply property value slab pricing
    if (config.propertyValueSlabs && config.propertyValueSlabs.length > 0) {
      const applicableSlab = config.propertyValueSlabs.find(
        (slab) =>
          propertyValuePaise >= slab.minValuePaise &&
          (slab.maxValuePaise === null || propertyValuePaise <= slab.maxValuePaise)
      );
      if (applicableSlab) {
        feePaise = applicableSlab.feePaise;
      }
    }

    const gstPercentage = config.gstPercentage || 18;
    const gstPaise = Math.round(feePaise * gstPercentage / 100);

    return {
      baseFeePaise: config.baseFeePaise,
      slabFeePaise: feePaise,
      gstPaise,
      totalPaise: feePaise + gstPaise,
    };
  }

  /**
   * Deactivate a fee schedule
   */
  async deactivateFeeSchedule(feeScheduleId: string) {
    return this.prisma.cityServiceFee.update({
      where: { id: feeScheduleId },
      data: { isActive: false },
    });
  }

  /**
   * Super Admin override: update fee schedule for corporate pricing
   */
  async overrideFeeSchedule(feeScheduleId: string, feeConfig: FeeConfig, approvedBy: string) {
    const validatedConfig = feeConfigSchema.parse(feeConfig);
    return this.prisma.cityServiceFee.update({
      where: { id: feeScheduleId },
      data: {
        feeConfig: validatedConfig as any,
        approvedBy,
      },
    });
  }
}
