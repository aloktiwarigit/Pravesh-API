/**
 * Payment link service for WhatsApp fallback flow.
 *
 * Story 4.2: WhatsApp Payment Link Fallback
 */
import { PrismaClient } from '@prisma/client';
import { PaymentService } from './payment.service.js';

export class PaymentLinkService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly paymentService: PaymentService,
  ) {}

  /**
   * Creates a payment link and sends via WhatsApp.
   * Story 4.2 AC1
   */
  async createAndSendPaymentLink(params: {
    serviceRequestId: string;
    amountPaise: number;
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    description: string;
    expiryMinutes: number;
    customerId: string;
    cityId: string;
  }) {
    const result = await this.paymentService.createPaymentLink(params);

    // Generate WhatsApp deep link with payment URL
    const whatsappMessage = encodeURIComponent(
      `Hi ${params.customerName}, please complete your payment of INR ${Number(params.amountPaise) / 100} using this link: ${result.shortUrl}\n\n` +
      `This link expires in ${params.expiryMinutes} minutes.\n\n` +
      `- Property Legal Agent`,
    );

    const whatsappLink = `https://wa.me/${params.customerPhone.replace('+', '')}?text=${whatsappMessage}`;

    return {
      ...result,
      whatsappLink,
    };
  }

  /**
   * Checks payment link status for polling.
   * Story 4.2 AC3
   */
  async checkPaymentLinkStatus(paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return null;
    }

    return {
      paymentId: payment.id,
      status: payment.status,
      amountPaise: payment.amountPaise.toString(),
      paidAt: payment.paidAt?.toISOString() ?? null,
    };
  }
}
