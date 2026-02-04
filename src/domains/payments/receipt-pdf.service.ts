/**
 * Receipt PDF generation service for payment history & govt fee receipts.
 *
 * Story 4.7: Customer Payment History & Govt Fee Receipts
 */
import { PrismaClient } from '@prisma/client';
import PDFDocument from 'pdfkit';
import { AppError } from '../../core/errors/app-error.js';

export class ReceiptPdfService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Generates a payment receipt PDF as a Buffer.
   * Story 4.7 AC3
   */
  async generateReceipt(paymentId: string): Promise<Buffer> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new AppError('PAYMENT_NOT_FOUND', 'Payment not found', 404);
    }

    return new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const doc = new PDFDocument({ margin: 50 });

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text('Property Legal Agent', { align: 'center' });
      doc.fontSize(14).text('Payment Receipt', { align: 'center' });
      doc.moveDown();

      // Receipt details
      doc.fontSize(10);
      doc.text(`Receipt #: ${payment.id}`);
      doc.text(`Date: ${payment.paidAt?.toLocaleDateString('en-IN') ?? payment.createdAt.toLocaleDateString('en-IN')}`);
      doc.text(`Service Request ID: ${payment.serviceRequestId}`);
      doc.moveDown();

      // Payment amount
      const amountRupees = payment.amountPaise / 100;
      doc.fontSize(12).text(`Amount: INR ${amountRupees.toFixed(2)}`);
      doc.text(`Payment Method: ${payment.paymentMethodType}`);
      doc.text(`Status: ${payment.status}`);

      if (payment.razorpayPaymentId) {
        doc.text(`Razorpay Payment ID: ${payment.razorpayPaymentId}`);
      }

      doc.moveDown(2);
      doc.fontSize(8).text('This is a computer-generated receipt.', { align: 'center' });

      doc.end();
    });
  }

  /**
   * Gets payment history for a customer.
   * Story 4.7 AC1
   */
  async getPaymentHistory(customerId: string, page: number, limit: number) {
    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where: { customerId, status: 'paid' },
        orderBy: { paidAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({
        where: { customerId, status: 'paid' },
      }),
    ]);

    return {
      payments: payments.map((p) => ({
        id: p.id,
        amountPaise: p.amountPaise.toString(),
        paymentMethodType: p.paymentMethodType,
        status: p.status,
        serviceRequestId: p.serviceRequestId,
        razorpayPaymentId: p.razorpayPaymentId,
        paidAt: p.paidAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
      pagination: { page, limit, total },
    };
  }
}
