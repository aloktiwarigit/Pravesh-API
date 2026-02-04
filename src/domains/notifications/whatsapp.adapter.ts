/**
 * Story 7-4: WhatsApp Business API Adapter
 * Implements ChannelHandler for WhatsApp Business API
 */

import { PrismaClient } from '@prisma/client';
import { ChannelHandler } from '../../shared/queue/jobs/notification-send.job';
import { env } from '../../shared/config/env';
import { logger } from '../../shared/utils/logger';

export class WhatsAppAdapter implements ChannelHandler {
  private readonly baseUrl: string;
  private readonly phoneNumberId: string;
  private readonly accessToken: string;

  constructor(private readonly prisma: PrismaClient) {
    this.baseUrl = 'https://graph.facebook.com/v18.0';
    this.phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID;
    this.accessToken = env.WHATSAPP_ACCESS_TOKEN;
  }

  async send(params: {
    userId: string;
    subject: string | null;
    body: string;
    contextData: Record<string, string>;
    whatsappTemplateName?: string | null;
  }): Promise<{ messageId: string; status: string }> {
    // Fetch user's phone number
    const user = await this.prisma.userDevice.findFirst({
      where: { userId: params.userId },
    });

    // Try getting phone from context or fallback
    const phone = params.contextData._phone;
    if (!phone) {
      logger.warn({ userId: params.userId }, 'No phone number for WhatsApp');
      throw new Error('User has no phone number for WhatsApp');
    }

    // Check opt-out status
    const optOut = await this.prisma.notificationOptOut.findFirst({
      where: { userId: params.userId, channel: 'whatsapp' },
    });
    if (optOut) {
      logger.info({ userId: params.userId }, 'User opted out of WhatsApp');
      return { messageId: '', status: 'opted_out' };
    }

    const templateName = params.whatsappTemplateName;
    if (!templateName) {
      return this.sendTextMessage(phone, params.body);
    }

    return this.sendTemplateMessage(
      phone,
      templateName,
      params.contextData._language ?? 'hi',
      params.contextData,
    );
  }

  private async sendTemplateMessage(
    phone: string,
    templateName: string,
    language: string,
    contextData: Record<string, string>,
  ): Promise<{ messageId: string; status: string }> {
    // Filter out internal fields starting with _
    const parameters = Object.entries(contextData)
      .filter(([key]) => !key.startsWith('_'))
      .map(([, value]) => ({
        type: 'text' as const,
        text: value,
      }));

    const payload = {
      messaging_product: 'whatsapp',
      to: phone.replace('+', ''),
      type: 'template',
      template: {
        name: templateName,
        language: { code: language === 'hi' ? 'hi' : 'en' },
        components: [
          {
            type: 'body',
            parameters,
          },
        ],
      },
    };

    const response = await fetch(
      `${this.baseUrl}/${this.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      logger.error({ phone, templateName, error }, 'WhatsApp API error');
      throw new Error(`WhatsApp API error: ${JSON.stringify(error)}`);
    }

    const data: any = await response.json();
    const messageId = data.messages?.[0]?.id ?? '';

    logger.info({ phone, templateName, messageId }, 'WhatsApp template message sent');
    return { messageId, status: 'sent' };
  }

  private async sendTextMessage(
    phone: string,
    body: string,
  ): Promise<{ messageId: string; status: string }> {
    const payload = {
      messaging_product: 'whatsapp',
      to: phone.replace('+', ''),
      type: 'text',
      text: { body },
    };

    const response = await fetch(
      `${this.baseUrl}/${this.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp text API error: ${JSON.stringify(error)}`);
    }

    const data: any = await response.json();
    return { messageId: data.messages?.[0]?.id ?? '', status: 'sent' };
  }

  async sendMediaMessage(params: {
    phone: string;
    mediaUrl: string;
    filename: string;
    caption?: string;
    mediaType: 'document' | 'image';
  }): Promise<{ messageId: string; status: string }> {
    const payload = {
      messaging_product: 'whatsapp',
      to: params.phone.replace('+', ''),
      type: params.mediaType,
      [params.mediaType]: {
        link: params.mediaUrl,
        ...(params.mediaType === 'document' ? { filename: params.filename } : {}),
        ...(params.caption ? { caption: params.caption } : {}),
      },
    };

    const response = await fetch(
      `${this.baseUrl}/${this.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`WhatsApp media API error: ${JSON.stringify(error)}`);
    }

    const data: any = await response.json();
    return { messageId: data.messages?.[0]?.id ?? '', status: 'sent' };
  }
}
