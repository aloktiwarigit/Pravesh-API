/**
 * Core payment service for order creation, verification, and status queries.
 *
 * Story 4.1: Razorpay SDK Integration
 * Story 4.2: WhatsApp Payment Link Fallback
 */
import { PrismaClient } from '@prisma/client';
import { RazorpayClient } from '../../core/integrations/razorpay.client.js';
import { AppError } from '../../core/errors/app-error.js';
import { paiseToRazorpayAmount } from '../../core/utils/bigint-serializer.js';

export class PaymentService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly razorpay: RazorpayClient,
  ) {}

  /**
   * Creates a Razorpay order for a service request payment.
   * Story 4.1 AC1
   */
  async createOrder(params: {
    serviceRequestId: string;
    amountPaise: number;
    currency: string;
    customerId: string;
    cityId: string;
    notes?: Record<string, string>;
  }) {
    // Validate service instance exists and belongs to customer
    const serviceInstance = await this.prisma.serviceInstance.findFirst({
      where: { id: params.serviceRequestId },
    });

    if (!serviceInstance) {
      throw new AppError('SERVICE_REQUEST_NOT_FOUND', 'Service request not found', 404);
    }

    if (serviceInstance.customerId !== params.customerId) {
      throw new AppError('FORBIDDEN', 'Not your service request', 403);
    }

    // Create Razorpay order
    const razorpayOrder = await this.razorpay.createOrder({
      amount: paiseToRazorpayAmount(BigInt(params.amountPaise)),
      currency: params.currency,
      receipt: `sr_${params.serviceRequestId}_${Date.now()}`,
      notes: {
        service_request_id: params.serviceRequestId,
        ...(params.notes || {}),
      },
    });

    // Create payment record in pending status
    const payment = await this.prisma.payment.create({
      data: {
        serviceRequestId: params.serviceRequestId,
        customerId: params.customerId,
        amountPaise: params.amountPaise,
        paymentMethodType: 'domestic',
        razorpayOrderId: razorpayOrder.id,
        status: 'pending',
      },
    });

    return {
      orderId: razorpayOrder.id,
      amountPaise: params.amountPaise.toString(),
      currency: params.currency,
      razorpayKeyId: this.razorpay.publicKeyId,
      paymentId: payment.id,
      serviceRequestId: params.serviceRequestId,
    };
  }

  /**
   * Verifies Razorpay payment signature after Flutter payment completion.
   * Story 4.1 AC2
   */
  async verifyPayment(params: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    serviceRequestId: string;
    amountPaise: number;
    customerId: string;
    cityId: string;
    paymentMethodType?: string;
  }) {
    // Verify signature
    const isValid = this.razorpay.verifyPaymentSignature(
      params.razorpayOrderId,
      params.razorpayPaymentId,
      params.razorpaySignature,
    );

    if (!isValid) {
      throw new AppError('INVALID_SIGNATURE', 'Invalid payment signature', 400);
    }

    // Find the payment record created during order creation
    const existingPayment = await this.prisma.payment.findFirst({
      where: { razorpayOrderId: params.razorpayOrderId },
    });

    if (existingPayment && existingPayment.status === 'paid') {
      // Idempotent — already processed
      return {
        paymentId: existingPayment.id,
        status: 'paid',
        amountPaise: existingPayment.amountPaise.toString(),
        serviceRequestId: existingPayment.serviceRequestId,
      };
    }

    // Create or update payment record
    const payment = await this.prisma.payment.upsert({
      where: { id: existingPayment?.id || 'new' },
      update: {
        razorpayPaymentId: params.razorpayPaymentId,
        status: 'pending',
      },
      create: {
        serviceRequestId: params.serviceRequestId,
        customerId: params.customerId,
        amountPaise: params.amountPaise,
        paymentMethodType: params.paymentMethodType || 'domestic',
        razorpayPaymentId: params.razorpayPaymentId,
        razorpayOrderId: params.razorpayOrderId,
        status: 'pending',
      },
    });

    // Log state change via PaymentAuditLog (paymentStateChange model not in schema)
    await this.prisma.paymentAuditLog.create({
      data: {
        paymentId: payment.id,
        action: 'status_change',
        performedBy: params.customerId,
        details: JSON.stringify({
          oldState: existingPayment?.status || 'pending',
          newState: 'pending',
        }),
      },
    });

    return {
      paymentId: payment.id,
      status: 'pending',
      amountPaise: payment.amountPaise.toString(),
      serviceRequestId: payment.serviceRequestId,
    };
  }

  /**
   * Creates a Razorpay payment link for WhatsApp fallback.
   * Story 4.2 AC1
   */
  async createPaymentLink(params: {
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
    const expireBy = Math.floor(Date.now() / 1000) + params.expiryMinutes * 60;

    const paymentLink = await this.razorpay.createPaymentLink({
      amount: paiseToRazorpayAmount(BigInt(params.amountPaise)),
      currency: 'INR',
      description: params.description,
      customer: {
        name: params.customerName,
        contact: params.customerPhone,
        email: params.customerEmail,
      },
      notify: { sms: false, email: false, whatsapp: false },
      callback_url: `${process.env.API_BASE_URL}/api/v1/payments/callback`,
      callback_method: 'get',
      notes: {
        service_request_id: params.serviceRequestId,
      },
      expire_by: expireBy,
    });

    // Create payment record
    const payment = await this.prisma.payment.create({
      data: {
        serviceRequestId: params.serviceRequestId,
        customerId: params.customerId,
        amountPaise: params.amountPaise,
        paymentMethodType: 'domestic',
        status: 'pending',
      },
    });

    return {
      paymentId: payment.id,
      paymentLinkId: paymentLink.id,
      shortUrl: paymentLink.short_url,
      expiresAt: new Date(expireBy * 1000).toISOString(),
    };
  }

  /**
   * Gets payment status for a service request.
   */
  async getPaymentStatus(serviceRequestId: string, customerId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { serviceRequestId, customerId },
      orderBy: { createdAt: 'desc' },
    });

    return payments.map((p) => ({
      id: p.id,
      amountPaise: p.amountPaise.toString(),
      status: p.status,
      paymentMethodType: p.paymentMethodType,
      razorpayPaymentId: p.razorpayPaymentId,
      paidAt: p.paidAt?.toISOString() ?? null,
      createdAt: p.createdAt.toISOString(),
    }));
  }
}
