/**
 * Story 7-5: SMS Gateway Adapter
 * Implements ChannelHandler for MSG91 SMS delivery
 */

import { PrismaClient } from '@prisma/client';
import { ChannelHandler } from '../../shared/queue/jobs/notification-send.job';
import { env } from '../../shared/config/env';
import { logger } from '../../shared/utils/logger';

interface SmsDeliveryResult {
  messageId: string;
  status: string;
  costInPaise?: number;
}

export class SmsAdapter implements ChannelHandler {
  private readonly apiKey: string;
  private readonly senderId: string;
  private readonly baseUrl: string;

  constructor(private readonly prisma: PrismaClient) {
    this.apiKey = env.SMS_API_KEY;
    this.senderId = env.SMS_SENDER_ID ?? 'PROPLA';
    this.baseUrl = env.SMS_BASE_URL ?? 'https://api.msg91.com/api/v5';
  }

  async send(params: {
    userId: string;
    subject: string | null;
    body: string;
    contextData: Record<string, string>;
    whatsappTemplateName?: string | null;
  }): Promise<{ messageId: string; status: string }> {
    const phone = params.contextData._phone;
    if (!phone) {
      logger.warn({ userId: params.userId }, 'No phone number for SMS');
      throw new Error('User has no phone number');
    }

    // Truncate to 160 chars for single SMS segment
    const message = params.body.length > 160
      ? params.body.substring(0, 157) + '...'
      : params.body;

    const result = await this.sendSms(phone, message);

    // AC5: Log SMS cost
    await this.prisma.smsCostLog.create({
      data: {
        notificationMessageId: result.messageId,
        userId: params.userId,
        phone,
        costInPaise: result.costInPaise ?? 25, // Default ~0.25 INR per SMS
        provider: 'msg91',
        sentAt: new Date(),
      },
    });

    return { messageId: result.messageId, status: result.status };
  }

  private async sendSms(phone: string, message: string): Promise<SmsDeliveryResult> {
    const payload = {
      sender: this.senderId,
      route: '4', // Transactional route
      country: '91',
      sms: [
        {
          message,
          to: [phone.replace('+91', '').replace('+', '')],
        },
      ],
    };

    const response = await fetch(`${this.baseUrl}/flow/`, {
      method: 'POST',
      headers: {
        authkey: this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ phone, error }, 'SMS API error');
      throw new Error(`SMS API error: ${error}`);
    }

    const data: any = await response.json();
    const messageId = data.request_id ?? data.message_id ?? '';

    logger.info({ phone, messageId }, 'SMS sent successfully');
    return { messageId, status: 'sent', costInPaise: 25 };
  }
}
