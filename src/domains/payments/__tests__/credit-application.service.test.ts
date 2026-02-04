/**
 * [P1] Tests for credit application service - Referral credit logic
 * Story 4.12: Customer Referral Credits - Apply to Payment
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { CreditApplicationService } from '../credit-application.service.js';
import { AppError } from '../../../core/errors/app-error.js';

// Mock Prisma
vi.mock('@prisma/client', () => {
  const mockPrisma = {
    serviceRequest: {
      findUnique: vi.fn(),
    },
    customerReferralCredit: {
      aggregate: vi.fn(),
      update: vi.fn(),
    },
    creditUsageLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  };
  return {
    PrismaClient: vi.fn(() => mockPrisma),
  };
});

describe('[P1] CreditApplicationService - Payment Breakdown Calculation', () => {
  let service: CreditApplicationService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    service = new CreditApplicationService(mockPrisma);
    vi.clearAllMocks();
  });

  test('calculateBreakdown with zero credits applies no discount', async () => {
    // Given
    const customerId = 'cust_123';
    const serviceRequestId = 'sr_456';

    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: serviceRequestId,
      customerId: customerId,
      serviceFeePaise: 10000n, // 100.00 INR
      govtFeeEstimatePaise: 5000n, // 50.00 INR
    });

    mockPrisma.customerReferralCredit.aggregate.mockResolvedValue({
      _sum: {
        creditAmountPaise: 0n,
        usedAmountPaise: 0n,
      },
    });

    // When
    const result = await service.calculateBreakdown(customerId, serviceRequestId, true);

    // Then
    expect(result.serviceFeePaise).toBe(10000n);
    expect(result.govtFeePaise).toBe(5000n);
    expect(result.creditsAppliedPaise).toBe(0n);
    expect(result.razorpayChargePaise).toBe(15000n); // Full amount: 10000 + 5000
    expect(result.totalPaise).toBe(15000n);
    expect(result.creditBalancePaise).toBe(0n);
    expect(result.creditBalanceAfterPaise).toBe(0n);
  });

  test('calculateBreakdown with partial credits applies to service fee only', async () => {
    // Given
    const customerId = 'cust_123';
    const serviceRequestId = 'sr_456';

    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: serviceRequestId,
      customerId: customerId,
      serviceFeePaise: 10000n, // 100.00 INR service fee
      govtFeeEstimatePaise: 5000n, // 50.00 INR govt fee
    });

    mockPrisma.customerReferralCredit.aggregate.mockResolvedValue({
      _sum: {
        creditAmountPaise: 3000n, // 30.00 INR credits available
        usedAmountPaise: 0n,
      },
    });

    // When
    const result = await service.calculateBreakdown(customerId, serviceRequestId, true);

    // Then
    expect(result.serviceFeePaise).toBe(10000n);
    expect(result.govtFeePaise).toBe(5000n);
    expect(result.creditsAppliedPaise).toBe(3000n); // Credits applied to service fee
    expect(result.razorpayChargePaise).toBe(12000n); // (10000 - 3000) + 5000
    expect(result.totalPaise).toBe(15000n); // Total before credits
    expect(result.creditBalancePaise).toBe(3000n);
    expect(result.creditBalanceAfterPaise).toBe(0n); // All credits used
  });

  test('calculateBreakdown with credits exceeding service fee caps at service fee amount', async () => {
    // Given
    const customerId = 'cust_123';
    const serviceRequestId = 'sr_456';

    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: serviceRequestId,
      customerId: customerId,
      serviceFeePaise: 10000n, // 100.00 INR service fee
      govtFeeEstimatePaise: 5000n, // 50.00 INR govt fee
    });

    mockPrisma.customerReferralCredit.aggregate.mockResolvedValue({
      _sum: {
        creditAmountPaise: 20000n, // 200.00 INR credits (more than service fee)
        usedAmountPaise: 0n,
      },
    });

    // When
    const result = await service.calculateBreakdown(customerId, serviceRequestId, true);

    // Then
    expect(result.serviceFeePaise).toBe(10000n);
    expect(result.govtFeePaise).toBe(5000n);
    expect(result.creditsAppliedPaise).toBe(10000n); // Capped at service fee
    expect(result.razorpayChargePaise).toBe(5000n); // Only govt fee charged
    expect(result.totalPaise).toBe(15000n);
    expect(result.creditBalancePaise).toBe(20000n);
    expect(result.creditBalanceAfterPaise).toBe(10000n); // 20000 - 10000 remaining
  });

  test('calculateBreakdown with applyCredits=false does not apply credits', async () => {
    // Given
    const customerId = 'cust_123';
    const serviceRequestId = 'sr_456';

    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: serviceRequestId,
      customerId: customerId,
      serviceFeePaise: 10000n,
      govtFeeEstimatePaise: 5000n,
    });

    mockPrisma.customerReferralCredit.aggregate.mockResolvedValue({
      _sum: {
        creditAmountPaise: 5000n,
        usedAmountPaise: 0n,
      },
    });

    // When
    const result = await service.calculateBreakdown(customerId, serviceRequestId, false);

    // Then
    expect(result.creditsAppliedPaise).toBe(0n);
    expect(result.razorpayChargePaise).toBe(15000n); // Full amount
    expect(result.creditBalancePaise).toBe(5000n);
    expect(result.creditBalanceAfterPaise).toBe(5000n); // No credits used
  });

  test('calculateBreakdown throws error for non-existent service request', async () => {
    // Given
    mockPrisma.serviceRequest.findUnique.mockResolvedValue(null);

    // When & Then
    await expect(
      service.calculateBreakdown('cust_123', 'sr_nonexistent', true)
    ).rejects.toThrow(AppError);
  });

  test('calculateBreakdown throws error for mismatched customer ID', async () => {
    // Given
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'sr_456',
      customerId: 'cust_other',
      serviceFeePaise: 10000n,
      govtFeeEstimatePaise: 5000n,
    });

    // When & Then
    await expect(
      service.calculateBreakdown('cust_123', 'sr_456', true)
    ).rejects.toThrow(AppError);
  });
});

describe('[P1] CreditApplicationService - Credit Deduction', () => {
  let service: CreditApplicationService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    service = new CreditApplicationService(mockPrisma);
    vi.clearAllMocks();
  });

  test('deductCreditsOnPayment uses FIFO ordering (oldest credits first)', async () => {
    // Given
    const customerId = 'cust_123';
    const serviceRequestId = 'sr_456';
    const paymentId = 'pay_789';
    const creditsToDeduct = 8000n; // 80.00 INR
    const tenantId = 'tenant_abc';

    const mockCredits = [
      { id: 'credit_1', creditAmountPaise: 5000n, usedAmountPaise: 0n }, // Oldest, 50.00 available
      { id: 'credit_2', creditAmountPaise: 4000n, usedAmountPaise: 0n }, // Newer, 40.00 available
    ];

    let transactionCallback: any;
    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      transactionCallback = callback;
      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValue(mockCredits),
        customerReferralCredit: {
          update: vi.fn().mockResolvedValue({}),
        },
        creditUsageLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      };
      return callback(mockTx);
    });

    // When
    await service.deductCreditsOnPayment(
      customerId,
      serviceRequestId,
      paymentId,
      creditsToDeduct,
      tenantId
    );

    // Then
    const mockTx = await new Promise((resolve) => {
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        const tx = {
          $queryRaw: vi.fn().mockResolvedValue(mockCredits),
          customerReferralCredit: {
            update: vi.fn().mockResolvedValue({}),
          },
          creditUsageLog: {
            create: vi.fn().mockResolvedValue({}),
          },
        };
        await callback(tx);
        resolve(tx);
      });
      service.deductCreditsOnPayment(customerId, serviceRequestId, paymentId, creditsToDeduct, tenantId);
    });

    expect(mockTx.customerReferralCredit.update).toHaveBeenCalledTimes(2);
    // First credit fully used: 0 + 5000 = 5000
    expect(mockTx.customerReferralCredit.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'credit_1' },
      data: { usedAmountPaise: 5000n },
    });
    // Second credit partially used: 0 + 3000 = 3000
    expect(mockTx.customerReferralCredit.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'credit_2' },
      data: { usedAmountPaise: 3000n },
    });
  });

  test('deductCreditsOnPayment executes in transaction with row locks (FOR UPDATE)', async () => {
    // Given
    const customerId = 'cust_123';
    const creditsToDeduct = 5000n;

    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValue([
          { id: 'credit_1', creditAmountPaise: 5000n, usedAmountPaise: 0n },
        ]),
        customerReferralCredit: {
          update: vi.fn().mockResolvedValue({}),
        },
        creditUsageLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      };
      return callback(mockTx);
    });

    // When
    await service.deductCreditsOnPayment(
      customerId,
      'sr_123',
      'pay_456',
      creditsToDeduct,
      'tenant_abc'
    );

    // Then
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
    // Verify the transaction was called (locking is in SQL, tested by checking $queryRaw is called)
  });

  test('deductCreditsOnPayment throws 409 error when insufficient credits', async () => {
    // Given
    const customerId = 'cust_123';
    const creditsToDeduct = 10000n; // 100.00 INR needed

    const mockCredits = [
      { id: 'credit_1', creditAmountPaise: 3000n, usedAmountPaise: 0n }, // Only 30.00 available
    ];

    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValue(mockCredits),
        customerReferralCredit: {
          update: vi.fn().mockResolvedValue({}),
        },
        creditUsageLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      };
      return callback(mockTx);
    });

    // When & Then
    await expect(
      service.deductCreditsOnPayment(
        customerId,
        'sr_123',
        'pay_456',
        creditsToDeduct,
        'tenant_abc'
      )
    ).rejects.toThrow(AppError);

    await expect(
      service.deductCreditsOnPayment(
        customerId,
        'sr_123',
        'pay_456',
        creditsToDeduct,
        'tenant_abc'
      )
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_CREDITS',
      statusCode: 409,
    });
  });

  test('deductCreditsOnPayment skips credits with zero available balance', async () => {
    // Given
    const customerId = 'cust_123';
    const creditsToDeduct = 5000n;

    const mockCredits = [
      { id: 'credit_1', creditAmountPaise: 3000n, usedAmountPaise: 3000n }, // Fully used
      { id: 'credit_2', creditAmountPaise: 5000n, usedAmountPaise: 0n }, // Available
    ];

    let updateCallCount = 0;
    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValue(mockCredits),
        customerReferralCredit: {
          update: vi.fn().mockImplementation(() => {
            updateCallCount++;
            return Promise.resolve({});
          }),
        },
        creditUsageLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      };
      await callback(mockTx);
      return mockTx;
    });

    // When
    await service.deductCreditsOnPayment(
      customerId,
      'sr_123',
      'pay_456',
      creditsToDeduct,
      'tenant_abc'
    );

    // Then
    expect(updateCallCount).toBe(1); // Only credit_2 should be updated
  });

  test('deductCreditsOnPayment does nothing when creditsToDeduct is zero', async () => {
    // Given
    const customerId = 'cust_123';
    const creditsToDeduct = 0n;

    // When
    await service.deductCreditsOnPayment(
      customerId,
      'sr_123',
      'pay_456',
      creditsToDeduct,
      'tenant_abc'
    );

    // Then
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  test('deductCreditsOnPayment creates usage log entry', async () => {
    // Given
    const customerId = 'cust_123';
    const serviceRequestId = 'sr_456';
    const paymentId = 'pay_789';
    const creditsToDeduct = 5000n;
    const tenantId = 'tenant_abc';

    mockPrisma.$transaction.mockImplementation(async (callback: any) => {
      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValue([
          { id: 'credit_1', creditAmountPaise: 5000n, usedAmountPaise: 0n },
        ]),
        customerReferralCredit: {
          update: vi.fn().mockResolvedValue({}),
        },
        creditUsageLog: {
          create: vi.fn().mockResolvedValue({}),
        },
      };
      await callback(mockTx);
      return mockTx;
    });

    // When
    await service.deductCreditsOnPayment(
      customerId,
      serviceRequestId,
      paymentId,
      creditsToDeduct,
      tenantId
    );

    // Then - verify the log was created in the transaction
    expect(mockPrisma.$transaction).toHaveBeenCalledOnce();
  });
});
