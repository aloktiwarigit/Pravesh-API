/**
 * Story 7-1, 7-3, 7-7, 7-10: Notification Validation Schemas (Zod)
 */

import { z } from 'zod';

// Story 7-1: Template query
export const templateQuerySchema = z.object({
  event_type: z.enum([
    'service_status_change', 'payment_confirmation', 'document_delivered',
    'sla_alert', 'auto_reassurance', 'disruption_broadcast',
    'task_assignment', 'agent_communication', 'campaign_marketing',
    'receipt_delivery', 'otp', 'payment_link',
  ]).optional(),
  channel: z.enum(['push', 'whatsapp', 'sms']).optional(),
  language: z.enum(['hi', 'en']).optional(),
});

export type TemplateQuery = z.infer<typeof templateQuerySchema>;

// Story 7-3: Device token registration
export const registerDeviceTokenSchema = z.object({
  token: z.string().min(1).max(500),
  platform: z.enum(['android', 'ios']),
});

// Story 7-7: Notification preferences
export const updatePreferencesSchema = z.object({
  serviceUpdatesPush: z.boolean().optional(),
  serviceUpdatesWhatsapp: z.boolean().optional(),
  paymentPush: z.boolean().optional(),
  paymentSms: z.boolean().optional(),
  documentPush: z.boolean().optional(),
  documentWhatsapp: z.boolean().optional(),
  marketingWhatsapp: z.boolean().optional(),
  preferredLanguage: z.enum(['hi', 'en']).optional(),
});

// Story 7-10: Communication history query
export const historyQuerySchema = z.object({
  serviceInstanceId: z.string(),
  channel: z.enum(['push', 'whatsapp', 'sms']).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
