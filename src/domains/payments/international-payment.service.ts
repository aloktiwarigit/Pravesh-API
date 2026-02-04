// Story 13-1: International Payment Method Support - UPI
import { PrismaClient } from '@prisma/client';
import Razorpay from 'razorpay';
import crypto from 'crypto';

export class InternationalPaymentService {
  private razorpay: Razorpay;

  constructor(
    private prisma: PrismaClient,
    razorpay?: Razorpay,
  ) {
    this.razorpay = razorpay ?? new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID!,
      key_secret: process.env.RAZORPAY_KEY_SECRET!,
    });
  }

  async createInternationalUpiOrder(params: {
    serviceRequestId: string;
    amountPaise: number;
    customerId: string;
    customerCurrency?: string;
  }) {
    // Create Razorpay order with INR currency for international UPI
    const order = await this.razorpay.orders.create({
      amount: params.amountPaise,
      currency: 'INR',
      receipt: `nri_upi_${params.serviceRequestId}`,
      notes: {
        serviceRequestId: params.serviceRequestId,
        customerId: params.customerId,
        paymentType: 'international_upi',
      },
    });

    // Store pending payment record with NRI flag
    const payment = await this.prisma.payment.create({
      data: {
        id: crypto.randomUUID(),
        serviceRequestId: params.serviceRequestId,
        customerId: params.customerId,
        amountPaise: params.amountPaise,
        status: 'pending',
        razorpayOrderId: order.id,
        paymentMethodType: 'international_upi',
        isNriPayment: true,
        foreignCurrencyCode: params.customerCurrency || null,
      },
    });

    return {
      orderId: order.id,
      paymentId: payment.id,
      amountPaise: params.amountPaise,
      currency: 'INR',
      key: process.env.RAZORPAY_KEY_ID,
    };
  }

  async confirmInternationalPayment(params: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    foreignCurrencyAmount?: number;
    exchangeRate?: number;
  }) {
    // Verify Razorpay signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
      .digest('hex');

    if (expectedSignature !== params.razorpaySignature) {
      throw new Error('Invalid payment signature');
    }

    // Update payment record with foreign currency details
    // razorpayOrderId is not a unique field in schema, so we use findFirst + update by id
    const existingPayment = await this.prisma.payment.findFirst({
      where: { razorpayOrderId: params.razorpayOrderId },
    });
    if (!existingPayment) {
      throw new Error(`Payment not found for order ${params.razorpayOrderId}`);
    }
    const payment = await this.prisma.payment.update({
      where: { id: existingPayment.id },
      data: {
        status: 'paid',
        razorpayPaymentId: params.razorpayPaymentId,
        foreignCurrencyAmount: params.foreignCurrencyAmount || null,
        exchangeRate: params.exchangeRate || null,
        paidAt: new Date(),
      },
    });

    return payment;
  }

  async getNriPaymentDetails(paymentId: string) {
    return this.prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
    });
  }
}
