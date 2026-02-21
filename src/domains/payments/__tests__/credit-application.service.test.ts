/**
 * [P1] Tests for credit application service - Referral credit logic
 * Story 4.12: Customer Referral Credits - Apply to Payment
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { CreditApplicationService } from '../credit-application.service.js';
import { AppError } from '../../../core/errors/app-error.js';

function createMockPrisma() {
  return {
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
  } as any;
}

describe('[P1] CreditApplicationService - Payment Breakdown Calculation', () => {
  let service: CreditApplicationService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new CreditApplicationService(mockPrisma);
    vi.clearAllMocks();
  });

  test('calculateBreakdown returns zero breakdown when service fees and credits are zero', async () => {
    // Given: a valid service request with no fees
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'sr_456',
      customerId: 'cust_123',
      serviceFeePaise: 0,
      govtFeeEstimatePaise: 0,
    });
    mockPrisma.customerReferralCredit.aggregate.mockResolvedValue({
      _sum: { creditAmountPaise: null, usedAmountPaise: null },
    });

    // When
    const result = await service.calculateBreakdown('cust_123', 'sr_456', true);

    // Then: all paise values are 0
    expect(result.serviceFeePaise).toBe(0n);
    expect(result.govtFeePaise).toBe(0n);
    expect(result.creditsAppliedPaise).toBe(0n);
    expect(result.razorpayChargePaise).toBe(0n);
    expect(result.totalPaise).toBe(0n);
    expect(result.creditBalancePaise).toBe(0n);
    expect(result.creditBalanceAfterPaise).toBe(0n);
  });

  test('calculateBreakdown applies credits to service fee only', async () => {
    // Given: service fee of 10000 paise, credit balance of 3000 paise
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'sr_456',
      customerId: 'cust_123',
      serviceFeePaise: 10000,
      govtFeeEstimatePaise: 5000,
    });
    mockPrisma.customerReferralCredit.aggregate.mockResolvedValue({
      _sum: { creditAmountPaise: 3000n, usedAmountPaise: 0n },
    });

    // When
    const result = await service.calculateBreakdown('cust_123', 'sr_456', true);

    // Then: credits apply to service fee only
    expect(result.serviceFeePaise).toBe(10000n);
    expect(result.govtFeePaise).toBe(5000n);
    expect(result.creditsAppliedPaise).toBe(3000n);
    expect(result.creditBalancePaise).toBe(3000n);
    expect(result.creditBalanceAfterPaise).toBe(0n);
    // razorpayCharge = (serviceFee - credits) + govtFee = 7000 + 5000 = 12000
    expect(result.razorpayChargePaise).toBe(12000n);
    expect(result.totalPaise).toBe(15000n); // serviceFee + govtFee
  });

  test('calculateBreakdown with applyCredits=false does not apply credits', async () => {
    // Given
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'sr_456',
      customerId: 'cust_123',
      serviceFeePaise: 10000,
      govtFeeEstimatePaise: 5000,
    });
    mockPrisma.customerReferralCredit.aggregate.mockResolvedValue({
      _sum: { creditAmountPaise: 3000n, usedAmountPaise: 0n },
    });

    // When
    const result = await service.calculateBreakdown('cust_123', 'sr_456', false);

    // Then
    expect(result.creditsAppliedPaise).toBe(0n);
    expect(result.creditBalancePaise).toBe(3000n);
    expect(result.creditBalanceAfterPaise).toBe(3000n);
  });

  test('calculateBreakdown throws SERVICE_REQUEST_NOT_FOUND for non-existent service', async () => {
    // Given
    mockPrisma.serviceRequest.findUnique.mockResolvedValue(null);

    // When & Then
    await expect(
      service.calculateBreakdown('cust_123', 'sr_nonexistent', true)
    ).rejects.toThrow(AppError);

    await expect(
      service.calculateBreakdown('cust_123', 'sr_nonexistent', true)
    ).rejects.toMatchObject({
      code: 'SERVICE_REQUEST_NOT_FOUND',
      statusCode: 404,
    });
  });

  test('calculateBreakdown throws FORBIDDEN for mismatched customer ID', async () => {
    // Given: service request belongs to a different customer
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'sr_456',
      customerId: 'cust_other',
      serviceFeePaise: 10000,
      govtFeeEstimatePaise: 0,
    });

    // When & Then
    await expect(
      service.calculateBreakdown('cust_123', 'sr_456', true)
    ).rejects.toThrow(AppError);

    await expect(
      service.calculateBreakdown('cust_123', 'sr_456', true)
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      statusCode: 403,
    });
  });

  test('calculateBreakdown looks up serviceRequest by id', async () => {
    // Given
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'sr_456',
      customerId: 'cust_123',
      serviceFeePaise: 0,
      govtFeeEstimatePaise: 0,
    });
    mockPrisma.customerReferralCredit.aggregate.mockResolvedValue({
      _sum: { creditAmountPaise: null, usedAmountPaise: null },
    });

    // When
    await service.calculateBreakdown('cust_123', 'sr_456', true);

    // Then
    expect(mockPrisma.serviceRequest.findUnique).toHaveBeenCalledWith({
      where: { id: 'sr_456' },
    });
  });

  test('calculateBreakdown returns PaymentBreakdown shape', async () => {
    // Given
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'sr_456',
      customerId: 'cust_123',
      serviceFeePaise: 0,
      govtFeeEstimatePaise: 0,
    });
    mockPrisma.customerReferralCredit.aggregate.mockResolvedValue({
      _sum: { creditAmountPaise: null, usedAmountPaise: null },
    });

    // When
    const result = await service.calculateBreakdown('cust_123', 'sr_456', true);

    // Then: result has all required fields
    expect(result).toHaveProperty('serviceFeePaise');
    expect(result).toHaveProperty('govtFeePaise');
    expect(result).toHaveProperty('creditsAppliedPaise');
    expect(result).toHaveProperty('razorpayChargePaise');
    expect(result).toHaveProperty('totalPaise');
    expect(result).toHaveProperty('creditBalancePaise');
    expect(result).toHaveProperty('creditBalanceAfterPaise');
  });

  test('credits capped at service fee when balance exceeds fee', async () => {
    // Given: credit balance exceeds service fee
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: 'sr_456',
      customerId: 'cust_123',
      serviceFeePaise: 5000,
      govtFeeEstimatePaise: 2000,
    });
    mockPrisma.customerReferralCredit.aggregate.mockResolvedValue({
      _sum: { creditAmountPaise: 10000n, usedAmountPaise: 0n },
    });

    // When
    const result = await service.calculateBreakdown('cust_123', 'sr_456', true);

    // Then: credits capped at service fee
    expect(result.creditsAppliedPaise).toBe(5000n);
    expect(result.creditBalanceAfterPaise).toBe(5000n); // 10000 - 5000
    // razorpayCharge = (5000 - 5000) + 2000 = 2000
    expect(result.razorpayChargePaise).toBe(2000n);
  });
});

describe('[P1] CreditApplicationService - Credit Deduction', () => {
  let service: CreditApplicationService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new CreditApplicationService(mockPrisma);
    vi.clearAllMocks();
  });

  test('deductCreditsOnPayment does nothing when creditsToDeduct is zero', async () => {
    // When
    await service.deductCreditsOnPayment('cust_123', 'sr_123', 'pay_456', 0n, 'city_abc');

    // Then: no transaction called, returns cleanly
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  test('deductCreditsOnPayment does nothing for negative creditsToDeduct', async () => {
    // When
    await service.deductCreditsOnPayment('cust_123', 'sr_123', 'pay_456', -100n, 'city_abc');

    // Then: returns immediately due to <= 0 guard
    expect(mockPrisma.$transaction).not.toHaveBeenCalled();
  });

  test('deductCreditsOnPayment calls $transaction for positive credits', async () => {
    // Given: transaction callback will be invoked
    mockPrisma.$transaction.mockImplementation(async (cb: Function) => {
      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValue([
          { id: 'credit_1', creditAmountPaise: 10000n, usedAmountPaise: 0n },
        ]),
        customerReferralCredit: { update: vi.fn().mockResolvedValue({}) },
        creditUsageLog: { create: vi.fn().mockResolvedValue({}) },
      };
      return cb(mockTx);
    });

    // When
    await service.deductCreditsOnPayment('cust_123', 'sr_123', 'pay_456', 5000n, 'city_abc');

    // Then: transaction was called
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  test('deductCreditsOnPayment throws INSUFFICIENT_CREDITS when not enough credits', async () => {
    // Given: no credits available
    mockPrisma.$transaction.mockImplementation(async (cb: Function) => {
      const mockTx = {
        $queryRaw: vi.fn().mockResolvedValue([]),
        customerReferralCredit: { update: vi.fn() },
        creditUsageLog: { create: vi.fn() },
      };
      return cb(mockTx);
    });

    // When & Then
    await expect(
      service.deductCreditsOnPayment('cust_123', 'sr_123', 'pay_456', 5000n, 'city_abc')
    ).rejects.toThrow(AppError);

    await expect(
      service.deductCreditsOnPayment('cust_123', 'sr_123', 'pay_456', 5000n, 'city_abc')
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_CREDITS',
      statusCode: 409,
    });
  });
});
