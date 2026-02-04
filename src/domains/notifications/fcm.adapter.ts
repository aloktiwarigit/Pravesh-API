/**
 * Story 7-3: FCM Push Notification Adapter
 * Implements ChannelHandler for Firebase Cloud Messaging
 */

import { getMessaging } from 'firebase-admin/messaging';
import { PrismaClient } from '@prisma/client';
import { ChannelHandler } from '../../shared/queue/jobs/notification-send.job';
import { logger } from '../../shared/utils/logger';

export class FcmAdapter implements ChannelHandler {
  constructor(private readonly prisma: PrismaClient) {}

  async send(params: {
    userId: string;
    subject: string | null;
    body: string;
    contextData: Record<string, string>;
    whatsappTemplateName?: string | null;
  }): Promise<{ messageId: string; status: string }> {
    // Fetch all device tokens for user (AC4: multi-device)
    const devices = await this.prisma.userDevice.findMany({
      where: { userId: params.userId },
      select: { token: true },
    });

    if (devices.length === 0) {
      logger.warn({ userId: params.userId }, 'No FCM tokens found for user');
      return { messageId: '', status: 'no_tokens' };
    }

    const messaging = getMessaging();
    const tokens = devices.map((d) => d.token);

    // AC2: Rich notification payload
    const notification = {
      title: params.subject ?? '',
      body: params.body,
    };

    const dataPayload: Record<string, string> = {
      ...params.contextData,
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
    };

    // AC4: Send to all devices
    const result = await messaging.sendEachForMulticast({
      tokens,
      notification,
      data: dataPayload,
      android: {
        priority: 'high',
        notification: {
          channelId: 'service_updates',
          priority: 'high',
          sound: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            alert: notification,
            sound: 'default',
            badge: 1,
          },
        },
      },
    });

    // AC5: Clean up invalid tokens
    const invalidTokens: string[] = [];
    result.responses.forEach((resp, idx) => {
      if (
        !resp.success &&
        (resp.error?.code === 'messaging/registration-token-not-registered' ||
         resp.error?.code === 'messaging/invalid-registration-token')
      ) {
        invalidTokens.push(tokens[idx]);
      }
    });

    if (invalidTokens.length > 0) {
      await this.prisma.userDevice.deleteMany({
        where: { token: { in: invalidTokens } },
      });
      logger.info({ count: invalidTokens.length, userId: params.userId }, 'Cleaned up invalid FCM tokens');
    }

    const messageId = result.responses.find((r) => r.success)?.messageId ?? '';

    logger.info({
      userId: params.userId,
      successCount: result.successCount,
      failureCount: result.failureCount,
    }, 'FCM push notification sent');

    if (result.successCount === 0) {
      throw new Error(`FCM delivery failed for all ${tokens.length} devices`);
    }

    return { messageId, status: 'sent' };
  }
}
