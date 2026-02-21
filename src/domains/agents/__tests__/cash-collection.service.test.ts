/**
 * Tests for CashCollectionService
 * Stories 3-13, 3-14: Agent cash receipt creation, idempotency, balance tracking
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CashCollectionService, CashReceiptCreatePayload } from '../cash-collection.service';
import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Mock Prisma + PgBoss factory
// ---------------------------------------------------------------------------
function createMockPrisma() {
  return {
    cashReceipt: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    serviceRequest: {
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  } as unknown as PrismaClient;
}

function createMockBoss() {
  return {
    send: vi.fn().mockResolvedValue(undefined),
  };
}

describe('CashCollectionService', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockBoss: ReturnType<typeof createMockBoss>;
  let service: CashCollectionService;

  const validReceiptPayload: CashReceiptCreatePayload = {
    receiptId: 'receipt-uuid-001',
    taskId: 'task-001',
    serviceRequestId: 'sr-001',
    amountPaise: '150000', // Rs. 1500
    customerName: 'Priya Singh',
    serviceName: 'Title Check',
    agentId: 'agent-001',
    gpsLat: 26.8467,
    gpsLng: 80.9462,
    signatureHash: 'abc123def456',
    cityId: 'city-001',
    clientTimestamp: '2026-02-21T10:00:00.000Z',
  };

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    mockBoss = createMockBoss();
    service = new CashCollectionService(mockPrisma, mockBoss);
    vi.clearAllMocks();
  });

  // ===========================================================================
  // createReceipt — Idempotency
  // ===========================================================================

  describe('createReceipt', () => {
    it('creates a new cash receipt successfully', async () => {
      (mockPrisma.cashReceipt.findUnique as any).mockResolvedValue(null);
      const createdReceipt = {
        id: 'db-receipt-001',
        receiptId: 'receipt-uuid-001',
        amountPaise: '150000',
        agentId: 'agent-001',
        isReconciled: false,
      };
      (mockPrisma.cashReceipt.create as any).mockResolvedValue(createdReceipt);
      (mockPrisma.serviceRequest.update as any).mockResolvedValue({});

      const result = await service.createReceipt(validReceiptPayload);

      expect(result.alreadyProcessed).toBe(false);
      expect(result.receipt.receiptId).toBe('receipt-uuid-001');
      expect(mockPrisma.cashReceipt.create).toHaveBeenCalledTimes(1);
      expect(mockBoss.send).toHaveBeenCalledWith(
        'cash.receipt-recorded',
        expect.objectContaining({ receiptId: 'receipt-uuid-001' }),
      );
    });

    it('returns alreadyProcessed=true for duplicate receiptId (idempotency)', async () => {
      const existingReceipt = {
        id: 'db-receipt-001',
        receiptId: 'receipt-uuid-001',
        amountPaise: '150000',
        isReconciled: false,
      };
      (mockPrisma.cashReceipt.findUnique as any).mockResolvedValue(existingReceipt);

      const result = await service.createReceipt(validReceiptPayload);

      expect(result.alreadyProcessed).toBe(true);
      expect(result.receipt).toEqual(existingReceipt);
      // Should NOT create a new receipt
      expect(mockPrisma.cashReceipt.create).not.toHaveBeenCalled();
      // Should NOT send boss notification
      expect(mockBoss.send).not.toHaveBeenCalled();
    });

    it('stores the receipt with isReconciled=false', async () => {
      (mockPrisma.cashReceipt.findUnique as any).mockResolvedValue(null);
      (mockPrisma.cashReceipt.create as any).mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'new-id', ...data }),
      );
      (mockPrisma.serviceRequest.update as any).mockResolvedValue({});

      const result = await service.createReceipt(validReceiptPayload);

      expect(result.receipt.isReconciled).toBe(false);
    });

    it('updates service request payment status to collected', async () => {
      (mockPrisma.cashReceipt.findUnique as any).mockResolvedValue(null);
      (mockPrisma.cashReceipt.create as any).mockResolvedValue({
        id: 'receipt-db-001',
        receiptId: 'receipt-uuid-001',
      });
      (mockPrisma.serviceRequest.update as any).mockResolvedValue({});

      await service.createReceipt(validReceiptPayload);

      expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sr-001' },
          data: expect.objectContaining({
            paymentMethod: 'cash',
            paymentStatus: 'collected',
          }),
        }),
      );
    });
  });

  // ===========================================================================
  // getAgentCashBalance
  // ===========================================================================

  describe('getAgentCashBalance', () => {
    it('calculates total outstanding paise from unreconciled receipts', async () => {
      const unreconciledReceipts = [
        { amountPaise: '100000' }, // Rs. 1000
        { amountPaise: '50000' },  // Rs. 500
        { amountPaise: '75000' },  // Rs. 750
      ];
      (mockPrisma.cashReceipt.findMany as any).mockResolvedValue(unreconciledReceipts);

      const result = await service.getAgentCashBalance('agent-001');

      expect(result.unreconciledCount).toBe(3);
      expect(result.totalOutstandingPaise).toBe('225000'); // 100000 + 50000 + 75000
    });

    it('returns zero balance when no unreconciled receipts', async () => {
      (mockPrisma.cashReceipt.findMany as any).mockResolvedValue([]);

      const result = await service.getAgentCashBalance('agent-001');

      expect(result.unreconciledCount).toBe(0);
      expect(result.totalOutstandingPaise).toBe('0');
    });

    it('queries only unreconciled receipts for the agent', async () => {
      (mockPrisma.cashReceipt.findMany as any).mockResolvedValue([]);

      await service.getAgentCashBalance('agent-001');

      expect(mockPrisma.cashReceipt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { agentId: 'agent-001', isReconciled: false },
        }),
      );
    });
  });

  // ===========================================================================
  // getAgentReceipts
  // ===========================================================================

  describe('getAgentReceipts', () => {
    it('returns receipts for an agent', async () => {
      const receipts = [
        { id: 'r-1', receiptId: 'rec-001', amountPaise: '100000' },
        { id: 'r-2', receiptId: 'rec-002', amountPaise: '50000' },
      ];
      (mockPrisma.cashReceipt.findMany as any).mockResolvedValue(receipts);

      const result = await service.getAgentReceipts('agent-001');

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('meta');
      expect(result.meta).toHaveProperty('cursor');
      expect(result.meta).toHaveProperty('hasMore');
    });

    it('filters by isReconciled when specified', async () => {
      (mockPrisma.cashReceipt.findMany as any).mockResolvedValue([]);

      await service.getAgentReceipts('agent-001', { isReconciled: false });

      expect(mockPrisma.cashReceipt.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { agentId: 'agent-001', isReconciled: false },
        }),
      );
    });
  });
});
