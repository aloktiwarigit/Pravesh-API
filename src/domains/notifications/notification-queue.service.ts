/**
 * Story 7-2: Notification Queue Service
 * Queues notification jobs via pg-boss with priority-based processing
 */

import { logger } from '../../shared/utils/logger';

export interface SendNotificationPayload {
  userId: string;
  templateCode: string;
  channel: 'push' | 'whatsapp' | 'sms';
  contextData: Record<string, string>;
  priority: 'high' | 'normal' | 'low';
  serviceInstanceId?: string;
  eventType?: string;
  batchable?: boolean;
}

const PRIORITY_OPTIONS = {
  high: {
    priority: 1,
    retryLimit: 3,
    retryDelay: 10,
    retryBackoff: true,
    expireInSeconds: 300,
  },
  normal: {
    priority: 5,
    retryLimit: 3,
    retryDelay: 30,
    retryBackoff: true,
    expireInSeconds: 600,
  },
  low: {
    priority: 10,
    retryLimit: 3,
    retryDelay: 60,
    retryBackoff: true,
    expireInSeconds: 1800,
  },
};

// Module-level boss reference
let bossInstance: any = null;

export function setBossInstance(boss: any): void {
  bossInstance = boss;
}

export function getBossInstance(): any {
  if (!bossInstance) {
    throw new Error('pg-boss not initialized. Call setBossInstance first.');
  }
  return bossInstance;
}

export class NotificationQueueService {
  async queueNotification(payload: SendNotificationPayload): Promise<string | null> {
    const boss = getBossInstance();
    const options = PRIORITY_OPTIONS[payload.priority];

    const jobId = await boss.send('notification.send', payload, {
      ...options,
      singletonKey: payload.batchable
        ? `batch:${payload.userId}:${payload.templateCode}`
        : undefined,
      singletonSeconds: payload.batchable ? 300 : undefined, // 5-minute batching window
      deadLetter: 'notification.send.dead-letter',
    });

    logger.info({
      jobId,
      userId: payload.userId,
      templateCode: payload.templateCode,
      channel: payload.channel,
      priority: payload.priority,
    }, 'Notification job queued');

    return jobId;
  }

  async queueBulkNotifications(payloads: SendNotificationPayload[]): Promise<void> {
    for (const payload of payloads) {
      await this.queueNotification(payload);
    }
    logger.info({ count: payloads.length }, 'Bulk notifications queued');
  }
}
