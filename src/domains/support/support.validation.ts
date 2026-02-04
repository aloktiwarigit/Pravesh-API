import { z } from 'zod';

// Story 10.1: Customer Search
export const customerSearchSchema = z.object({
  query: z.string().min(2).max(100),
  searchType: z.enum(['phone', 'customer_id', 'service_id', 'name']).optional(),
  page: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export const serviceFilterSchema = z.object({
  customerId: z.string(),
  status: z.enum(['active', 'completed', 'halted']).optional(),
  serviceType: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.string().optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
});

// Story 10.2: Internal Messaging
export const sendMessageSchema = z.object({
  recipientId: z.string(),
  serviceId: z.string(),
  messageText: z.string().min(1).max(2000),
  attachmentUrl: z.string().url().optional(),
  attachmentType: z.enum(['photo', 'document']).optional(),
});

export const markResolvedSchema = z.object({
  serviceId: z.string(),
});

// Story 10.3: Communication Templates
export const createTemplateSchema = z.object({
  category: z.enum(['DOCUMENT_REQUESTS', 'TIMELINE_UPDATES', 'ISSUE_RESOLUTION', 'GENERAL_INQUIRY']),
  templateTextEn: z.string().min(10).max(2000),
  templateTextHi: z.string().min(10).max(2000),
  placeholders: z.array(z.string()).default([]),
});

export const updateTemplateSchema = z.object({
  category: z.enum(['DOCUMENT_REQUESTS', 'TIMELINE_UPDATES', 'ISSUE_RESOLUTION', 'GENERAL_INQUIRY']).optional(),
  templateTextEn: z.string().min(10).max(2000).optional(),
  templateTextHi: z.string().min(10).max(2000).optional(),
  placeholders: z.array(z.string()).optional(),
});

export const logTemplateUsageSchema = z.object({
  templateId: z.string(),
  serviceId: z.string().optional(),
});

// Story 10.4: Follow-Up Reminders
export const createReminderSchema = z.object({
  serviceId: z.string(),
  reminderDatetime: z.string().datetime(),
  reminderType: z.enum(['FOLLOW_UP_CUSTOMER', 'CHECK_WITH_AGENT', 'ESCALATE_TO_OPS']),
  notes: z.string().max(500).optional(),
});

export const updateReminderSchema = z.object({
  status: z.enum(['COMPLETED', 'SNOOZED']),
  snoozedUntil: z.string().datetime().optional(),
});

export const reminderFilterSchema = z.object({
  status: z.enum(['PENDING', 'COMPLETED', 'SNOOZED']).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
});

// Story 10.5: Case Pattern Logging
export const logPatternSchema = z.object({
  patterns: z.array(z.object({
    patternCategory: z.enum([
      'DOCUMENT_CONFUSION', 'PAYMENT_ISSUES', 'AGENT_COMMUNICATION_GAP',
      'GOVERNMENT_OFFICE_DELAYS', 'SLA_MISALIGNMENT', 'OTHER',
    ]),
    notes: z.string().max(1000).optional(),
  })).min(1).max(6),
});

// Story 10.6: Agent Performance Notes
export const addPerformanceNoteSchema = z.object({
  agentId: z.string(),
  serviceId: z.string(),
  noteType: z.enum(['POSITIVE_FEEDBACK', 'CONCERN', 'NEUTRAL_OBSERVATION']),
  notes: z.string().min(5).max(2000),
});

// Story 10.7: Escalation SLA Tracking
export const createEscalationSchema = z.object({
  serviceId: z.string(),
  customerId: z.string(),
  escalationType: z.enum(['CUSTOMER_COMPLAINT', 'SLA_BREACH', 'AGENT_ISSUE', 'AUTO_GENERATED']),
  escalationReason: z.string().min(5).max(1000),
  severity: z.enum(['STANDARD', 'COMPLEX']).default('STANDARD'),
});

export const resolveEscalationSchema = z.object({
  resolutionNotes: z.string().min(5).max(2000).optional(),
});

// Story 10.10: Customer Communication
export const sendCustomerMessageSchema = z.object({
  serviceId: z.string(),
  recipientId: z.string(),
  subject: z.string().max(200).optional(),
  messageText: z.string().min(1).max(5000),
  attachmentUrl: z.string().url().optional(),
  deliveryChannel: z.enum(['PUSH_ONLY', 'PUSH_AND_WHATSAPP']).default('PUSH_ONLY'),
});

// Story 10.12: Performance Metrics
export const performanceFilterSchema = z.object({
  cityId: z.string().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  tier: z.enum(['top', 'middle', 'bottom']).optional(),
  format: z.enum(['json', 'csv']).default('json'),
});

// Type exports
export type CustomerSearchInput = z.infer<typeof customerSearchSchema>;
export type ServiceFilterInput = z.infer<typeof serviceFilterSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type CreateReminderInput = z.infer<typeof createReminderSchema>;
export type UpdateReminderInput = z.infer<typeof updateReminderSchema>;
export type ReminderFilterInput = z.infer<typeof reminderFilterSchema>;
export type LogPatternInput = z.infer<typeof logPatternSchema>;
export type AddPerformanceNoteInput = z.infer<typeof addPerformanceNoteSchema>;
export type CreateEscalationInput = z.infer<typeof createEscalationSchema>;
export type SendCustomerMessageInput = z.infer<typeof sendCustomerMessageSchema>;
export type PerformanceFilterInput = z.infer<typeof performanceFilterSchema>;
