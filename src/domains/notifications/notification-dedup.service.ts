/**
 * Story 7-11: Idempotent Notification Handling
 * Prevents duplicate notifications using context data hashing
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'node:crypto';
import { logger } from '../../shared/utils/logger';

// Event types with shorter dedup windows
const CRITICAL_EVENT_TYPES = ['payment_confirmation', 'receipt_delivery', 'otp'];
const DEFAULT_DEDUP_WINDOW_MS = 5 * 60 * 1000;   // 5 minutes
const CRITICAL_DEDUP_WINDOW_MS = 1 * 60 * 1000;   // 1 minute

export class NotificationDedupService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Generate a hash of context data for deduplication.
   * Ensures same data with same keys produces same hash regardless of key order.
   */
  hashContextData(contextData: Record<string, string>): string {
    const sortedKeys = Object.keys(contextData).sort();
    const normalized = sortedKeys.map((k) => `${k}=${contextData[k]}`).join('|');
    return crypto
      .createHash('sha256')
      .update(normalized)
      .digest('hex')
      .substring(0, 16);
  }

  /**
   * Generate a comprehensive dedup hash that includes userId, templateCode,
   * channel, and context data for more accurate deduplication.
   * This prevents false positives where different users or channels
   * share the same context data hash.
   */
  hashNotification(params: {
    userId: string;
    templateCode: string;
    channel: string;
    serviceInstanceId?: string;
    contextData: Record<string, string>;
  }): string {
    const contextSortedKeys = Object.keys(params.contextData).sort();
    const contextNormalized = contextSortedKeys.map((k) => `${k}=${params.contextData[k]}`).join('|');
    const combined = [
      `uid=${params.userId}`,
      `tpl=${params.templateCode}`,
      `ch=${params.channel}`,
      params.serviceInstanceId ? `sid=${params.serviceInstanceId}` : '',
      `ctx=${contextNormalized}`,
    ].filter(Boolean).join('::');

    return crypto
      .createHash('sha256')
      .update(combined)
      .digest('hex')
      .substring(0, 24);
  }

  /**
   * AC1: Check if a notification is a duplicate.
   * Returns true if duplicate found within the dedup window.
   */
  async isDuplicate(params: {
    userId: string;
    templateCode: string;
    serviceInstanceId?: string;
    contextDataHash: string;
    eventType?: string;
  }): Promise<boolean> {
    const isCritical = CRITICAL_EVENT_TYPES.includes(params.eventType ?? '');
    const windowMs = isCritical ? CRITICAL_DEDUP_WINDOW_MS : DEFAULT_DEDUP_WINDOW_MS;
    const since = new Date(Date.now() - windowMs);

    const existing = await this.prisma.notificationLog.findFirst({
      where: {
        userId: params.userId,
        templateCode: params.templateCode,
        contextDataHash: params.contextDataHash,
        ...(params.serviceInstanceId ? { serviceInstanceId: params.serviceInstanceId } : {}),
        status: { in: ['sent', 'delivered', 'read'] },
        createdAt: { gte: since },
      },
    });

    if (existing) {
      logger.info({
        userId: params.userId,
        templateCode: params.templateCode,
        existingId: existing.id,
        windowMs,
      }, 'Duplicate notification detected -- skipping');

      return true;
    }

    return false;
  }

  /**
   * AC6: Check API-level idempotency for webhook-triggered notifications.
   */
  async isWebhookDuplicate(idempotencyKey: string): Promise<boolean> {
    const existing = await this.prisma.notificationLog.findFirst({
      where: {
        externalMessageId: idempotencyKey,
        createdAt: { gte: new Date(Date.now() - DEFAULT_DEDUP_WINDOW_MS) },
      },
    });

    return !!existing;
  }
}
