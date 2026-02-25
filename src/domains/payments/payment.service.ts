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
   * P0-2: amountPaise is optional — derived from service request when omitted.
   * Story 4.1 AC1
   */
  async createOrder(params: {
    serviceRequestId: string;
    amountPaise?: number;
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

    // P0-2: Derive amountPaise from service request when not provided
    let amountPaise = params.amountPaise;
    if (amountPaise == null) {
      const serviceFeePaise = (serviceInstance as any).serviceFeePaise;
      if (!serviceFeePaise) {
        throw new AppError(
          'AMOUNT_REQUIRED',
          'Could not determine payment amount from service request. Please provide amountPaise.',
          400,
        );
      }
      amountPaise = Number(serviceFeePaise);
    }

    // Create Razorpay order
    const razorpayOrder = await this.razorpay.createOrder({
      amount: paiseToRazorpayAmount(BigInt(amountPaise)),
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
        amountPaise: amountPaise,
        paymentMethodType: 'domestic',
        razorpayOrderId: razorpayOrder.id,
        status: 'pending',
      },
    });

    return {
      orderId: razorpayOrder.id,
      amountPaise: amountPaise.toString(),
      currency: params.currency,
      razorpayKeyId: this.razorpay.publicKeyId,
      paymentId: payment.id,
      serviceRequestId: params.serviceRequestId,
    };
  }

  /**
   * Verifies Razorpay payment signature after Flutter payment completion.
   * P0-3: serviceRequestId and amountPaise are optional — looked up from stored order.
   * Story 4.1 AC2
   */
  async verifyPayment(params: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    serviceRequestId?: string;
    amountPaise?: number;
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

    // P0-3: Derive serviceRequestId and amountPaise from stored order when not provided
    const serviceRequestId = params.serviceRequestId ?? existingPayment?.serviceRequestId;
    const amountPaise = params.amountPaise ?? (existingPayment ? Number(existingPayment.amountPaise) : undefined);

    if (!serviceRequestId) {
      throw new AppError('SERVICE_REQUEST_REQUIRED', 'Could not determine service request for this payment', 400);
    }
    if (amountPaise == null) {
      throw new AppError('AMOUNT_REQUIRED', 'Could not determine amount for this payment', 400);
    }

    // Create or update payment record
    const payment = await this.prisma.payment.upsert({
      where: { id: existingPayment?.id || 'new' },
      update: {
        razorpayPaymentId: params.razorpayPaymentId,
        status: 'paid',
        paidAt: new Date(),
      },
      create: {
        serviceRequestId,
        customerId: params.customerId,
        amountPaise: amountPaise,
        paymentMethodType: params.paymentMethodType || 'domestic',
        razorpayPaymentId: params.razorpayPaymentId,
        razorpayOrderId: params.razorpayOrderId,
        status: 'paid',
        paidAt: new Date(),
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
          newState: 'paid',
        }),
      },
    });

    return {
      paymentId: payment.id,
      status: 'paid',
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

  /**
   * P0-4: Gets paginated payment history for a customer.
   */
  async getPaymentHistory(
    customerId: string,
    filters: { page: number; limit: number; status?: string },
  ) {
    const where: any = { customerId };
    if (filters.status) {
      where.status = filters.status;
    }

    const [payments, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.limit,
        take: filters.limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return {
      payments: payments.map((p) => ({
        id: p.id,
        serviceRequestId: p.serviceRequestId,
        amountPaise: p.amountPaise.toString(),
        status: p.status,
        paymentMethodType: p.paymentMethodType,
        razorpayPaymentId: p.razorpayPaymentId,
        paidAt: p.paidAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      })),
      meta: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit),
      },
    };
  }

  /**
   * P2-1: Records a payment failure for audit trail.
   */
  async recordFailure(params: {
    razorpayOrderId: string;
    reason: string;
    customerId: string;
  }) {
    const existingPayment = await this.prisma.payment.findFirst({
      where: { razorpayOrderId: params.razorpayOrderId },
    });

    if (!existingPayment) {
      throw new AppError('PAYMENT_NOT_FOUND', 'No payment found for this order', 404);
    }

    // Update status to failed
    const payment = await this.prisma.payment.update({
      where: { id: existingPayment.id },
      data: { status: 'failed' },
    });

    // Log the failure
    await this.prisma.paymentAuditLog.create({
      data: {
        paymentId: payment.id,
        action: 'payment_failed',
        performedBy: params.customerId,
        details: JSON.stringify({
          oldState: existingPayment.status,
          newState: 'failed',
          reason: params.reason,
          razorpayOrderId: params.razorpayOrderId,
        }),
      },
    });

    return {
      paymentId: payment.id,
      status: 'failed',
      reason: params.reason,
    };
  }
}
