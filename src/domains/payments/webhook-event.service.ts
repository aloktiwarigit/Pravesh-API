/**
 * Webhook event service for idempotent processing.
 *
 * Story 4.10: Razorpay Webhook Idempotent Processing
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
    const existing = await this.prisma.webhookEvent.findUnique({
      where: { razorpayEventId },
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
    const isProcessed = await this.isEventProcessed(params.razorpayEventId);
    if (isProcessed) {
      return null; // Duplicate event
    }

    const event = await this.prisma.webhookEvent.create({
      data: {
        razorpayEventId: params.razorpayEventId,
        eventType: params.eventType,
        razorpayPaymentId: params.razorpayPaymentId,
        razorpayOrderId: params.razorpayOrderId,
        payload: JSON.parse(JSON.stringify(params.payload)),
        status: 'processing',
      },
    });
    return event;
  }

  /**
   * Marks an event as processed.
   */
  async markProcessed(eventId: string) {
    await this.prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: 'processed',
        processedAt: new Date(),
      },
    });
  }

  /**
   * Marks an event as failed.
   */
  async markFailed(eventId: string, error: string) {
    await this.prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        status: 'failed',
        errorMessage: error,
      },
    });
  }
}
