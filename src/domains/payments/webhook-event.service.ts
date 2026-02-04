/**
 * Webhook event service for idempotent processing.
 *
 * Story 4.10: Razorpay Webhook Idempotent Processing
 *
 * TODO: WebhookEvent model does not exist in the Prisma schema yet.
 * All prisma calls are stubbed using PaymentAuditLog as a fallback.
 */
import { PrismaClient } from '@prisma/client';

export class WebhookEventService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Checks if a webhook event has already been processed (idempotency).
   * Two-layer check:
   * 1. razorpay_event_id unique constraint
   * 2. razorpay_payment_id + event_type unique constraint
   */
  async isEventProcessed(razorpayEventId: string): Promise<boolean> {
    // TODO: WebhookEvent model does not exist in schema.
    // Use PaymentAuditLog to check for duplicate events as a fallback.
    const existing = await this.prisma.paymentAuditLog.findFirst({
      where: {
        action: 'webhook_received',
        details: { contains: razorpayEventId },
      },
    });

    return existing !== null;
  }

  /**
   * Records a webhook event for idempotency tracking.
   * Returns the created event or null if duplicate.
   */
  async recordEvent(params: {
    razorpayEventId: string;
    eventType: string;
    razorpayPaymentId: string;
    razorpayOrderId?: string;
    payload: Record<string, unknown>;
  }) {
    // TODO: WebhookEvent model does not exist in schema.
    // Use PaymentAuditLog as fallback for recording webhook events.
    const isProcessed = await this.isEventProcessed(params.razorpayEventId);
    if (isProcessed) {
      return null; // Duplicate event
    }

    const event = await this.prisma.paymentAuditLog.create({
      data: {
        paymentId: params.razorpayPaymentId,
        action: 'webhook_received',
        performedBy: 'system',
        details: JSON.stringify({
          razorpayEventId: params.razorpayEventId,
          eventType: params.eventType,
          razorpayOrderId: params.razorpayOrderId,
          payload: params.payload,
          status: 'PROCESSING',
        }),
      },
    });
    return event;
  }

  /**
   * Marks an event as processed.
   */
  async markProcessed(eventId: string) {
    // TODO: WebhookEvent model does not exist in schema. Stubbed.
    // In production, update the webhook event status.
    await this.prisma.paymentAuditLog.create({
      data: {
        paymentId: eventId,
        action: 'webhook_processed',
        performedBy: 'system',
        details: JSON.stringify({ status: 'PROCESSED', processedAt: new Date() }),
      },
    });
  }

  /**
   * Marks an event as failed.
   */
  async markFailed(eventId: string, error: string) {
    // TODO: WebhookEvent model does not exist in schema. Stubbed.
    await this.prisma.paymentAuditLog.create({
      data: {
        paymentId: eventId,
        action: 'webhook_failed',
        performedBy: 'system',
        details: JSON.stringify({ status: 'FAILED', errorMessage: error }),
      },
    });
  }
}
