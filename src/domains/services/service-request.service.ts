/**
 * Service Request Submit Service
 *
 * Handles customer-initiated service requests from the Flutter app.
 * Creates ServiceInstance + ServiceRequest in a single transaction.
 */

import { PrismaClient } from '@prisma/client';
import { BusinessError } from '../../shared/errors/business-error';
import {
  FLUTTER_SLUG_TO_SERVICE_CODE,
  SLUG_DISPLAY_NAMES,
} from './service-catalog-map';

interface SubmitRequestPayload {
  serviceId: string; // Flutter catalog slug (snake_case) or DB code (kebab-case) or UUID
  propertyType: string;
  propertyLocation: string;
  ownershipStatus: string;
  packageId?: string;
  estimatedValuePaise?: number;
}

interface AuthUser {
  id: string;
  cityId?: string;
  roles?: string[];
  role?: string;
}

export class ServiceRequestSubmitService {
  constructor(private readonly prisma: PrismaClient) {}

  async submitRequest(
    payload: SubmitRequestPayload,
    user: AuthUser,
  ): Promise<{ id: string; requestNumber: string }> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Resolve cityId
      const cityId = await this.resolveCityId(tx, user);

      // 2. Resolve ServiceDefinition
      const serviceDefinition = await this.resolveServiceDefinition(
        tx,
        payload.serviceId,
        cityId,
      );

      // 3. Create ServiceInstance
      const serviceInstance = await tx.serviceInstance.create({
        data: {
          serviceDefinitionId: serviceDefinition.id,
          customerId: user.id,
          cityId,
          state: 'requested',
          propertyType: payload.propertyType,
          propertyAddress: payload.propertyLocation,
          propertyValuePaise: payload.estimatedValuePaise
            ? BigInt(payload.estimatedValuePaise)
            : null,
          metadata: {
            ownershipStatus: payload.ownershipStatus,
            ...(payload.packageId ? { packageId: payload.packageId } : {}),
          },
        },
      });

      // 4. Generate request number via PostgreSQL sequence
      const requestNumber = await this.generateRequestNumber(tx);

      // 5. Calculate service fee
      const serviceFeePaise = await this.calculateServiceFee(
        tx,
        cityId,
        serviceDefinition,
        payload.estimatedValuePaise,
      );

      // 6. Create ServiceRequest
      const serviceRequest = await tx.serviceRequest.create({
        data: {
          serviceInstanceId: serviceInstance.id,
          serviceCode: serviceDefinition.code,
          customerId: user.id,
          cityId,
          status: 'pending',
          requestNumber,
          serviceFeePaise: serviceFeePaise,
          metadata: {
            source: 'flutter_app',
            propertyType: payload.propertyType,
            propertyLocation: payload.propertyLocation,
            ownershipStatus: payload.ownershipStatus,
          },
        },
      });

      return {
        id: serviceRequest.id,
        serviceInstanceId: serviceInstance.id,
        requestNumber,
      };
    });
  }

  private async resolveCityId(
    tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
    user: AuthUser,
  ): Promise<string> {
    if (user.cityId) return user.cityId;

    // Fallback: first active city (typically Lucknow)
    const city = await (tx as any).city.findFirst({
      where: { activeStatus: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });

    if (!city) {
      throw new BusinessError(
        'NO_ACTIVE_CITY',
        'No active city found. Please contact support.',
        422,
      );
    }

    return city.id;
  }

  private async resolveServiceDefinition(
    tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
    serviceId: string,
    cityId: string,
  ) {
    // Try 1: Direct UUID lookup
    if (this.isUUID(serviceId)) {
      const def = await (tx as any).serviceDefinition.findUnique({
        where: { id: serviceId },
      });
      if (def) return def;
    }

    // Try 2: Slug → DB code mapping
    const dbCode = FLUTTER_SLUG_TO_SERVICE_CODE[serviceId];
    if (dbCode) {
      const def = await (tx as any).serviceDefinition.findFirst({
        where: { code: dbCode, isActive: true },
      });
      if (def) return def;
    }

    // Try 3: Direct code match (in case serviceId is already a DB code)
    const directMatch = await (tx as any).serviceDefinition.findFirst({
      where: { code: serviceId, isActive: true },
    });
    if (directMatch) return directMatch;

    // Try 4: Auto-create a ServiceDefinition for unmapped slugs
    const displayName =
      SLUG_DISPLAY_NAMES[serviceId] ||
      serviceId.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    const autoCode = serviceId.replace(/_/g, '-');

    // Check if auto-code already exists
    const existingAuto = await (tx as any).serviceDefinition.findFirst({
      where: { code: autoCode },
    });
    if (existingAuto) return existingAuto;

    const newDef = await (tx as any).serviceDefinition.create({
      data: {
        code: autoCode,
        name: displayName,
        category: 'specialized',
        definition: {
          serviceCode: autoCode,
          serviceName: displayName,
          category: 'specialized',
          description: `Auto-created service for ${displayName}`,
          steps: [],
          requiredDocuments: [],
          estimatedDaysTotal: 7,
          slaBusinessDays: 10,
          tags: [serviceId],
        },
        cityId,
        isActive: true,
      },
    });

    return newDef;
  }

  /**
   * Calculate service fee using CityServiceFee slabs or ServiceDefinition fallback.
   * Returns null if no fee can be determined (should not block request creation).
   */
  private async calculateServiceFee(
    tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
    cityId: string,
    serviceDefinition: { id: string; definition: unknown },
    estimatedValuePaise?: number,
  ): Promise<number | null> {
    try {
      const now = new Date();

      // Try 1: CityServiceFee slab-based pricing
      const schedule = await (tx as any).cityServiceFee.findFirst({
        where: {
          cityId,
          serviceDefinitionId: serviceDefinition.id,
          isActive: true,
          effectiveFrom: { lte: now },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: now } }],
        },
        orderBy: { effectiveFrom: 'desc' },
      });

      if (schedule) {
        const config = schedule.feeConfig as Record<string, unknown>;
        let feePaise = (config.baseFeePaise as number) ?? 0;

        // Apply slab pricing if property value is provided
        const slabs = config.propertyValueSlabs as Array<{
          minValuePaise: number;
          maxValuePaise: number | null;
          feePaise: number;
        }> | undefined;

        if (slabs?.length && estimatedValuePaise) {
          const slab = slabs.find(
            (s) =>
              estimatedValuePaise >= s.minValuePaise &&
              (s.maxValuePaise === null || estimatedValuePaise <= s.maxValuePaise),
          );
          if (slab) feePaise = slab.feePaise;
        }

        return feePaise;
      }

      // Try 2: Fallback to ServiceDefinition base fee
      const def = serviceDefinition.definition as Record<string, unknown> | null;
      const fees = def?.estimatedFees as Record<string, unknown> | undefined;
      if (fees?.serviceFeePaise) {
        return fees.serviceFeePaise as number;
      }

      return null;
    } catch {
      // Fee calculation failure should not block request creation
      return null;
    }
  }

  private async generateRequestNumber(
    tx: Parameters<Parameters<PrismaClient['$transaction']>[0]>[0],
  ): Promise<string> {
    const year = new Date().getFullYear();

    // Use PostgreSQL sequence for atomic, gap-free numbering
    // The sequence is created by the migration
    try {
      const result = await (tx as any).$queryRaw`
        SELECT nextval('service_request_number_seq') as seq_val
      `;
      const seqVal = Number(result[0].seq_val);
      return `PLA-${year}-${String(seqVal).padStart(5, '0')}`;
    } catch {
      // Fallback: count-based if sequence doesn't exist yet
      const count = await (tx as any).serviceRequest.count();
      return `PLA-${year}-${String(count + 1).padStart(5, '0')}`;
    }
  }

  private isUUID(str: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      str,
    );
  }
}
