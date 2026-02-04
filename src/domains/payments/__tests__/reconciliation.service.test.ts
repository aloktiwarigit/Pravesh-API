/**
 * [P1] Tests for cash reconciliation service
 * Story 4.8: Cash Reconciliation Dashboard for Ops
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ReconciliationService } from '../reconciliation.service.js';

// Mock Prisma
vi.mock('@prisma/client', () => {
  const mockPrisma = {
    payment: {
      findMany: vi.fn(),
    },
    cashReceipt: {
      findMany: vi.fn(),
    },
    cashReconciliationLog: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
  };
  return {
    PrismaClient: vi.fn(() => mockPrisma),
  };
});

describe('[P1] ReconciliationService - Daily Reconciliation', () => {
  let service: ReconciliationService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    service = new ReconciliationService(mockPrisma);
    vi.clearAllMocks();
  });

  test('runDailyReconciliation returns MATCHED when totals are equal', async () => {
    // Given
    const tenantId = 'tenant_123';
    const date = new Date('2025-01-15T12:00:00Z');

    mockPrisma.payment.findMany.mockResolvedValue([
      { id: 'pay_1', amountPaise: 10000n, status: 'SUCCESS' },
      { id: 'pay_2', amountPaise: 15000n, status: 'SUCCESS' },
      { id: 'pay_3', amountPaise: 5000n, status: 'SUCCESS' },
    ]);

    mockPrisma.cashReceipt.findMany.mockResolvedValue([
      { id: 'rcpt_1', amountPaise: 10000n },
      { id: 'rcpt_2', amountPaise: 20000n },
    ]);

    mockPrisma.cashReconciliationLog.create.mockResolvedValue({
      id: 'log_123',
      tenantId,
      reconciliationDate: new Date('2025-01-15T00:00:00Z'),
      totalPaymentsPaise: 30000n,
      totalCashReceiptsPaise: 30000n,
      discrepancyPaise: 0n,
      status: 'MATCHED',
      paymentCount: 3,
      receiptCount: 2,
    });

    // When
    const result = await service.runDailyReconciliation(tenantId, date);

    // Then
    expect(result.status).toBe('MATCHED');
    expect(result.totalPaymentsPaise).toBe('30000');
    expect(result.totalCashReceiptsPaise).toBe('30000');
    expect(result.discrepancyPaise).toBe('0');
    expect(result.paymentCount).toBe(3);
    expect(result.receiptCount).toBe(2);
  });

  test('runDailyReconciliation returns SHORTAGE when deposits < collections', async () => {
    // Given
    const tenantId = 'tenant_123';
    const date = new Date('2025-01-15T12:00:00Z');

    mockPrisma.payment.findMany.mockResolvedValue([
      { id: 'pay_1', amountPaise: 50000n, status: 'SUCCESS' },
    ]);

    mockPrisma.cashReceipt.findMany.mockResolvedValue([
      { id: 'rcpt_1', amountPaise: 40000n }, // Short by 10000
    ]);

    mockPrisma.cashReconciliationLog.create.mockResolvedValue({
      id: 'log_123',
      tenantId,
      reconciliationDate: new Date('2025-01-15T00:00:00Z'),
      totalPaymentsPaise: 50000n,
      totalCashReceiptsPaise: 40000n,
      discrepancyPaise: 10000n, // Positive = shortage
      status: 'SHORTAGE',
      paymentCount: 1,
      receiptCount: 1,
    });

    // When
    const result = await service.runDailyReconciliation(tenantId, date);

    // Then
    expect(result.status).toBe('SHORTAGE');
    expect(result.totalPaymentsPaise).toBe('50000');
    expect(result.totalCashReceiptsPaise).toBe('40000');
    expect(result.discrepancyPaise).toBe('10000'); // Positive discrepancy
  });

  test('runDailyReconciliation returns EXCESS when deposits > collections', async () => {
    // Given
    const tenantId = 'tenant_123';
    const date = new Date('2025-01-15T12:00:00Z');

    mockPrisma.payment.findMany.mockResolvedValue([
      { id: 'pay_1', amountPaise: 30000n, status: 'SUCCESS' },
    ]);

    mockPrisma.cashReceipt.findMany.mockResolvedValue([
      { id: 'rcpt_1', amountPaise: 35000n }, // Excess of 5000
    ]);

    mockPrisma.cashReconciliationLog.create.mockResolvedValue({
      id: 'log_123',
      tenantId,
      reconciliationDate: new Date('2025-01-15T00:00:00Z'),
      totalPaymentsPaise: 30000n,
      totalCashReceiptsPaise: 35000n,
      discrepancyPaise: -5000n, // Negative = excess
      status: 'EXCESS',
      paymentCount: 1,
      receiptCount: 1,
    });

    // When
    const result = await service.runDailyReconciliation(tenantId, date);

    // Then
    expect(result.status).toBe('EXCESS');
    expect(result.totalPaymentsPaise).toBe('30000');
    expect(result.totalCashReceiptsPaise).toBe('35000');
    expect(result.discrepancyPaise).toBe('-5000'); // Negative discrepancy
  });

  test('runDailyReconciliation handles BigInt arithmetic correctly', async () => {
    // Given - large amounts to test BigInt handling
    const tenantId = 'tenant_123';
    const date = new Date('2025-01-15T12:00:00Z');

    mockPrisma.payment.findMany.mockResolvedValue([
      { id: 'pay_1', amountPaise: 999999999999n },
      { id: 'pay_2', amountPaise: 1n },
    ]);

    mockPrisma.cashReceipt.findMany.mockResolvedValue([
      { id: 'rcpt_1', amountPaise: 500000000000n },
      { id: 'rcpt_2', amountPaise: 500000000000n },
    ]);

    mockPrisma.cashReconciliationLog.create.mockImplementation(async (args) => {
      return {
        id: 'log_123',
        ...args.data,
      };
    });

    // When
    const result = await service.runDailyReconciliation(tenantId, date);

    // Then
    expect(mockPrisma.cashReconciliationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        totalPaymentsPaise: 1000000000000n, // 999999999999 + 1
        totalCashReceiptsPaise: 1000000000000n, // 500000000000 + 500000000000
        discrepancyPaise: 0n, // Match
        status: 'MATCHED',
      }),
    });
  });

  test('runDailyReconciliation handles empty collections correctly', async () => {
    // Given - no payments
    const tenantId = 'tenant_123';
    const date = new Date('2025-01-15T12:00:00Z');

    mockPrisma.payment.findMany.mockResolvedValue([]);
    mockPrisma.cashReceipt.findMany.mockResolvedValue([
      { id: 'rcpt_1', amountPaise: 10000n },
    ]);

    mockPrisma.cashReconciliationLog.create.mockResolvedValue({
      id: 'log_123',
      tenantId,
      reconciliationDate: new Date('2025-01-15T00:00:00Z'),
      totalPaymentsPaise: 0n,
      totalCashReceiptsPaise: 10000n,
      discrepancyPaise: -10000n,
      status: 'EXCESS',
      paymentCount: 0,
      receiptCount: 1,
    });

    // When
    const result = await service.runDailyReconciliation(tenantId, date);

    // Then
    expect(result.status).toBe('EXCESS');
    expect(result.totalPaymentsPaise).toBe('0');
    expect(result.paymentCount).toBe(0);
  });

  test('runDailyReconciliation handles empty deposits correctly', async () => {
    // Given - no receipts
    const tenantId = 'tenant_123';
    const date = new Date('2025-01-15T12:00:00Z');

    mockPrisma.payment.findMany.mockResolvedValue([
      { id: 'pay_1', amountPaise: 10000n, status: 'SUCCESS' },
    ]);
    mockPrisma.cashReceipt.findMany.mockResolvedValue([]);

    mockPrisma.cashReconciliationLog.create.mockResolvedValue({
      id: 'log_123',
      tenantId,
      reconciliationDate: new Date('2025-01-15T00:00:00Z'),
      totalPaymentsPaise: 10000n,
      totalCashReceiptsPaise: 0n,
      discrepancyPaise: 10000n,
      status: 'SHORTAGE',
      paymentCount: 1,
      receiptCount: 0,
    });

    // When
    const result = await service.runDailyReconciliation(tenantId, date);

    // Then
    expect(result.status).toBe('SHORTAGE');
    expect(result.totalCashReceiptsPaise).toBe('0');
    expect(result.receiptCount).toBe(0);
  });

  test('runDailyReconciliation queries correct date range', async () => {
    // Given
    const tenantId = 'tenant_123';
    const date = new Date('2025-01-15T14:30:00Z'); // Mid-day

    mockPrisma.payment.findMany.mockResolvedValue([]);
    mockPrisma.cashReceipt.findMany.mockResolvedValue([]);
    mockPrisma.cashReconciliationLog.create.mockResolvedValue({
      id: 'log_123',
      tenantId,
      reconciliationDate: new Date('2025-01-15T00:00:00Z'),
      totalPaymentsPaise: 0n,
      totalCashReceiptsPaise: 0n,
      discrepancyPaise: 0n,
      status: 'MATCHED',
      paymentCount: 0,
      receiptCount: 0,
    });

    // When
    await service.runDailyReconciliation(tenantId, date);

    // Then
    expect(mockPrisma.payment.findMany).toHaveBeenCalledWith({
      where: {
        tenantId,
        status: 'SUCCESS',
        paidAt: {
          gte: expect.any(Date),
          lte: expect.any(Date),
        },
      },
    });

    const paymentCall = mockPrisma.payment.findMany.mock.calls[0][0];
    const startOfDay = paymentCall.where.paidAt.gte;
    const endOfDay = paymentCall.where.paidAt.lte;

    expect(startOfDay.getHours()).toBe(0);
    expect(startOfDay.getMinutes()).toBe(0);
    expect(endOfDay.getHours()).toBe(23);
    expect(endOfDay.getMinutes()).toBe(59);
  });
});

describe('[P1] ReconciliationService - Reconciliation Logs Retrieval', () => {
  let service: ReconciliationService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = new PrismaClient();
    service = new ReconciliationService(mockPrisma);
    vi.clearAllMocks();
  });

  test('getReconciliationLogs retrieves logs for date range', async () => {
    // Given
    const tenantId = 'tenant_123';
    const startDate = new Date('2025-01-01T00:00:00Z');
    const endDate = new Date('2025-01-31T23:59:59Z');

    mockPrisma.cashReconciliationLog.findMany.mockResolvedValue([
      {
        id: 'log_1',
        reconciliationDate: new Date('2025-01-15T00:00:00Z'),
        totalPaymentsPaise: 10000n,
        totalCashReceiptsPaise: 10000n,
        discrepancyPaise: 0n,
        status: 'MATCHED',
        paymentCount: 2,
        receiptCount: 2,
      },
      {
        id: 'log_2',
        reconciliationDate: new Date('2025-01-16T00:00:00Z'),
        totalPaymentsPaise: 20000n,
        totalCashReceiptsPaise: 18000n,
        discrepancyPaise: 2000n,
        status: 'SHORTAGE',
        paymentCount: 3,
        receiptCount: 2,
      },
    ]);

    // When
    const result = await service.getReconciliationLogs(tenantId, startDate, endDate);

    // Then
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('log_1');
    expect(result[0].status).toBe('MATCHED');
    expect(result[1].id).toBe('log_2');
    expect(result[1].status).toBe('SHORTAGE');
  });

  test('getReconciliationLogs converts BigInt to string', async () => {
    // Given
    const tenantId = 'tenant_123';
    const startDate = new Date('2025-01-01');
    const endDate = new Date('2025-01-31');

    mockPrisma.cashReconciliationLog.findMany.mockResolvedValue([
      {
        id: 'log_1',
        reconciliationDate: new Date('2025-01-15'),
        totalPaymentsPaise: 123456789n,
        totalCashReceiptsPaise: 987654321n,
        discrepancyPaise: -864197532n,
        status: 'EXCESS',
        paymentCount: 5,
        receiptCount: 3,
      },
    ]);

    // When
    const result = await service.getReconciliationLogs(tenantId, startDate, endDate);

    // Then
    expect(typeof result[0].totalPaymentsPaise).toBe('string');
    expect(result[0].totalPaymentsPaise).toBe('123456789');
    expect(typeof result[0].totalCashReceiptsPaise).toBe('string');
    expect(result[0].totalCashReceiptsPaise).toBe('987654321');
    expect(typeof result[0].discrepancyPaise).toBe('string');
    expect(result[0].discrepancyPaise).toBe('-864197532');
  });
});
