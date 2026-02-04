/**
 * Tests for PricingService covering slab-based fee calculation, fallback,
 * and pricing log creation.
 *
 * Story 4.4: Dynamic Pricing by Property Value Slabs
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PricingService } from '../pricing.service.js';
import { AppError } from '../../../core/errors/app-error.js';

// Mock Prisma
vi.mock('@prisma/client', () => {
  const mockPrisma = {
    pricingSlab: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    serviceDefinition: {
      findUnique: vi.fn(),
    },
    pricingCalculation: {
      create: vi.fn(),
    },
  };
  return {
    PrismaClient: vi.fn(() => mockPrisma),
  };
});

describe('PricingService', () => {
  let service: PricingService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    service = new PricingService(mockPrisma);
    vi.clearAllMocks();
  });

  describe('calculateServiceFee', () => {
    const baseParams = {
      serviceId: 'svc-001',
      propertyValuePaise: 5000000, // 50,000 INR
      cityId: 'city-001',
    };

    test('returns slab-based fee when a matching slab exists', async () => {
      // Given: a matching pricing slab exists
      const mockSlab = {
        id: 'slab-001',
        slabName: '25L - 50L',
        serviceDefinitionId: 'svc-001',
        cityId: 'city-001',
        isActive: true,
        propertyValueMinPaise: BigInt(2500000),
        propertyValueMaxPaise: BigInt(5000000),
        serviceFeePaise: 15000, // 150 INR
      };
      mockPrisma.pricingSlab.findFirst.mockResolvedValue(mockSlab);
      mockPrisma.pricingCalculation.create.mockResolvedValue({});

      // When
      const result = await service.calculateServiceFee(baseParams);

      // Then
      expect(result).toEqual({
        serviceFeePaise: 15000,
        slabId: 'slab-001',
        slabName: '25L - 50L',
        isBaseFee: false,
      });
      expect(mockPrisma.pricingSlab.findFirst).toHaveBeenCalledWith({
        where: {
          serviceDefinitionId: 'svc-001',
          cityId: 'city-001',
          isActive: true,
          propertyValueMinPaise: { lte: BigInt(5000000) },
          propertyValueMaxPaise: { gte: BigInt(5000000) },
        },
      });
    });

    test('logs pricing calculation when slab is found', async () => {
      // Given
      const mockSlab = {
        id: 'slab-001',
        slabName: '25L - 50L',
        serviceFeePaise: 15000,
      };
      mockPrisma.pricingSlab.findFirst.mockResolvedValue(mockSlab);
      mockPrisma.pricingCalculation.create.mockResolvedValue({});

      // When
      await service.calculateServiceFee(baseParams);

      // Then
      expect(mockPrisma.pricingCalculation.create).toHaveBeenCalledWith({
        data: {
          serviceDefinitionId: 'svc-001',
          propertyValuePaise: BigInt(5000000),
          cityId: 'city-001',
          slabId: 'slab-001',
          resultFeePaise: 15000,
          isBaseFee: false,
        },
      });
    });

    test('falls back to service definition base fee when no slab matches', async () => {
      // Given: no slab matches
      mockPrisma.pricingSlab.findFirst.mockResolvedValue(null);

      // Given: service definition has a base fee
      mockPrisma.serviceDefinition.findUnique.mockResolvedValue({
        id: 'svc-001',
        definition: {
          estimatedFees: {
            serviceFeeBasePaise: 10000, // 100 INR base fee
          },
        },
      });
      mockPrisma.pricingCalculation.create.mockResolvedValue({});

      // When
      const result = await service.calculateServiceFee(baseParams);

      // Then
      expect(result).toEqual({
        serviceFeePaise: 10000,
        slabId: null,
        slabName: null,
        isBaseFee: true,
      });
      expect(mockPrisma.serviceDefinition.findUnique).toHaveBeenCalledWith({
        where: { id: 'svc-001' },
      });
    });

    test('logs pricing calculation with isBaseFee=true when using fallback', async () => {
      // Given
      mockPrisma.pricingSlab.findFirst.mockResolvedValue(null);
      mockPrisma.serviceDefinition.findUnique.mockResolvedValue({
        id: 'svc-001',
        definition: {
          estimatedFees: { serviceFeeBasePaise: 10000 },
        },
      });
      mockPrisma.pricingCalculation.create.mockResolvedValue({});

      // When
      await service.calculateServiceFee(baseParams);

      // Then
      expect(mockPrisma.pricingCalculation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          slabId: null,
          resultFeePaise: 10000,
          isBaseFee: true,
        }),
      });
    });

    test('throws SERVICE_NOT_FOUND when service definition does not exist', async () => {
      // Given: no slab and no service definition
      mockPrisma.pricingSlab.findFirst.mockResolvedValue(null);
      mockPrisma.serviceDefinition.findUnique.mockResolvedValue(null);

      // When & Then
      await expect(
        service.calculateServiceFee(baseParams),
      ).rejects.toThrow(AppError);

      await expect(
        service.calculateServiceFee(baseParams),
      ).rejects.toMatchObject({
        code: 'SERVICE_NOT_FOUND',
        statusCode: 404,
      });
    });

    test('throws SERVICE_NOT_FOUND when service definition has no base fee', async () => {
      // Given: no slab, service definition exists but no base fee configured
      mockPrisma.pricingSlab.findFirst.mockResolvedValue(null);
      mockPrisma.serviceDefinition.findUnique.mockResolvedValue({
        id: 'svc-001',
        definition: {
          estimatedFees: {},
          // serviceFeeBasePaise is missing
        },
      });

      // When & Then
      await expect(
        service.calculateServiceFee(baseParams),
      ).rejects.toThrow(AppError);

      await expect(
        service.calculateServiceFee(baseParams),
      ).rejects.toMatchObject({
        code: 'SERVICE_NOT_FOUND',
        message: 'No pricing slab or base fee configured',
        statusCode: 404,
      });
    });

    test('throws when definition field is null/empty', async () => {
      // Given
      mockPrisma.pricingSlab.findFirst.mockResolvedValue(null);
      mockPrisma.serviceDefinition.findUnique.mockResolvedValue({
        id: 'svc-001',
        definition: null,
      });

      // When & Then
      await expect(
        service.calculateServiceFee(baseParams),
      ).rejects.toThrow(AppError);
    });
  });

  describe('getSlabs', () => {
    test('returns all active slabs for a service and city', async () => {
      // Given
      const mockSlabs = [
        {
          id: 'slab-001',
          slabName: 'Up to 25L',
          propertyValueMinPaise: BigInt(0),
          propertyValueMaxPaise: BigInt(2500000),
          serviceFeePaise: BigInt(8000),
        },
        {
          id: 'slab-002',
          slabName: '25L - 50L',
          propertyValueMinPaise: BigInt(2500001),
          propertyValueMaxPaise: BigInt(5000000),
          serviceFeePaise: BigInt(15000),
        },
      ];
      mockPrisma.pricingSlab.findMany.mockResolvedValue(mockSlabs);

      // When
      const result = await service.getSlabs('svc-001', 'city-001');

      // Then
      expect(result).toEqual([
        {
          id: 'slab-001',
          slabName: 'Up to 25L',
          propertyValueMinPaise: '0',
          propertyValueMaxPaise: '2500000',
          serviceFeePaise: '8000',
        },
        {
          id: 'slab-002',
          slabName: '25L - 50L',
          propertyValueMinPaise: '2500001',
          propertyValueMaxPaise: '5000000',
          serviceFeePaise: '15000',
        },
      ]);
      expect(mockPrisma.pricingSlab.findMany).toHaveBeenCalledWith({
        where: {
          serviceDefinitionId: 'svc-001',
          cityId: 'city-001',
          isActive: true,
        },
        orderBy: { propertyValueMinPaise: 'asc' },
      });
    });

    test('returns empty array when no slabs exist', async () => {
      // Given
      mockPrisma.pricingSlab.findMany.mockResolvedValue([]);

      // When
      const result = await service.getSlabs('svc-nonexistent', 'city-001');

      // Then
      expect(result).toEqual([]);
    });

    test('converts BigInt values to strings for JSON serialization', async () => {
      // Given
      const mockSlabs = [
        {
          id: 'slab-001',
          slabName: 'Test',
          propertyValueMinPaise: BigInt(1000000),
          propertyValueMaxPaise: BigInt(99999999),
          serviceFeePaise: BigInt(25000),
        },
      ];
      mockPrisma.pricingSlab.findMany.mockResolvedValue(mockSlabs);

      // When
      const result = await service.getSlabs('svc-001', 'city-001');

      // Then
      expect(typeof result[0].propertyValueMinPaise).toBe('string');
      expect(typeof result[0].propertyValueMaxPaise).toBe('string');
      expect(typeof result[0].serviceFeePaise).toBe('string');
    });
  });
});
