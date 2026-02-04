/**
 * Razorpay webhook event handler.
 * Processes payment.captured, payment.failed, payment.authorized, order.paid events.
 *
 * Story 4.10: Razorpay Webhook Idempotent Processing
 * Story 4.11: Referral credit trigger
 */
import { PrismaClient } from '@prisma/client';
import { WebhookEventService } from './webhook-event.service.js';
import { PaymentStateChangeService } from './payment-state-change.service.js';

export interface RazorpayWebhookPayload {
  entity: string;
  account_id: string;
  event: string;
  contains: string[];
  payload: {
    payment?: {
      entity: {
        id: string;
        amount: number;
        currency: string;
        status: string;
        order_id: string;
        method: string;
        captured: boolean;
        notes: Record<string, string>;
        error_code: string | null;
        error_description: string | null;
      };
    };
    order?: {
      entity: {
        id: string;
        amount: number;
        amount_paid: number;
        status: string;
        receipt: string;
        notes: Record<string, string>;
      };
    };
  };
  created_at: number;
}

export class RazorpayWebhookHandler {
  private readonly webhookEventService: WebhookEventService;
  private readonly stateChangeService: PaymentStateChangeService;

  constructor(private readonly prisma: PrismaClient) {
    this.webhookEventService = new WebhookEventService(prisma);
    this.stateChangeService = new PaymentStateChangeService(prisma);
  }

  /**
   * Main handler for Razorpay webhook events.
   * Implements two-layer idempotency.
   */
  async handleWebhook(
    razorpayEventId: string,
    payload: RazorpayWebhookPayload,
  ): Promise<{ processed: boolean; message: string }> {
    // Layer 1: Check if event already processed
    const isDuplicate = await this.webhookEventService.isEventProcessed(razorpayEventId);
    if (isDuplicate) {
      return { processed: false, message: 'Duplicate event, already processed' };
    }

    const eventType = payload.event;
    const paymentEntity = payload.payload.payment?.entity;

    if (!paymentEntity) {
      return { processed: false, message: 'No payment entity in payload' };
    }

    // Record event for idempotency tracking
    const event = await this.webhookEventService.recordEvent({
      razorpayEventId,
      eventType,
      razorpayPaymentId: paymentEntity.id,
      razorpayOrderId: paymentEntity.order_id,
      payload: payload as unknown as Record<string, unknown>,
    });

    if (!event) {
      return { processed: false, message: 'Duplicate event (concurrent)' };
    }

    try {
      switch (eventType) {
        case 'payment.captured':
          await this.handlePaymentCaptured(paymentEntity);
          break;
        case 'payment.failed':
          await this.handlePaymentFailed(paymentEntity);
          break;
        case 'payment.authorized':
          await this.handlePaymentAuthorized(paymentEntity);
          break;
        case 'order.paid':
          await this.handleOrderPaid(payload.payload.order!.entity);
          break;
        default:
          // Unknown event type — log but don't fail
          break;
      }

      await this.webhookEventService.markProcessed(event.id);
      return { processed: true, message: `Event ${eventType} processed` };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.webhookEventService.markFailed(event.id, errorMessage);
      throw error;
    }
  }

  private async handlePaymentCaptured(
    paymentEntity: NonNullable<RazorpayWebhookPayload['payload']['payment']>['entity'],
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: { razorpayPaymentId: paymentEntity.id },
    });

    if (!payment) {
      // Try finding by order ID
      const paymentByOrder = await this.prisma.payment.findFirst({
        where: { razorpayOrderId: paymentEntity.order_id },
      });

      if (!paymentByOrder) {
        throw new Error(`Payment not found for Razorpay payment ${paymentEntity.id}`);
      }

      // Update with payment ID and mark as success
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: paymentByOrder.id },
          data: {
            razorpayPaymentId: paymentEntity.id,
            status: 'SUCCESS',
            paidAt: new Date(),
          },
        });

        await this.stateChangeService.logStateChange({
          paymentId: paymentByOrder.id,
          oldState: paymentByOrder.status,
          newState: 'SUCCESS',
          changedBy: 'razorpay_webhook',
          metadata: { razorpayPaymentId: paymentEntity.id },
        });
      });

      return;
    }

    if (payment.status === 'SUCCESS') {
      return; // Already captured, idempotent
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'SUCCESS', paidAt: new Date() },
      });

      await this.stateChangeService.logStateChange({
        paymentId: payment.id,
        oldState: payment.status,
        newState: 'SUCCESS',
        changedBy: 'razorpay_webhook',
        metadata: { razorpayPaymentId: paymentEntity.id },
      });
    });
  }

  private async handlePaymentFailed(
    paymentEntity: NonNullable<RazorpayWebhookPayload['payload']['payment']>['entity'],
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          { razorpayPaymentId: paymentEntity.id },
          { razorpayOrderId: paymentEntity.order_id },
        ],
      },
    });

    if (!payment || payment.status === 'FAILED') {
      return; // Already handled or not found
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      });

      await this.stateChangeService.logStateChange({
        paymentId: payment.id,
        oldState: payment.status,
        newState: 'FAILED',
        changedBy: 'razorpay_webhook',
        metadata: {
          razorpayPaymentId: paymentEntity.id,
          errorCode: paymentEntity.error_code,
          errorDescription: paymentEntity.error_description,
        },
      });
    });
  }

  private async handlePaymentAuthorized(
    paymentEntity: NonNullable<RazorpayWebhookPayload['payload']['payment']>['entity'],
  ) {
    // Payment authorized but not yet captured
    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          { razorpayPaymentId: paymentEntity.id },
          { razorpayOrderId: paymentEntity.order_id },
        ],
      },
    });

    if (!payment) return;

    await this.stateChangeService.logStateChange({
      paymentId: payment.id,
      oldState: payment.status,
      newState: 'AUTHORIZED',
      changedBy: 'razorpay_webhook',
      metadata: { razorpayPaymentId: paymentEntity.id },
    });
  }

  private async handleOrderPaid(
    orderEntity: NonNullable<RazorpayWebhookPayload['payload']['order']>['entity'],
  ) {
    // Order is fully paid
    const payment = await this.prisma.payment.findFirst({
      where: { razorpayOrderId: orderEntity.id },
    });

    if (!payment) return;

    if (payment.status !== 'SUCCESS') {
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: 'SUCCESS', paidAt: new Date() },
        });

        await this.stateChangeService.logStateChange({
          paymentId: payment.id,
          oldState: payment.status,
          newState: 'SUCCESS',
          changedBy: 'razorpay_webhook',
          metadata: { event: 'order.paid', orderId: orderEntity.id },
        });
      });
    }
  }
}
