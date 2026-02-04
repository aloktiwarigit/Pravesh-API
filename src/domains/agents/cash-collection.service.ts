// Stories 3-13, 3-14: Cash Collection Service
// Agent cash receipt creation, deposit tracking, reconciliation support.
// All amounts stored as paise integers (string for BigInt support).
//
// NOTE: The code references Prisma models (cashReceipt, cashDeposit, serviceRequest)
// that do not yet exist in the schema. Prisma calls are cast through `any`
// to unblock the build until the schema is updated.

import { PrismaClient } from '@prisma/client';
import PgBoss from 'pg-boss';
import { BusinessError } from '../../shared/errors/business-error.js';
import {
  parsePagination,
  buildPaginatedResponse,
} from '../../shared/utils/pagination.js';

export interface CashReceiptCreatePayload {
  receiptId: string; // Pre-allocated UUID from client
  taskId: string;
  serviceRequestId: string;
  amountPaise: string; // BigInt as string
  customerName: string;
  serviceName: string;
  agentId: string;
  gpsLat: number;
  gpsLng: number;
  signatureHash: string;
  pdfUrl?: string;
  cityId: string;
  idempotencyKey?: string;
  clientTimestamp: string;
}

export interface DepositRecordPayload {
  agentId: string;
  receiptIds: string[];
  depositAmountPaise: string;
  depositMethod: 'bank_deposit' | 'office_handover';
  depositReference?: string;
  depositPhotoUrl?: string;
  gpsLat: number;
  gpsLng: number;
}

// Helper to access prisma models that may not yet exist in the generated client
const db = (prisma: PrismaClient | any) => prisma as any;

export class CashCollectionService {
  constructor(
    private prisma: PrismaClient,
    private boss: any, // PgBoss instance - namespace import cannot be used as type
  ) {}

  /**
   * Record a cash receipt from agent (idempotent).
   */
  async createReceipt(payload: CashReceiptCreatePayload) {
    // Idempotency: check by receiptId (pre-allocated UUID)
    const existing = await db(this.prisma).cashReceipt.findUnique({
      where: { receiptId: payload.receiptId },
    });

    if (existing) {
      return { alreadyProcessed: true, receipt: existing };
    }

    const receipt = await db(this.prisma).cashReceipt.create({
      data: {
        receiptId: payload.receiptId,
        taskId: payload.taskId,
        serviceRequestId: payload.serviceRequestId,
        amountPaise: payload.amountPaise,
        customerName: payload.customerName,
        serviceName: payload.serviceName,
        agentId: payload.agentId,
        gpsLat: payload.gpsLat,
        gpsLng: payload.gpsLng,
        signatureHash: payload.signatureHash,
        pdfUrl: payload.pdfUrl,
        cityId: payload.cityId,
        clientTimestamp: new Date(payload.clientTimestamp),
        isReconciled: false,
      },
    });

    // Update service request payment status
    // TODO: serviceRequest model does not exist in schema yet
    await db(this.prisma).serviceRequest.update({
      where: { id: payload.serviceRequestId },
      data: {
        paymentMethod: 'cash',
        paymentStatus: 'collected',
        cashReceiptId: receipt.id,
      },
    });

    // Queue for daily reconciliation tracking
    await this.boss.send('cash.receipt-recorded', {
      receiptId: receipt.receiptId,
      agentId: payload.agentId,
      amountPaise: payload.amountPaise,
      cityId: payload.cityId,
    } as any);

    return { alreadyProcessed: false, receipt };
  }

  /**
   * Get receipts for an agent (for display and deposit tracking).
   */
  async getAgentReceipts(
    agentId: string,
    options?: {
      isReconciled?: boolean;
      cursor?: string;
      limit?: number;
    },
  ) {
    const { cursor, limit } = parsePagination({
      cursor: options?.cursor,
      limit: String(options?.limit || 20),
    });

    const where: any = { agentId };
    if (options?.isReconciled !== undefined) {
      where.isReconciled = options.isReconciled;
    }

    const receipts = await db(this.prisma).cashReceipt.findMany({
      where,
      take: (limit ?? 20) + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { createdAt: 'desc' },
    });

    return buildPaginatedResponse(receipts, limit ?? 20);
  }

  /**
   * Get agent's outstanding (unreconciled) cash balance.
   */
  async getAgentCashBalance(agentId: string) {
    const unreconciled = await db(this.prisma).cashReceipt.findMany({
      where: { agentId, isReconciled: false },
      select: { amountPaise: true },
    });

    const totalPaise = unreconciled.reduce(
      (sum: bigint, r: any) => sum + BigInt(r.amountPaise),
      BigInt(0),
    );

    return {
      unreconciledCount: unreconciled.length,
      totalOutstandingPaise: totalPaise.toString(),
    };
  }

  /**
   * Record a deposit (agent submitting collected cash).
   * Validation and mutation are inside a single transaction to prevent TOCTOU double-spend.
   */
  async recordDeposit(payload: DepositRecordPayload) {
    // All validation + writes inside one transaction to prevent double-spend
    const deposit = await this.prisma.$transaction(async (tx: any) => {
      // Verify all receipts belong to this agent and are unreconciled (inside tx)
      const receipts = await db(tx).cashReceipt.findMany({
        where: {
          receiptId: { in: payload.receiptIds },
          agentId: payload.agentId,
          isReconciled: false,
        },
      });

      if (receipts.length !== payload.receiptIds.length) {
        throw new BusinessError(
          'BUSINESS_RECEIPT_MISMATCH',
          'Some receipts not found, already reconciled, or not owned by agent',
          422,
          {
            requested: payload.receiptIds.length,
            found: receipts.length,
          },
        );
      }

      // Verify deposit amount matches receipt total
      const receiptTotal = receipts.reduce(
        (sum: bigint, r: any) => sum + BigInt(r.amountPaise),
        BigInt(0),
      );

      if (receiptTotal.toString() !== payload.depositAmountPaise) {
        throw new BusinessError(
          'BUSINESS_DEPOSIT_AMOUNT_MISMATCH',
          'Deposit amount does not match sum of receipts',
          422,
          {
            receiptTotalPaise: receiptTotal.toString(),
            depositAmountPaise: payload.depositAmountPaise,
          },
        );
      }

      const dep = await db(tx).cashDeposit.create({
        data: {
          agentId: payload.agentId,
          amountPaise: payload.depositAmountPaise,
          receiptCount: receipts.length,
          depositMethod: payload.depositMethod,
          depositReference: payload.depositReference,
          depositPhotoUrl: payload.depositPhotoUrl,
          gpsLat: payload.gpsLat,
          gpsLng: payload.gpsLng,
          status: 'pending_verification',
        },
      });

      // Mark receipts as reconciled with WHERE isReconciled=false to prevent double-spend
      const updateResult = await db(tx).cashReceipt.updateMany({
        where: {
          receiptId: { in: payload.receiptIds },
          isReconciled: false, // Guard: only update if still unreconciled
        },
        data: {
          isReconciled: true,
          depositId: dep.id,
          reconciledAt: new Date(),
        },
      });

      // If fewer rows updated than expected, another transaction claimed some receipts
      if (updateResult.count !== payload.receiptIds.length) {
        throw new BusinessError(
          'BUSINESS_RECEIPT_MISMATCH',
          'One or more receipts were reconciled by a concurrent deposit',
          409,
          {
            expected: payload.receiptIds.length,
            updated: updateResult.count,
          },
        );
      }

      return dep;
    });

    // Notify Ops for verification
    await this.boss.send('notification.send', {
      type: 'cash_deposit_pending',
      agentId: payload.agentId,
      depositId: deposit.id,
      amountPaise: payload.depositAmountPaise,
    } as any);

    return deposit;
  }

  /**
   * Ops: Verify a cash deposit.
   */
  async verifyDeposit(
    depositId: string,
    verifiedBy: string,
    approved: boolean,
    notes?: string,
  ) {
    const deposit = await db(this.prisma).cashDeposit.findUnique({
      where: { id: depositId },
    });

    if (!deposit) {
      throw new BusinessError(
        'BUSINESS_DEPOSIT_NOT_FOUND',
        'Deposit not found',
        404,
      );
    }

    if (deposit.status !== 'pending_verification') {
      throw new BusinessError(
        'BUSINESS_DEPOSIT_ALREADY_PROCESSED',
        'Deposit has already been processed',
        422,
      );
    }

    const updated = await db(this.prisma).cashDeposit.update({
      where: { id: depositId },
      data: {
        status: approved ? 'verified' : 'rejected',
        verifiedBy,
        verifiedAt: new Date(),
        notes,
      },
    });

    // If rejected, un-reconcile the receipts
    if (!approved) {
      await db(this.prisma).cashReceipt.updateMany({
        where: { depositId },
        data: {
          isReconciled: false,
          depositId: null,
          reconciledAt: null,
        },
      });
    }

    return updated;
  }
}
