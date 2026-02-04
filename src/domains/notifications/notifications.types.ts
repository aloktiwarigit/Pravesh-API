/**
 * Story 7-1: Notification Types & DTOs
 */

import { NotificationEventType, NotificationChannel, TemplateLanguage } from '@prisma/client';

export interface NotificationTemplateDto {
  id: string;
  templateCode: string;
  eventType: NotificationEventType;
  channel: NotificationChannel;
  language: TemplateLanguage;
  subject: string | null;
  body: string;
  version: number;
  isActive: boolean;
  whatsappTemplateName: string | null;
}

export interface TemplateQueryParams {
  eventType?: NotificationEventType;
  channel?: NotificationChannel;
  language?: TemplateLanguage;
  isActive?: boolean;
}

export interface RenderedNotification {
  subject: string | null;
  body: string;
  channel: NotificationChannel;
  whatsappTemplateName: string | null;
}
