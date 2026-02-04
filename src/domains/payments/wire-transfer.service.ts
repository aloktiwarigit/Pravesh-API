// Story 13-2: Wire Transfer Tracking & Reconciliation
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

export class WireTransferService {
  constructor(private prisma: PrismaClient) {}

  private generateReferenceCode(serviceRequestId: string): string {
    const shortId = serviceRequestId.slice(0, 8);
    const random = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `WT-${shortId}-${random}`;
  }

  async initiateWireTransfer(params: {
    serviceRequestId: string;
    customerId: string;
    amountPaise: number;
    foreignCurrencyCode?: string;
    foreignAmount?: number;
  }) {
    const referenceCode = this.generateReferenceCode(params.serviceRequestId);
    const slaDeadline = new Date();
    slaDeadline.setDate(slaDeadline.getDate() + 7);

    // Create payment record with wire_transfer type
    const payment = await this.prisma.payment.create({
      data: {
        id: crypto.randomUUID(),
        serviceRequestId: params.serviceRequestId,
        customerId: params.customerId,
        amountPaise: params.amountPaise,
        status: 'pending_wire_transfer',
        paymentMethodType: 'wire_transfer',
        isNriPayment: true,
        foreignCurrencyCode: params.foreignCurrencyCode || null,
        foreignCurrencyAmount: params.foreignAmount || null,
      },
    });

    // Create wire transfer record
    const wireTransfer = await this.prisma.wireTransfer.create({
      data: {
        id: crypto.randomUUID(),
        paymentId: payment.id,
        serviceRequestId: params.serviceRequestId,
        customerId: params.customerId,
        referenceCode,
        amountPaise: params.amountPaise,
        foreignCurrencyCode: params.foreignCurrencyCode || null,
        foreignAmount: params.foreignAmount || null,
        accountNumber: process.env.WIRE_TRANSFER_ACCOUNT_NUMBER || 'TBD',
        slaDeadline,
      },
    });

    return {
      wireTransferId: wireTransfer.id,
      referenceCode,
      bankName: wireTransfer.bankName,
      swiftCode: wireTransfer.swiftCode,
      accountNumber: wireTransfer.accountNumber,
      amountPaise: params.amountPaise,
      slaDeadline: slaDeadline.toISOString(),
    };
  }

  async reconcileWireTransfer(params: {
    wireTransferId: string;
    receivedAmountPaise: number;
    bankStatementUrl: string;
    reconciledByUserId: string;
  }) {
    const wt = await this.prisma.wireTransfer.findUniqueOrThrow({
      where: { id: params.wireTransferId },
    });

    const variance = params.receivedAmountPaise - wt.amountPaise;

    const updated = await this.prisma.wireTransfer.update({
      where: { id: params.wireTransferId },
      data: {
        status: 'reconciled',
        receivedAmount: params.receivedAmountPaise,
        varianceAmount: variance,
        bankStatementUrl: params.bankStatementUrl,
        reconciledByUserId: params.reconciledByUserId,
        reconciledAt: new Date(),
      },
    });

    // Update payment status to paid
    await this.prisma.payment.update({
      where: { id: wt.paymentId },
      data: { status: 'paid', paidAt: new Date() },
    });

    return { ...updated, hasVariance: variance !== 0 };
  }

  async getPendingWireTransfers() {
    return this.prisma.wireTransfer.findMany({
      where: { status: 'pending' },
      orderBy: { createdAt: 'asc' },
    });
  }

  async getExpiringSoonTransfers() {
    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);
    return this.prisma.wireTransfer.findMany({
      where: {
        status: 'pending',
        slaDeadline: { lte: twoDaysFromNow },
      },
    });
  }

  async getWireTransferByReference(referenceCode: string) {
    return this.prisma.wireTransfer.findUnique({
      where: { referenceCode },
    });
  }
}
