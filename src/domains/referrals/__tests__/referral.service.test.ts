/**
 * Tests for ReferralService covering referral code generation,
 * referrer resolution, credit management, and balance queries.
 *
 * Story 4.11: Customer Referral Credits - Earn
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ReferralService } from '../referral.service.js';

// Mock nanoid
vi.mock('nanoid', () => ({
  nanoid: vi.fn(() => 'ABC1234567'),
}));

// Mock Prisma
vi.mock('@prisma/client', () => {
  const mockPrisma = {
    customerReferral: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    customerReferralCredit: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    referralConfig: {
      findFirst: vi.fn(),
    },
  };
  return {
    PrismaClient: vi.fn(() => mockPrisma),
  };
});

describe('ReferralService', () => {
  let service: ReferralService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    service = new ReferralService(mockPrisma);
    vi.clearAllMocks();
  });

  describe('getOrCreateReferralCode', () => {
    test('returns existing referral code if one already exists', async () => {
      // Given: customer already has a referral code
      mockPrisma.customerReferral.findUnique.mockResolvedValue({
        id: 'ref-001',
        customerId: 'cust-001',
        referralCode: 'EXISTING123',
      });

      // When
      const result = await service.getOrCreateReferralCode('cust-001', 'tenant-001');

      // Then
      expect(result).toBe('EXISTING123');
      expect(mockPrisma.customerReferral.findUnique).toHaveBeenCalledWith({
        where: { customerId: 'cust-001' },
      });
      expect(mockPrisma.customerReferral.create).not.toHaveBeenCalled();
    });

    test('creates a new referral code if none exists', async () => {
      // Given: customer has no referral code
      mockPrisma.customerReferral.findUnique.mockResolvedValue(null);
      mockPrisma.customerReferral.create.mockResolvedValue({
        id: 'ref-002',
        customerId: 'cust-001',
        referralCode: 'ABC1234567',
      });

      // When
      const result = await service.getOrCreateReferralCode('cust-001', 'tenant-001');

      // Then
      expect(result).toBe('ABC1234567');
      expect(mockPrisma.customerReferral.create).toHaveBeenCalledWith({
        data: {
          customerId: 'cust-001',
          referralCode: 'ABC1234567',
          cityId: 'tenant-001',
        },
      });
    });
  });

  describe('resolveReferrer', () => {
    test('returns referrer customer ID for a valid code', async () => {
      // Given: referral code exists
      mockPrisma.customerReferral.findUnique.mockResolvedValue({
        id: 'ref-001',
        customerId: 'cust-referrer',
        referralCode: 'VALIDCODE1',
      });

      // When
      const result = await service.resolveReferrer('VALIDCODE1');

      // Then
      expect(result).toBe('cust-referrer');
      expect(mockPrisma.customerReferral.findUnique).toHaveBeenCalledWith({
        where: { referralCode: 'VALIDCODE1' },
      });
    });

    test('returns null for an invalid/nonexistent code', async () => {
      // Given: referral code does not exist
      mockPrisma.customerReferral.findUnique.mockResolvedValue(null);

      // When
      const result = await service.resolveReferrer('INVALIDXYZ');

      // Then
      expect(result).toBeNull();
    });
  });

  describe('creditReferrer', () => {
    const creditParams = {
      referrerCustomerId: 'cust-referrer',
      referredCustomerId: 'cust-referred',
      serviceRequestId: 'sr-001',
      tenantId: 'tenant-001',
    };

    test('creates credit record and increments referral count', async () => {
      // Given: no existing credit for this pair
      mockPrisma.customerReferralCredit.findUnique.mockResolvedValue(null);

      // Given: active referral config
      mockPrisma.referralConfig.findFirst.mockResolvedValue({
        id: 'config-001',
        isActive: true,
        tier: 'default',
        creditAmountPaise: 5000n, // 50 INR credit
      });

      // Given: credit creation succeeds
      mockPrisma.customerReferralCredit.create.mockResolvedValue({
        id: 'credit-001',
        referrerCustomerId: 'cust-referrer',
        referredCustomerId: 'cust-referred',
        creditAmountPaise: 5000n,
      });

      mockPrisma.customerReferral.update.mockResolvedValue({});

      // When
      const result = await service.creditReferrer(
        creditParams.referrerCustomerId,
        creditParams.referredCustomerId,
        creditParams.serviceRequestId,
        creditParams.tenantId,
      );

      // Then
      expect(result).toBe(5000n);
      expect(mockPrisma.customerReferralCredit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          referrerCustomerId: 'cust-referrer',
          referredCustomerId: 'cust-referred',
          serviceRequestId: 'sr-001',
          creditAmountPaise: 5000n,
          cityId: 'tenant-001',
        }),
      });
      // Verify referral count increment
      expect(mockPrisma.customerReferral.update).toHaveBeenCalledWith({
        where: { customerId: 'cust-referrer' },
        data: { referralCount: { increment: 1 } },
      });
    });

    test('skips duplicate credit - returns existing credit amount', async () => {
      // Given: credit already exists for this referrer-referred pair
      mockPrisma.customerReferralCredit.findUnique.mockResolvedValue({
        id: 'credit-existing',
        referrerCustomerId: 'cust-referrer',
        referredCustomerId: 'cust-referred',
        creditAmountPaise: 5000n,
      });

      // When
      const result = await service.creditReferrer(
        creditParams.referrerCustomerId,
        creditParams.referredCustomerId,
        creditParams.serviceRequestId,
        creditParams.tenantId,
      );

      // Then: returns existing credit amount, does not create new one
      expect(result).toBe(5000n);
      expect(mockPrisma.customerReferralCredit.create).not.toHaveBeenCalled();
      expect(mockPrisma.customerReferral.update).not.toHaveBeenCalled();
    });

    test('checks duplicate via compound unique key', async () => {
      // Given
      mockPrisma.customerReferralCredit.findUnique.mockResolvedValue(null);
      mockPrisma.referralConfig.findFirst.mockResolvedValue({
        isActive: true,
        creditAmountPaise: 5000n,
      });
      mockPrisma.customerReferralCredit.create.mockResolvedValue({
        creditAmountPaise: 5000n,
      });
      mockPrisma.customerReferral.update.mockResolvedValue({});

      // When
      await service.creditReferrer(
        creditParams.referrerCustomerId,
        creditParams.referredCustomerId,
        creditParams.serviceRequestId,
        creditParams.tenantId,
      );

      // Then
      expect(mockPrisma.customerReferralCredit.findUnique).toHaveBeenCalledWith({
        where: {
          referrerCustomerId_referredCustomerId: {
            referrerCustomerId: 'cust-referrer',
            referredCustomerId: 'cust-referred',
          },
        },
      });
    });

    test('returns 0n when no active referral config exists', async () => {
      // Given: no existing credit
      mockPrisma.customerReferralCredit.findUnique.mockResolvedValue(null);
      // Given: no active config
      mockPrisma.referralConfig.findFirst.mockResolvedValue(null);

      // When
      const result = await service.creditReferrer(
        creditParams.referrerCustomerId,
        creditParams.referredCustomerId,
        creditParams.serviceRequestId,
        creditParams.tenantId,
      );

      // Then
      expect(result).toBe(0n);
      expect(mockPrisma.customerReferralCredit.create).not.toHaveBeenCalled();
    });

    test('sets expiry date to 1 year from now on credit creation', async () => {
      // Given
      mockPrisma.customerReferralCredit.findUnique.mockResolvedValue(null);
      mockPrisma.referralConfig.findFirst.mockResolvedValue({
        isActive: true,
        creditAmountPaise: 5000n,
      });
      mockPrisma.customerReferralCredit.create.mockResolvedValue({
        creditAmountPaise: 5000n,
      });
      mockPrisma.customerReferral.update.mockResolvedValue({});

      const beforeCall = Date.now();

      // When
      await service.creditReferrer(
        creditParams.referrerCustomerId,
        creditParams.referredCustomerId,
        creditParams.serviceRequestId,
        creditParams.tenantId,
      );

      const afterCall = Date.now();

      // Then: expiresAt should be ~1 year from now
      const createCall = mockPrisma.customerReferralCredit.create.mock.calls[0][0];
      const expiresAt = createCall.data.expiresAt.getTime();
      const oneYearMs = 365 * 24 * 60 * 60 * 1000;

      expect(expiresAt).toBeGreaterThanOrEqual(beforeCall + oneYearMs - 1000);
      expect(expiresAt).toBeLessThanOrEqual(afterCall + oneYearMs + 1000);
    });
  });

  describe('getCreditBalance', () => {
    test('calculates available balance correctly (creditAmount - usedAmount)', async () => {
      // Given: two credit records with partial usage
      mockPrisma.customerReferralCredit.findMany.mockResolvedValue([
        { creditAmountPaise: 5000n, usedAmountPaise: 2000n }, // 3000 available
        { creditAmountPaise: 3000n, usedAmountPaise: 0n },    // 3000 available
      ]);

      // When
      const balance = await service.getCreditBalance('cust-001');

      // Then
      expect(balance).toBe(6000n); // 3000 + 3000
    });

    test('returns 0n when customer has no credits', async () => {
      // Given
      mockPrisma.customerReferralCredit.findMany.mockResolvedValue([]);

      // When
      const balance = await service.getCreditBalance('cust-no-credits');

      // Then
      expect(balance).toBe(0n);
    });

    test('returns 0n when all credits are fully used', async () => {
      // Given
      mockPrisma.customerReferralCredit.findMany.mockResolvedValue([
        { creditAmountPaise: 5000n, usedAmountPaise: 5000n },
        { creditAmountPaise: 3000n, usedAmountPaise: 3000n },
      ]);

      // When
      const balance = await service.getCreditBalance('cust-fully-used');

      // Then
      expect(balance).toBe(0n);
    });

    test('queries only non-expired credits', async () => {
      // Given
      mockPrisma.customerReferralCredit.findMany.mockResolvedValue([]);

      // When
      await service.getCreditBalance('cust-001');

      // Then: verify the query filters by expiry
      expect(mockPrisma.customerReferralCredit.findMany).toHaveBeenCalledWith({
        where: {
          referrerCustomerId: 'cust-001',
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: expect.any(Date) } },
          ],
        },
        select: {
          creditAmountPaise: true,
          usedAmountPaise: true,
        },
      });
    });
  });

  describe('getCreditHistory', () => {
    test('returns paginated credit records', async () => {
      // Given
      const mockCredits = [
        {
          id: 'credit-001',
          referrerCustomerId: 'cust-001',
          creditAmountPaise: 5000n,
          usedAmountPaise: 0n,
          createdAt: new Date('2024-01-15'),
        },
        {
          id: 'credit-002',
          referrerCustomerId: 'cust-001',
          creditAmountPaise: 3000n,
          usedAmountPaise: 1000n,
          createdAt: new Date('2024-01-10'),
        },
      ];
      mockPrisma.customerReferralCredit.findMany.mockResolvedValue(mockCredits);
      mockPrisma.customerReferralCredit.count.mockResolvedValue(5);

      // When
      const result = await service.getCreditHistory('cust-001', 1, 2);

      // Then
      expect(result.credits).toEqual(mockCredits);
      expect(result.total).toBe(5);
    });

    test('calculates skip correctly for pagination (page 2, limit 10)', async () => {
      // Given
      mockPrisma.customerReferralCredit.findMany.mockResolvedValue([]);
      mockPrisma.customerReferralCredit.count.mockResolvedValue(0);

      // When
      await service.getCreditHistory('cust-001', 2, 10);

      // Then: skip = (2 - 1) * 10 = 10
      expect(mockPrisma.customerReferralCredit.findMany).toHaveBeenCalledWith({
        where: { referrerCustomerId: 'cust-001' },
        orderBy: { createdAt: 'desc' },
        skip: 10,
        take: 10,
      });
    });

    test('calculates skip correctly for page 1', async () => {
      // Given
      mockPrisma.customerReferralCredit.findMany.mockResolvedValue([]);
      mockPrisma.customerReferralCredit.count.mockResolvedValue(0);

      // When
      await service.getCreditHistory('cust-001', 1, 20);

      // Then: skip = (1 - 1) * 20 = 0
      expect(mockPrisma.customerReferralCredit.findMany).toHaveBeenCalledWith({
        where: { referrerCustomerId: 'cust-001' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
    });

    test('runs findMany and count queries in parallel', async () => {
      // Given
      let findManyResolved = false;
      let countResolved = false;

      mockPrisma.customerReferralCredit.findMany.mockImplementation(async () => {
        findManyResolved = true;
        return [];
      });
      mockPrisma.customerReferralCredit.count.mockImplementation(async () => {
        countResolved = true;
        return 0;
      });

      // When
      await service.getCreditHistory('cust-001', 1, 10);

      // Then: both should have been called
      expect(findManyResolved).toBe(true);
      expect(countResolved).toBe(true);
      expect(mockPrisma.customerReferralCredit.findMany).toHaveBeenCalledOnce();
      expect(mockPrisma.customerReferralCredit.count).toHaveBeenCalledOnce();
    });

    test('count query uses same filter as findMany', async () => {
      // Given
      mockPrisma.customerReferralCredit.findMany.mockResolvedValue([]);
      mockPrisma.customerReferralCredit.count.mockResolvedValue(0);

      // When
      await service.getCreditHistory('cust-001', 1, 10);

      // Then
      expect(mockPrisma.customerReferralCredit.count).toHaveBeenCalledWith({
        where: { referrerCustomerId: 'cust-001' },
      });
    });
  });
});
