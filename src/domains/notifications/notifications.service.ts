/**
 * Story 7-1: Notification Template Service
 * Handles template CRUD and Mustache rendering
 */

import { PrismaClient, NotificationEventType, NotificationChannel, TemplateLanguage } from '@prisma/client';
import Mustache from 'mustache';
import { TemplateQueryParams, RenderedNotification } from './notifications.types';
import { logger } from '../../shared/utils/logger';

export class NotificationTemplateService {
  constructor(private readonly prisma: PrismaClient) {}

  async findTemplates(params: TemplateQueryParams) {
    const where: Record<string, unknown> = { isActive: true };
    if (params.eventType) where.eventType = params.eventType;
    if (params.channel) where.channel = params.channel;
    if (params.language) where.language = params.language;

    return this.prisma.notificationTemplate.findMany({
      where,
      orderBy: [{ eventType: 'asc' }, { version: 'desc' }],
    });
  }

  async renderTemplate(
    templateCode: string,
    contextData: Record<string, string>,
  ): Promise<RenderedNotification> {
    const template = await this.prisma.notificationTemplate.findUnique({
      where: { templateCode },
    });

    if (!template) {
      throw new Error(`Template not found: ${templateCode}`);
    }

    const body = Mustache.render(template.body, contextData);
    const subject = template.subject
      ? Mustache.render(template.subject, contextData)
      : null;

    return {
      subject,
      body,
      channel: template.channel,
      whatsappTemplateName: template.whatsappTemplateName,
    };
  }

  async getTemplateByEvent(
    eventType: NotificationEventType,
    channel: NotificationChannel,
    language: TemplateLanguage,
    version?: number,
  ) {
    return this.prisma.notificationTemplate.findFirst({
      where: {
        eventType,
        channel,
        language,
        isActive: true,
        ...(version ? { version } : {}),
      },
      orderBy: { version: 'desc' },
    });
  }
}
