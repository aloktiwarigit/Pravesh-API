/**
 * Tests for Support domain validation schemas.
 * Covers: customerSearchSchema, sendMessageSchema, createTemplateSchema,
 *         createReminderSchema, logPatternSchema, createEscalationSchema,
 *         addPerformanceNoteSchema, sendCustomerMessageSchema, performanceFilterSchema
 */
import { describe, test, expect } from 'vitest';
import {
  customerSearchSchema,
  serviceFilterSchema,
  sendMessageSchema,
  createTemplateSchema,
  updateTemplateSchema,
  logTemplateUsageSchema,
  createReminderSchema,
  updateReminderSchema,
  reminderFilterSchema,
  logPatternSchema,
  addPerformanceNoteSchema,
  createEscalationSchema,
  resolveEscalationSchema,
  sendCustomerMessageSchema,
  performanceFilterSchema,
} from '../support.validation';

describe('Support Validation Schemas', () => {
  // ============================================================
  // customerSearchSchema
  // ============================================================

  describe('customerSearchSchema', () => {
    test('accepts valid phone search', () => {
      const result = customerSearchSchema.safeParse({
        query: '9876543210',
        searchType: 'phone',
      });
      expect(result.success).toBe(true);
    });

    test('accepts valid name search', () => {
      const result = customerSearchSchema.safeParse({
        query: 'john doe',
        searchType: 'name',
      });
      expect(result.success).toBe(true);
    });

    test('accepts all search types', () => {
      const types = ['phone', 'customer_id', 'service_id', 'name'] as const;
      for (const searchType of types) {
        const result = customerSearchSchema.safeParse({ query: 'test12', searchType });
        expect(result.success).toBe(true);
      }
    });

    test('rejects query shorter than 2 characters', () => {
      const result = customerSearchSchema.safeParse({ query: 'a' });
      expect(result.success).toBe(false);
    });

    test('rejects query longer than 100 characters', () => {
      const result = customerSearchSchema.safeParse({ query: 'a'.repeat(101) });
      expect(result.success).toBe(false);
    });

    test('rejects invalid searchType', () => {
      const result = customerSearchSchema.safeParse({
        query: 'test',
        searchType: 'invalid',
      });
      expect(result.success).toBe(false);
    });

    test('accepts without searchType (optional)', () => {
      const result = customerSearchSchema.safeParse({ query: 'test-query' });
      expect(result.success).toBe(true);
    });

    test('defaults limit to 20', () => {
      const result = customerSearchSchema.safeParse({ query: 'test-query' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
      }
    });

    test('rejects limit greater than 50', () => {
      const result = customerSearchSchema.safeParse({ query: 'test', limit: 51 });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // sendMessageSchema
  // ============================================================

  describe('sendMessageSchema', () => {
    test('accepts valid message', () => {
      const result = sendMessageSchema.safeParse({
        recipientId: 'agent-001',
        serviceId: 'svc-001',
        messageText: 'Hello, please update the document status.',
      });
      expect(result.success).toBe(true);
    });

    test('accepts message with optional attachment', () => {
      const result = sendMessageSchema.safeParse({
        recipientId: 'agent-001',
        serviceId: 'svc-001',
        messageText: 'Please see the attached document.',
        attachmentUrl: 'https://example.com/doc.pdf',
        attachmentType: 'document',
      });
      expect(result.success).toBe(true);
    });

    test('rejects empty messageText', () => {
      const result = sendMessageSchema.safeParse({
        recipientId: 'agent-001',
        serviceId: 'svc-001',
        messageText: '',
      });
      expect(result.success).toBe(false);
    });

    test('rejects messageText exceeding 2000 characters', () => {
      const result = sendMessageSchema.safeParse({
        recipientId: 'agent-001',
        serviceId: 'svc-001',
        messageText: 'a'.repeat(2001),
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid attachmentType', () => {
      const result = sendMessageSchema.safeParse({
        recipientId: 'agent-001',
        serviceId: 'svc-001',
        messageText: 'hello',
        attachmentType: 'video',
      });
      expect(result.success).toBe(false);
    });

    test('rejects missing recipientId', () => {
      const result = sendMessageSchema.safeParse({
        serviceId: 'svc-001',
        messageText: 'hello',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // createTemplateSchema
  // ============================================================

  describe('createTemplateSchema', () => {
    test('accepts valid template', () => {
      const result = createTemplateSchema.safeParse({
        category: 'DOCUMENT_REQUESTS',
        templateTextEn: 'Please submit the required document for your service.',
        templateTextHi: 'कृपया अपनी सेवा के लिए आवश्यक दस्तावेज़ जमा करें।',
        placeholders: ['{{customer_name}}', '{{document_type}}'],
      });
      expect(result.success).toBe(true);
    });

    test('accepts all valid categories', () => {
      const categories = [
        'DOCUMENT_REQUESTS',
        'TIMELINE_UPDATES',
        'ISSUE_RESOLUTION',
        'GENERAL_INQUIRY',
      ] as const;
      for (const category of categories) {
        const result = createTemplateSchema.safeParse({
          category,
          templateTextEn: 'Template text in English goes here.',
          templateTextHi: 'Template text in Hindi goes here ok.',
        });
        expect(result.success).toBe(true);
      }
    });

    test('rejects templateTextEn shorter than 10 characters', () => {
      const result = createTemplateSchema.safeParse({
        category: 'GENERAL_INQUIRY',
        templateTextEn: 'Short',
        templateTextHi: 'Template text in Hindi goes here.',
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid category', () => {
      const result = createTemplateSchema.safeParse({
        category: 'INVALID_CATEGORY',
        templateTextEn: 'Template text in English goes here.',
        templateTextHi: 'Template text in Hindi goes here ok.',
      });
      expect(result.success).toBe(false);
    });

    test('defaults placeholders to empty array', () => {
      const result = createTemplateSchema.safeParse({
        category: 'DOCUMENT_REQUESTS',
        templateTextEn: 'Template text in English goes here.',
        templateTextHi: 'Template text in Hindi goes here ok.',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.placeholders).toEqual([]);
      }
    });
  });

  // ============================================================
  // createReminderSchema
  // ============================================================

  describe('createReminderSchema', () => {
    const futureDate = new Date(Date.now() + 86400000).toISOString();

    test('accepts valid reminder', () => {
      const result = createReminderSchema.safeParse({
        serviceId: 'svc-001',
        reminderDatetime: futureDate,
        reminderType: 'FOLLOW_UP_CUSTOMER',
        notes: 'Customer requested callback tomorrow.',
      });
      expect(result.success).toBe(true);
    });

    test('accepts all valid reminderTypes', () => {
      const types = ['FOLLOW_UP_CUSTOMER', 'CHECK_WITH_AGENT', 'ESCALATE_TO_OPS'] as const;
      for (const reminderType of types) {
        const result = createReminderSchema.safeParse({
          serviceId: 'svc-001',
          reminderDatetime: futureDate,
          reminderType,
        });
        expect(result.success).toBe(true);
      }
    });

    test('rejects invalid reminderType', () => {
      const result = createReminderSchema.safeParse({
        serviceId: 'svc-001',
        reminderDatetime: futureDate,
        reminderType: 'INVALID_TYPE',
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid datetime format', () => {
      const result = createReminderSchema.safeParse({
        serviceId: 'svc-001',
        reminderDatetime: 'not-a-date',
        reminderType: 'FOLLOW_UP_CUSTOMER',
      });
      expect(result.success).toBe(false);
    });

    test('rejects notes exceeding 500 characters', () => {
      const result = createReminderSchema.safeParse({
        serviceId: 'svc-001',
        reminderDatetime: futureDate,
        reminderType: 'FOLLOW_UP_CUSTOMER',
        notes: 'a'.repeat(501),
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // logPatternSchema
  // ============================================================

  describe('logPatternSchema', () => {
    test('accepts valid pattern array', () => {
      const result = logPatternSchema.safeParse({
        patterns: [
          { patternCategory: 'DOCUMENT_CONFUSION', notes: 'Customer confused about Aadhaar' },
          { patternCategory: 'PAYMENT_ISSUES' },
        ],
      });
      expect(result.success).toBe(true);
    });

    test('accepts all valid pattern categories', () => {
      const categories = [
        'DOCUMENT_CONFUSION',
        'PAYMENT_ISSUES',
        'AGENT_COMMUNICATION_GAP',
        'GOVERNMENT_OFFICE_DELAYS',
        'SLA_MISALIGNMENT',
        'OTHER',
      ] as const;
      for (const patternCategory of categories) {
        const result = logPatternSchema.safeParse({
          patterns: [{ patternCategory }],
        });
        expect(result.success).toBe(true);
      }
    });

    test('rejects empty patterns array', () => {
      const result = logPatternSchema.safeParse({ patterns: [] });
      expect(result.success).toBe(false);
    });

    test('rejects more than 6 patterns', () => {
      const result = logPatternSchema.safeParse({
        patterns: Array(7).fill({ patternCategory: 'OTHER' }),
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid patternCategory', () => {
      const result = logPatternSchema.safeParse({
        patterns: [{ patternCategory: 'INVALID' }],
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // createEscalationSchema
  // ============================================================

  describe('createEscalationSchema', () => {
    test('accepts valid escalation', () => {
      const result = createEscalationSchema.safeParse({
        serviceId: 'svc-001',
        customerId: 'cust-001',
        escalationType: 'CUSTOMER_COMPLAINT',
        escalationReason: 'Customer is unhappy with service delay.',
        severity: 'COMPLEX',
      });
      expect(result.success).toBe(true);
    });

    test('defaults severity to STANDARD', () => {
      const result = createEscalationSchema.safeParse({
        serviceId: 'svc-001',
        customerId: 'cust-001',
        escalationType: 'SLA_BREACH',
        escalationReason: 'SLA has been breached.',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.severity).toBe('STANDARD');
      }
    });

    test('rejects escalationReason shorter than 5 characters', () => {
      const result = createEscalationSchema.safeParse({
        serviceId: 'svc-001',
        customerId: 'cust-001',
        escalationType: 'AGENT_ISSUE',
        escalationReason: 'Bad',
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid escalationType', () => {
      const result = createEscalationSchema.safeParse({
        serviceId: 'svc-001',
        customerId: 'cust-001',
        escalationType: 'INVALID',
        escalationReason: 'Some reason here.',
      });
      expect(result.success).toBe(false);
    });

    test('accepts all valid escalation types', () => {
      const types = ['CUSTOMER_COMPLAINT', 'SLA_BREACH', 'AGENT_ISSUE', 'AUTO_GENERATED'] as const;
      for (const escalationType of types) {
        const result = createEscalationSchema.safeParse({
          serviceId: 'svc-001',
          customerId: 'cust-001',
          escalationType,
          escalationReason: 'Sufficient reason provided.',
        });
        expect(result.success).toBe(true);
      }
    });
  });

  // ============================================================
  // addPerformanceNoteSchema
  // ============================================================

  describe('addPerformanceNoteSchema', () => {
    test('accepts valid performance note', () => {
      const result = addPerformanceNoteSchema.safeParse({
        agentId: 'agent-001',
        serviceId: 'svc-001',
        noteType: 'POSITIVE_FEEDBACK',
        notes: 'Agent performed exceptionally well on this case.',
      });
      expect(result.success).toBe(true);
    });

    test('accepts all valid noteTypes', () => {
      const types = ['POSITIVE_FEEDBACK', 'CONCERN', 'NEUTRAL_OBSERVATION'] as const;
      for (const noteType of types) {
        const result = addPerformanceNoteSchema.safeParse({
          agentId: 'agent-001',
          serviceId: 'svc-001',
          noteType,
          notes: 'Agent notes for this observation.',
        });
        expect(result.success).toBe(true);
      }
    });

    test('rejects notes shorter than 5 characters', () => {
      const result = addPerformanceNoteSchema.safeParse({
        agentId: 'agent-001',
        serviceId: 'svc-001',
        noteType: 'CONCERN',
        notes: 'Bad',
      });
      expect(result.success).toBe(false);
    });

    test('rejects notes exceeding 2000 characters', () => {
      const result = addPerformanceNoteSchema.safeParse({
        agentId: 'agent-001',
        serviceId: 'svc-001',
        noteType: 'CONCERN',
        notes: 'a'.repeat(2001),
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // sendCustomerMessageSchema
  // ============================================================

  describe('sendCustomerMessageSchema', () => {
    test('accepts valid customer message', () => {
      const result = sendCustomerMessageSchema.safeParse({
        serviceId: 'svc-001',
        recipientId: 'cust-001',
        messageText: 'Your document has been received and is under review.',
      });
      expect(result.success).toBe(true);
    });

    test('defaults deliveryChannel to PUSH_ONLY', () => {
      const result = sendCustomerMessageSchema.safeParse({
        serviceId: 'svc-001',
        recipientId: 'cust-001',
        messageText: 'Hello customer.',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.deliveryChannel).toBe('PUSH_ONLY');
      }
    });

    test('accepts PUSH_AND_WHATSAPP deliveryChannel', () => {
      const result = sendCustomerMessageSchema.safeParse({
        serviceId: 'svc-001',
        recipientId: 'cust-001',
        messageText: 'Your service is complete.',
        deliveryChannel: 'PUSH_AND_WHATSAPP',
      });
      expect(result.success).toBe(true);
    });

    test('rejects empty messageText', () => {
      const result = sendCustomerMessageSchema.safeParse({
        serviceId: 'svc-001',
        recipientId: 'cust-001',
        messageText: '',
      });
      expect(result.success).toBe(false);
    });

    test('rejects messageText exceeding 5000 characters', () => {
      const result = sendCustomerMessageSchema.safeParse({
        serviceId: 'svc-001',
        recipientId: 'cust-001',
        messageText: 'a'.repeat(5001),
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid deliveryChannel', () => {
      const result = sendCustomerMessageSchema.safeParse({
        serviceId: 'svc-001',
        recipientId: 'cust-001',
        messageText: 'hello',
        deliveryChannel: 'SMS',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // performanceFilterSchema
  // ============================================================

  describe('performanceFilterSchema', () => {
    test('accepts empty object (all optional)', () => {
      const result = performanceFilterSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    test('defaults format to json', () => {
      const result = performanceFilterSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.format).toBe('json');
      }
    });

    test('accepts csv format', () => {
      const result = performanceFilterSchema.safeParse({ format: 'csv' });
      expect(result.success).toBe(true);
    });

    test('accepts tier filter', () => {
      const tiers = ['top', 'middle', 'bottom'] as const;
      for (const tier of tiers) {
        const result = performanceFilterSchema.safeParse({ tier });
        expect(result.success).toBe(true);
      }
    });

    test('rejects invalid tier', () => {
      const result = performanceFilterSchema.safeParse({ tier: 'worst' });
      expect(result.success).toBe(false);
    });

    test('rejects invalid format', () => {
      const result = performanceFilterSchema.safeParse({ format: 'xml' });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // serviceFilterSchema
  // ============================================================

  describe('serviceFilterSchema', () => {
    test('accepts valid filter with all fields', () => {
      const result = serviceFilterSchema.safeParse({
        customerId: 'cust-001',
        status: 'active',
        serviceType: 'title_check',
        dateFrom: new Date().toISOString(),
        dateTo: new Date().toISOString(),
      });
      expect(result.success).toBe(true);
    });

    test('accepts with only required customerId', () => {
      const result = serviceFilterSchema.safeParse({ customerId: 'cust-001' });
      expect(result.success).toBe(true);
    });

    test('rejects missing customerId', () => {
      const result = serviceFilterSchema.safeParse({ status: 'active' });
      expect(result.success).toBe(false);
    });

    test('rejects invalid status', () => {
      const result = serviceFilterSchema.safeParse({
        customerId: 'cust-001',
        status: 'pending',
      });
      expect(result.success).toBe(false);
    });

    test('accepts all valid statuses', () => {
      for (const status of ['active', 'completed', 'halted'] as const) {
        const result = serviceFilterSchema.safeParse({ customerId: 'cust-001', status });
        expect(result.success).toBe(true);
      }
    });

    test('defaults limit to 20', () => {
      const result = serviceFilterSchema.safeParse({ customerId: 'cust-001' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.limit).toBe(20);
      }
    });
  });

  // ============================================================
  // updateTemplateSchema
  // ============================================================

  describe('updateTemplateSchema', () => {
    test('accepts empty object (all optional)', () => {
      const result = updateTemplateSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    test('accepts partial update with category only', () => {
      const result = updateTemplateSchema.safeParse({ category: 'GENERAL_INQUIRY' });
      expect(result.success).toBe(true);
    });

    test('accepts updating templateTextEn only', () => {
      const result = updateTemplateSchema.safeParse({
        templateTextEn: 'Updated English template text.',
      });
      expect(result.success).toBe(true);
    });

    test('rejects templateTextEn shorter than 10 characters', () => {
      const result = updateTemplateSchema.safeParse({ templateTextEn: 'Short' });
      expect(result.success).toBe(false);
    });

    test('rejects invalid category', () => {
      const result = updateTemplateSchema.safeParse({ category: 'INVALID' });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // logTemplateUsageSchema
  // ============================================================

  describe('logTemplateUsageSchema', () => {
    test('accepts valid usage log with templateId only', () => {
      const result = logTemplateUsageSchema.safeParse({ templateId: 'tmpl-001' });
      expect(result.success).toBe(true);
    });

    test('accepts valid usage log with templateId and serviceId', () => {
      const result = logTemplateUsageSchema.safeParse({
        templateId: 'tmpl-001',
        serviceId: 'svc-001',
      });
      expect(result.success).toBe(true);
    });

    test('rejects missing templateId', () => {
      const result = logTemplateUsageSchema.safeParse({ serviceId: 'svc-001' });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // reminderFilterSchema
  // ============================================================

  describe('reminderFilterSchema', () => {
    test('accepts empty object (all optional)', () => {
      const result = reminderFilterSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    test('accepts valid status filter', () => {
      for (const status of ['PENDING', 'COMPLETED', 'SNOOZED'] as const) {
        const result = reminderFilterSchema.safeParse({ status });
        expect(result.success).toBe(true);
      }
    });

    test('rejects invalid status', () => {
      const result = reminderFilterSchema.safeParse({ status: 'CANCELLED' });
      expect(result.success).toBe(false);
    });

    test('accepts dateFrom and dateTo filters', () => {
      const result = reminderFilterSchema.safeParse({
        dateFrom: new Date().toISOString(),
        dateTo: new Date().toISOString(),
      });
      expect(result.success).toBe(true);
    });

    test('rejects invalid dateFrom format', () => {
      const result = reminderFilterSchema.safeParse({ dateFrom: 'not-a-date' });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // resolveEscalationSchema
  // ============================================================

  describe('resolveEscalationSchema', () => {
    test('accepts empty object (resolutionNotes is optional)', () => {
      const result = resolveEscalationSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    test('accepts valid resolution notes', () => {
      const result = resolveEscalationSchema.safeParse({
        resolutionNotes: 'Issue resolved by coordinating with the agent.',
      });
      expect(result.success).toBe(true);
    });

    test('rejects resolutionNotes shorter than 5 characters', () => {
      const result = resolveEscalationSchema.safeParse({ resolutionNotes: 'ok' });
      expect(result.success).toBe(false);
    });

    test('rejects resolutionNotes exceeding 2000 characters', () => {
      const result = resolveEscalationSchema.safeParse({
        resolutionNotes: 'a'.repeat(2001),
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // updateReminderSchema
  // ============================================================

  describe('updateReminderSchema', () => {
    test('accepts COMPLETED status', () => {
      const result = updateReminderSchema.safeParse({ status: 'COMPLETED' });
      expect(result.success).toBe(true);
    });

    test('accepts SNOOZED with snoozedUntil', () => {
      const result = updateReminderSchema.safeParse({
        status: 'SNOOZED',
        snoozedUntil: new Date(Date.now() + 86400000).toISOString(),
      });
      expect(result.success).toBe(true);
    });

    test('rejects invalid status', () => {
      const result = updateReminderSchema.safeParse({ status: 'PENDING' });
      expect(result.success).toBe(false);
    });
  });
});
