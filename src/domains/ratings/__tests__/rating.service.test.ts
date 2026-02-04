/**
 * Tests for RatingService covering submit, get, and agent aggregation.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { RatingService } from '../rating.service.js';
import { AppError } from '../../../core/errors/app-error.js';

// Mock Prisma
vi.mock('@prisma/client', () => {
  const mockPrisma = {
    serviceRating: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    serviceInstance: {
      findUnique: vi.fn(),
    },
  };
  return {
    PrismaClient: vi.fn(() => mockPrisma),
  };
});

describe('RatingService', () => {
  let service: RatingService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    service = new RatingService(mockPrisma);
    vi.clearAllMocks();
  });

  describe('submitRating', () => {
    const baseParams = {
      serviceInstanceId: 'si-001',
      serviceRequestId: 'sr-001',
      customerId: 'cust-001',
      agentId: 'agent-001',
      rating: 4,
      reviewText: 'Great service',
      reviewTextHi: undefined,
      cityId: 'city-001',
    };

    test('creates a new rating via upsert', async () => {
      // Given: service instance exists
      mockPrisma.serviceInstance.findUnique.mockResolvedValue({
        id: 'si-001',
        assignedAgentId: 'agent-001',
      });

      const expectedRating = {
        id: 'rating-001',
        serviceInstanceId: 'si-001',
        customerId: 'cust-001',
        rating: 4,
        reviewText: 'Great service',
      };
      mockPrisma.serviceRating.upsert.mockResolvedValue(expectedRating);

      // When
      const result = await service.submitRating(baseParams);

      // Then
      expect(result).toEqual(expectedRating);
      expect(mockPrisma.serviceInstance.findUnique).toHaveBeenCalledWith({
        where: { id: 'si-001' },
      });
      expect(mockPrisma.serviceRating.upsert).toHaveBeenCalledWith({
        where: {
          serviceInstanceId_customerId: {
            serviceInstanceId: 'si-001',
            customerId: 'cust-001',
          },
        },
        update: {
          rating: 4,
          reviewText: 'Great service',
          reviewTextHi: undefined,
        },
        create: {
          serviceInstanceId: 'si-001',
          serviceRequestId: 'sr-001',
          customerId: 'cust-001',
          agentId: 'agent-001',
          rating: 4,
          reviewText: 'Great service',
          reviewTextHi: undefined,
          cityId: 'city-001',
        },
      });
    });

    test('updates an existing rating via upsert', async () => {
      // Given: service instance exists and rating already exists (upsert handles update)
      mockPrisma.serviceInstance.findUnique.mockResolvedValue({
        id: 'si-001',
        assignedAgentId: 'agent-001',
      });

      const updatedRating = {
        id: 'rating-001',
        serviceInstanceId: 'si-001',
        customerId: 'cust-001',
        rating: 5,
        reviewText: 'Updated review',
      };
      mockPrisma.serviceRating.upsert.mockResolvedValue(updatedRating);

      // When
      const result = await service.submitRating({
        ...baseParams,
        rating: 5,
        reviewText: 'Updated review',
      });

      // Then
      expect(result).toEqual(updatedRating);
      expect(mockPrisma.serviceRating.upsert).toHaveBeenCalledOnce();
      expect(mockPrisma.serviceRating.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: {
            rating: 5,
            reviewText: 'Updated review',
            reviewTextHi: undefined,
          },
        }),
      );
    });

    test('throws VALIDATION_INVALID_RATING when rating < 1', async () => {
      // When & Then
      await expect(
        service.submitRating({ ...baseParams, rating: 0 }),
      ).rejects.toThrow(AppError);

      await expect(
        service.submitRating({ ...baseParams, rating: 0 }),
      ).rejects.toMatchObject({
        code: 'VALIDATION_INVALID_RATING',
        statusCode: 400,
      });
    });

    test('throws VALIDATION_INVALID_RATING when rating > 5', async () => {
      // When & Then
      await expect(
        service.submitRating({ ...baseParams, rating: 6 }),
      ).rejects.toThrow(AppError);

      await expect(
        service.submitRating({ ...baseParams, rating: 6 }),
      ).rejects.toMatchObject({
        code: 'VALIDATION_INVALID_RATING',
        statusCode: 400,
      });
    });

    test('throws SERVICE_INSTANCE_NOT_FOUND when instance does not exist', async () => {
      // Given: service instance not found
      mockPrisma.serviceInstance.findUnique.mockResolvedValue(null);

      // When & Then
      await expect(
        service.submitRating(baseParams),
      ).rejects.toThrow(AppError);

      await expect(
        service.submitRating(baseParams),
      ).rejects.toMatchObject({
        code: 'SERVICE_INSTANCE_NOT_FOUND',
        statusCode: 404,
      });
    });

    test('uses instance assignedAgentId when agentId not provided', async () => {
      // Given
      mockPrisma.serviceInstance.findUnique.mockResolvedValue({
        id: 'si-001',
        assignedAgentId: 'fallback-agent',
      });
      mockPrisma.serviceRating.upsert.mockResolvedValue({ id: 'rating-001' });

      // When
      await service.submitRating({
        ...baseParams,
        agentId: undefined,
      });

      // Then
      expect(mockPrisma.serviceRating.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            agentId: 'fallback-agent',
          }),
        }),
      );
    });
  });

  describe('getRating', () => {
    test('returns rating for a service instance and customer', async () => {
      // Given
      const expectedRating = {
        id: 'rating-001',
        serviceInstanceId: 'si-001',
        customerId: 'cust-001',
        rating: 5,
        reviewText: 'Excellent',
      };
      mockPrisma.serviceRating.findUnique.mockResolvedValue(expectedRating);

      // When
      const result = await service.getRating('si-001', 'cust-001');

      // Then
      expect(result).toEqual(expectedRating);
      expect(mockPrisma.serviceRating.findUnique).toHaveBeenCalledWith({
        where: {
          serviceInstanceId_customerId: {
            serviceInstanceId: 'si-001',
            customerId: 'cust-001',
          },
        },
      });
    });

    test('returns null when no rating exists', async () => {
      // Given
      mockPrisma.serviceRating.findUnique.mockResolvedValue(null);

      // When
      const result = await service.getRating('si-nonexistent', 'cust-001');

      // Then
      expect(result).toBeNull();
    });
  });

  describe('getRatingsForAgent', () => {
    test('returns aggregated ratings with average for an agent', async () => {
      // Given
      const mockRatings = [
        { id: 'r1', agentId: 'agent-001', rating: 5, createdAt: new Date() },
        { id: 'r2', agentId: 'agent-001', rating: 4, createdAt: new Date() },
        { id: 'r3', agentId: 'agent-001', rating: 3, createdAt: new Date() },
      ];
      mockPrisma.serviceRating.findMany.mockResolvedValue(mockRatings);

      // When
      const result = await service.getRatingsForAgent('agent-001');

      // Then
      expect(result.ratings).toEqual(mockRatings);
      expect(result.totalCount).toBe(3);
      expect(result.averageRating).toBe(4); // (5+4+3)/3 = 4.0
      expect(mockPrisma.serviceRating.findMany).toHaveBeenCalledWith({
        where: { agentId: 'agent-001' },
        orderBy: { createdAt: 'desc' },
      });
    });

    test('returns zero average when agent has no ratings', async () => {
      // Given
      mockPrisma.serviceRating.findMany.mockResolvedValue([]);

      // When
      const result = await service.getRatingsForAgent('agent-no-ratings');

      // Then
      expect(result.ratings).toEqual([]);
      expect(result.totalCount).toBe(0);
      expect(result.averageRating).toBe(0);
    });

    test('rounds average rating to one decimal place', async () => {
      // Given: 4 + 5 + 4 = 13 / 3 = 4.333... -> rounds to 4.3
      const mockRatings = [
        { id: 'r1', agentId: 'agent-001', rating: 4, createdAt: new Date() },
        { id: 'r2', agentId: 'agent-001', rating: 5, createdAt: new Date() },
        { id: 'r3', agentId: 'agent-001', rating: 4, createdAt: new Date() },
      ];
      mockPrisma.serviceRating.findMany.mockResolvedValue(mockRatings);

      // When
      const result = await service.getRatingsForAgent('agent-001');

      // Then
      expect(result.averageRating).toBe(4.3);
    });
  });
});
