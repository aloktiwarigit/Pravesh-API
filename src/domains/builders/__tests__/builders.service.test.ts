// ============================================================
// Epic 11: Builder Portal — Service Layer Tests
// Stories 11-1, 11-2, 11-3, 11-5, 11-7, 11-8, 11-9
// ============================================================

import { BuildersService } from '../builders.service';
import { PrismaClient } from '@prisma/client';

// Mock Prisma client
const mockPrisma = {
  builder: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  builderProject: {
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  },
  projectUnit: {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    createMany: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  bulkServiceRequest: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  builderPricingTier: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  builderContract: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  builderBroadcast: {
    count: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  broadcastDelivery: {
    findMany: jest.fn(),
  },
  builderInboxMessage: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  $queryRaw: jest.fn(),
} as unknown as PrismaClient;

const service = new BuildersService(mockPrisma);

describe('BuildersService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Story 11-1: Builder Registration
  describe('registerBuilder', () => {
    it('should create builder with PENDING_VERIFICATION status', async () => {
      (mockPrisma.builder.findUnique as jest.Mock).mockResolvedValue(null);
      (mockPrisma.builder.create as jest.Mock).mockResolvedValue({
        id: 'builder-1',
        status: 'PENDING_VERIFICATION',
        reraNumber: 'UPRERAPRJ123456',
      });

      const result = await service.registerBuilder('user-1', {
        companyName: 'Test Builders',
        reraNumber: 'UPRERAPRJ123456',
        gstNumber: '09AAAAA0000A1Z5',
        contactPhone: '+919876543210',
        cityId: 'city-1',
      });

      expect(result.status).toBe('PENDING_VERIFICATION');
      expect(mockPrisma.builder.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'PENDING_VERIFICATION',
          }),
        })
      );
    });

    it('should reject duplicate RERA numbers', async () => {
      (mockPrisma.builder.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing',
        reraNumber: 'UPRERAPRJ123456',
      });

      await expect(
        service.registerBuilder('user-2', {
          companyName: 'Another Builder',
          reraNumber: 'UPRERAPRJ123456',
          gstNumber: '09BBBBB0000B1Z5',
          contactPhone: '+919876543211',
          cityId: 'city-1',
        })
      ).rejects.toThrow('RERA number already registered');
    });
  });

  // Story 11-1: Approve Builder
  describe('approveBuilder', () => {
    it('should set VERIFIED status and verifiedAt on approval', async () => {
      (mockPrisma.builder.findUnique as jest.Mock).mockResolvedValue({
        id: 'builder-1',
        status: 'PENDING_VERIFICATION',
        userId: 'user-1',
      });
      (mockPrisma.builder.update as jest.Mock).mockResolvedValue({
        id: 'builder-1',
        status: 'VERIFIED',
        verifiedAt: new Date(),
      });

      const result = await service.approveBuilder('builder-1', 'approve');
      expect(result.status).toBe('VERIFIED');
    });

    it('should reject approval if builder not in PENDING_VERIFICATION', async () => {
      (mockPrisma.builder.findUnique as jest.Mock).mockResolvedValue({
        id: 'builder-1',
        status: 'VERIFIED',
      });

      await expect(
        service.approveBuilder('builder-1', 'approve')
      ).rejects.toThrow('Builder is not pending verification');
    });
  });

  // Story 11-1: Create Project
  describe('createProject', () => {
    it('should require VERIFIED builder', async () => {
      (mockPrisma.builder.findUnique as jest.Mock).mockResolvedValue({
        id: 'builder-1',
        status: 'PENDING_VERIFICATION',
      });

      await expect(
        service.createProject('builder-1', {
          name: 'Test Project',
          totalUnits: 48,
          location: 'Lucknow, UP',
          projectType: 'RESIDENTIAL',
          cityId: 'city-1',
        })
      ).rejects.toThrow('Builder must be verified to create projects');
    });

    it('should create project with ACTIVE status', async () => {
      (mockPrisma.builder.findUnique as jest.Mock).mockResolvedValue({
        id: 'builder-1',
        status: 'VERIFIED',
      });
      (mockPrisma.builderProject.create as jest.Mock).mockResolvedValue({
        id: 'project-1',
        status: 'ACTIVE',
        totalUnits: 48,
      });

      const result = await service.createProject('builder-1', {
        name: 'Test Project',
        totalUnits: 48,
        location: 'Lucknow, UP',
        projectType: 'RESIDENTIAL',
        cityId: 'city-1',
      });

      expect(result.status).toBe('ACTIVE');
    });
  });

  // Story 11-8: Contracts
  describe('createContract', () => {
    it('should generate unique contract number', async () => {
      (mockPrisma.builderContract.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.builderContract.create as jest.Mock).mockImplementation(
        ({ data }: any) => Promise.resolve({ id: 'contract-1', ...data })
      );

      const result = await service.createContract('builder-1', {
        serviceIds: ['svc-1'],
        unitCount: 48,
        discountPct: 20,
        validFrom: '2026-02-01T00:00:00Z',
        validTo: '2027-02-01T00:00:00Z',
        autoRenew: true,
      });

      expect(result.contractNumber).toMatch(/^PLA-CNTR-\d{4}-\d{5}$/);
    });
  });

  // Story 11-9: Anti-spam
  describe('createBroadcast', () => {
    it('should enforce 2 broadcasts per week limit', async () => {
      (mockPrisma.builderBroadcast.count as jest.Mock).mockResolvedValue(2);

      await expect(
        service.createBroadcast('builder-1', 'project-1', {
          message: 'Test broadcast',
          recipientFilter: { allUnits: true },
        })
      ).rejects.toThrow('Maximum 2 broadcasts per week');
    });
  });
});
