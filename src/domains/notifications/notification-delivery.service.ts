/**
 * Notification Delivery Service — FR109
 * Orchestrates the delivery chain: FCM push → WhatsApp → SMS fallback.
 *
 * This service is the single entry point for triggering a notification to a
 * user from any context (HTTP handler, pg-boss job, internal service). It:
 *   1. Checks the user's opt-out state (NotificationOptOut model).
 *   2. Attempts FCM push first (unless the caller requests a specific channel).
 *   3. Falls back to WhatsApp if push fails or the user prefers WhatsApp.
 *   4. Falls back to SMS after 2 failed WhatsApp attempts.
 *   5. Logs every attempt to NotificationLog and persists failures to
 *      FailedNotification for later inspection / manual retry.
 */

import { PrismaClient } from '@prisma/client';
import { getMessaging } from 'firebase-admin/messaging';
import { WhatsAppClient } from '../../core/integrations/whatsapp.client.js';
import { logger } from '../../shared/utils/logger.js';
import { BusinessError } from '../../shared/errors/business-error.js';
import { env } from '../../shared/config/env.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type DeliveryChannel = 'push' | 'whatsapp' | 'sms';

export interface DeliverNotificationParams {
  /** Target user's internal ID. */
  userId: string;
  /** Notification template code (also stored as-is in the log). */
  templateName: string;
  /**
   * Preferred channel. When omitted the service starts with 'push' and falls
   * through the chain automatically (push → whatsapp → sms).
   */
  channel?: DeliveryChannel;
  /**
   * Free-form key/value context data used to render the message body and
   * passed through to adapters. Use the `_phone` key to supply the recipient
   * phone number for WhatsApp/SMS delivery.
   */
  data: Record<string, string>;
}

export interface DeliveryAttempt {
  channel: DeliveryChannel;
  messageId: string;
  status: string;
  error?: string;
}

export interface DeliveryResult {
  userId: string;
  templateName: string;
  attempts: DeliveryAttempt[];
  finalStatus: 'delivered' | 'failed';
  notificationLogId: string | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const WHATSAPP_MAX_ATTEMPTS = 2;

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class NotificationDeliveryService {
  private readonly whatsapp: WhatsAppClient;

  constructor(
    private readonly prisma: PrismaClient,
    whatsappClient?: WhatsAppClient,
  ) {
    // Allow injection for testing; build from env vars at runtime.
    this.whatsapp =
      whatsappClient ??
      new WhatsAppClient({
        apiKey: env.WHATSAPP_API_KEY ?? '',
        senderId: env.WHATSAPP_SENDER_ID ?? '',
        provider: (env.WHATSAPP_PROVIDER as 'msg91' | 'meta' | undefined) ?? 'msg91',
      });
  }

  // -------------------------------------------------------------------------
  // Main entry point
  // -------------------------------------------------------------------------

  /**
   * Deliver a notification to a user through the configured channel chain.
   * Safe to call from pg-boss jobs — does not throw; failures are logged.
   */
  async deliverNotification(params: DeliverNotificationParams): Promise<DeliveryResult> {
    const { userId, templateName, data } = params;
    const preferredChannel = params.channel ?? 'push';

    logger.info(
      { userId, templateName, preferredChannel },
      'NotificationDelivery: starting delivery',
    );

    const attempts: DeliveryAttempt[] = [];
    let notificationLogId: string | null = null;

    // ------------------------------------------------------------------
    // 1. Check global opt-out for ALL channels
    // ------------------------------------------------------------------
    const optOuts = await this.prisma.notificationOptOut.findMany({
      where: { userId },
      select: { channel: true },
    });
    const optedOutChannels = new Set(optOuts.map((o) => o.channel));

    // ------------------------------------------------------------------
    // 2. Build the ordered channel chain
    // ------------------------------------------------------------------
    const chain = this.buildChain(preferredChannel, optedOutChannels);

    if (chain.length === 0) {
      logger.warn({ userId, templateName }, 'NotificationDelivery: user opted out of all channels');
      notificationLogId = await this.logSkipped(userId, templateName, 'User opted out of all channels');
      return { userId, templateName, attempts, finalStatus: 'failed', notificationLogId };
    }

    // ------------------------------------------------------------------
    // 3. Walk the chain until one succeeds
    // ------------------------------------------------------------------
    let delivered = false;

    for (const channel of chain) {
      if (channel === 'push') {
        const attempt = await this.attemptPush(userId, templateName, data);
        attempts.push(attempt);
        if (attempt.status === 'sent') {
          delivered = true;
          break;
        }
        // Push failed — continue to next channel in chain
      } else if (channel === 'whatsapp') {
        const attempt = await this.attemptWhatsAppWithRetry(userId, templateName, data);
        attempts.push(...attempt);
        if (attempt.some((a) => a.status === 'sent')) {
          delivered = true;
          break;
        }
      } else if (channel === 'sms') {
        const attempt = await this.attemptSms(userId, templateName, data);
        attempts.push(attempt);
        if (attempt.status === 'sent') {
          delivered = true;
          break;
        }
      }
    }

    // ------------------------------------------------------------------
    // 4. Persist log entry
    // ------------------------------------------------------------------
    notificationLogId = await this.persistLog(userId, templateName, attempts, delivered);

    // ------------------------------------------------------------------
    // 5. If entirely failed, write to FailedNotification
    // ------------------------------------------------------------------
    if (!delivered && notificationLogId) {
      await this.persistFailure(userId, templateName, preferredChannel, data, attempts, notificationLogId);
    }

    const finalStatus = delivered ? 'delivered' : 'failed';

    logger.info(
      { userId, templateName, finalStatus, attemptCount: attempts.length },
      'NotificationDelivery: finished',
    );

    return { userId, templateName, attempts, finalStatus, notificationLogId };
  }

  // -------------------------------------------------------------------------
  // Channel chain builder
  // -------------------------------------------------------------------------

  /**
   * Builds an ordered list of channels to try, starting at the preferred
   * channel and falling through the standard chain.  Channels the user has
   * opted out of are skipped.
   */
  private buildChain(
    preferred: DeliveryChannel,
    optedOut: Set<string>,
  ): DeliveryChannel[] {
    const fullChain: DeliveryChannel[] = ['push', 'whatsapp', 'sms'];

    // Rotate so that the preferred channel is first
    const startIdx = fullChain.indexOf(preferred);
    const rotated: DeliveryChannel[] =
      startIdx === -1
        ? fullChain
        : [...fullChain.slice(startIdx), ...fullChain.slice(0, startIdx)];

    return rotated.filter((ch) => !optedOut.has(ch));
  }

  // -------------------------------------------------------------------------
  // Push attempt
  // -------------------------------------------------------------------------

  private async attemptPush(
    userId: string,
    templateName: string,
    data: Record<string, string>,
  ): Promise<DeliveryAttempt> {
    logger.info({ userId, templateName }, 'NotificationDelivery: attempting push');

    try {
      const devices = await this.prisma.userDevice.findMany({
        where: { userId },
        select: { token: true },
      });

      if (devices.length === 0) {
        logger.warn({ userId }, 'NotificationDelivery: no FCM tokens');
        return { channel: 'push', messageId: '', status: 'no_tokens' };
      }

      const messaging = getMessaging();
      const tokens = devices.map((d) => d.token);

      const result = await messaging.sendEachForMulticast({
        tokens,
        notification: {
          title: data._title ?? templateName,
          body: data._body ?? '',
        },
        data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
        android: {
          priority: 'high',
          notification: { channelId: 'service_updates', priority: 'high', sound: 'default' },
        },
        apns: {
          payload: { aps: { alert: { title: data._title ?? templateName, body: data._body ?? '' }, sound: 'default', badge: 1 } },
        },
      });

      // Clean up stale tokens
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
        await this.prisma.userDevice.deleteMany({ where: { token: { in: invalidTokens } } });
        logger.info({ count: invalidTokens.length, userId }, 'NotificationDelivery: cleaned up invalid tokens');
      }

      if (result.successCount === 0) {
        const errMsg = `FCM: all ${tokens.length} device(s) failed`;
        logger.warn({ userId, templateName }, errMsg);
        return { channel: 'push', messageId: '', status: 'failed', error: errMsg };
      }

      const messageId = result.responses.find((r) => r.success)?.messageId ?? '';
      logger.info({ userId, messageId, successCount: result.successCount }, 'NotificationDelivery: push sent');
      return { channel: 'push', messageId, status: 'sent' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ userId, templateName, err: message }, 'NotificationDelivery: push error');
      return { channel: 'push', messageId: '', status: 'failed', error: message };
    }
  }

  // -------------------------------------------------------------------------
  // WhatsApp attempt (with 2-try retry)
  // -------------------------------------------------------------------------

  private async attemptWhatsAppWithRetry(
    userId: string,
    templateName: string,
    data: Record<string, string>,
  ): Promise<DeliveryAttempt[]> {
    const phone = data._phone;
    if (!phone) {
      logger.warn({ userId, templateName }, 'NotificationDelivery: no _phone key for WhatsApp');
      return [{ channel: 'whatsapp', messageId: '', status: 'no_phone' }];
    }

    const attempts: DeliveryAttempt[] = [];

    for (let attempt = 1; attempt <= WHATSAPP_MAX_ATTEMPTS; attempt++) {
      logger.info({ userId, templateName, attempt }, 'NotificationDelivery: attempting WhatsApp');

      try {
        // Filter internal _-prefixed keys when building template params
        const templateParams: Record<string, string> = {};
        for (const [key, value] of Object.entries(data)) {
          if (!key.startsWith('_')) {
            templateParams[key] = value;
          }
        }

        const result = await this.whatsapp.sendTemplate(phone, templateName, templateParams);

        if (result.status === 'sent') {
          logger.info({ userId, templateName, attempt, messageId: result.messageId }, 'NotificationDelivery: WhatsApp sent');
          attempts.push({ channel: 'whatsapp', messageId: result.messageId, status: 'sent' });
          return attempts;
        }

        attempts.push({
          channel: 'whatsapp',
          messageId: result.messageId,
          status: result.status,
          error: `Attempt ${attempt}: unexpected status '${result.status}'`,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ userId, templateName, attempt, err: message }, 'NotificationDelivery: WhatsApp error');
        attempts.push({ channel: 'whatsapp', messageId: '', status: 'failed', error: message });
      }

      if (attempt < WHATSAPP_MAX_ATTEMPTS) {
        // Brief pause before retry (non-blocking on the event loop)
        await new Promise<void>((resolve) => setTimeout(resolve, 500));
      }
    }

    return attempts;
  }

  // -------------------------------------------------------------------------
  // SMS attempt
  // -------------------------------------------------------------------------

  private async attemptSms(
    userId: string,
    templateName: string,
    data: Record<string, string>,
  ): Promise<DeliveryAttempt> {
    const phone = data._phone;
    if (!phone) {
      logger.warn({ userId, templateName }, 'NotificationDelivery: no _phone key for SMS');
      return { channel: 'sms', messageId: '', status: 'no_phone' };
    }

    logger.info({ userId, templateName }, 'NotificationDelivery: attempting SMS');

    try {
      const body =
        data._body ??
        `Notification: ${templateName}. Please check the Pravesh app for details.`;

      const message = body.length > 160 ? `${body.substring(0, 157)}...` : body;

      const smsApiKey = env.SMS_API_KEY;
      const smsSenderId = env.SMS_SENDER_ID ?? 'PROPLA';
      const smsBaseUrl = env.SMS_BASE_URL ?? 'https://api.msg91.com/api/v5';

      const payload = {
        sender: smsSenderId,
        route: '4',
        country: '91',
        sms: [{ message, to: [phone.replace('+91', '').replace('+', '')] }],
      };

      const response = await fetch(`${smsBaseUrl}/flow/`, {
        method: 'POST',
        headers: { authkey: smsApiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(`SMS API error ${response.status}: ${responseText}`);
      }

      let smsData: Record<string, unknown>;
      try {
        smsData = JSON.parse(responseText) as Record<string, unknown>;
      } catch {
        smsData = {};
      }

      const messageId =
        (smsData.request_id as string | undefined) ??
        (smsData.message_id as string | undefined) ??
        '';

      // Log cost — best effort, do not fail delivery if this errors
      try {
        await this.prisma.smsCostLog.create({
          data: {
            notificationMessageId: messageId,
            userId,
            phone,
            costInPaise: 25,
            provider: 'msg91',
            sentAt: new Date(),
          },
        });
      } catch (costErr) {
        logger.warn({ userId, err: String(costErr) }, 'NotificationDelivery: failed to log SMS cost');
      }

      logger.info({ userId, templateName, messageId }, 'NotificationDelivery: SMS sent');
      return { channel: 'sms', messageId, status: 'sent' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ userId, templateName, err: message }, 'NotificationDelivery: SMS error');
      return { channel: 'sms', messageId: '', status: 'failed', error: message };
    }
  }

  // -------------------------------------------------------------------------
  // Persistence helpers
  // -------------------------------------------------------------------------

  private async logSkipped(
    userId: string,
    templateName: string,
    reason: string,
  ): Promise<string | null> {
    try {
      const log = await this.prisma.notificationLog.create({
        data: {
          userId,
          templateCode: templateName,
          channel: 'push',
          language: 'en',
          subject: null,
          body: '',
          status: 'skipped',
          failureReason: reason,
        },
        select: { id: true },
      });
      return log.id;
    } catch (err) {
      logger.warn({ userId, err: String(err) }, 'NotificationDelivery: failed to log skipped notification');
      return null;
    }
  }

  private async persistLog(
    userId: string,
    templateName: string,
    attempts: DeliveryAttempt[],
    delivered: boolean,
  ): Promise<string | null> {
    try {
      const successfulAttempt = attempts.find((a) => a.status === 'sent');
      const lastAttempt = attempts[attempts.length - 1];

      const channel = (successfulAttempt?.channel ?? lastAttempt?.channel ?? 'push') as
        | 'push'
        | 'whatsapp'
        | 'sms';

      const log = await this.prisma.notificationLog.create({
        data: {
          userId,
          templateCode: templateName,
          channel,
          language: 'en',
          subject: null,
          body: '',
          status: delivered ? 'sent' : 'failed',
          externalMessageId: successfulAttempt?.messageId ?? lastAttempt?.messageId ?? null,
          sentAt: delivered ? new Date() : null,
          failedAt: delivered ? null : new Date(),
          failureReason: delivered
            ? null
            : attempts.map((a) => `${a.channel}: ${a.error ?? a.status}`).join(' | '),
          retryCount: attempts.filter((a) => a.status === 'failed').length,
        },
        select: { id: true },
      });

      return log.id;
    } catch (err) {
      logger.warn(
        { userId, templateName, err: String(err) },
        'NotificationDelivery: failed to write NotificationLog',
      );
      return null;
    }
  }

  private async persistFailure(
    userId: string,
    templateName: string,
    channel: DeliveryChannel,
    data: Record<string, string>,
    attempts: DeliveryAttempt[],
    notificationLogId: string,
  ): Promise<void> {
    try {
      const reason = attempts
        .map((a) => `${a.channel}: ${a.error ?? a.status}`)
        .join(' | ');

      await this.prisma.failedNotification.create({
        data: {
          notificationLogId,
          userId,
          templateCode: templateName,
          channel,
          contextData: data as Record<string, string>,
          failureReason: reason,
          retryCount: attempts.filter((a) => a.status === 'failed').length,
        },
      });

      logger.info({ userId, templateName, notificationLogId }, 'NotificationDelivery: failure record created');
    } catch (err) {
      logger.warn(
        { userId, templateName, err: String(err) },
        'NotificationDelivery: failed to write FailedNotification',
      );
    }
  }

  // -------------------------------------------------------------------------
  // Validation helper (used by controller)
  // -------------------------------------------------------------------------

  /**
   * Validates that the required fields are present and throws a BusinessError
   * for use in HTTP contexts.
   */
  validateParams(params: DeliverNotificationParams): void {
    if (!params.userId) {
      throw new BusinessError('MISSING_FIELD', 'userId is required', 400);
    }
    if (!params.templateName) {
      throw new BusinessError('MISSING_FIELD', 'templateName is required', 400);
    }
    if (
      params.channel !== undefined &&
      !['push', 'whatsapp', 'sms'].includes(params.channel)
    ) {
      throw new BusinessError(
        'INVALID_CHANNEL',
        `channel must be one of: push, whatsapp, sms`,
        400,
      );
    }
  }
}
