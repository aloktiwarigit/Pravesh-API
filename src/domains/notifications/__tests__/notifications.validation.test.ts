/**
 * Tests for Notification domain validation schemas.
 * Covers: templateQuerySchema, registerDeviceTokenSchema,
 *         updatePreferencesSchema, historyQuerySchema
 * Stories 7-1, 7-3, 7-7, 7-10
 */
import { describe, test, expect } from 'vitest';
import {
  templateQuerySchema,
  registerDeviceTokenSchema,
  updatePreferencesSchema,
  historyQuerySchema,
} from '../notifications.validation';

describe('Notifications Validation Schemas', () => {
  // ============================================================
  // templateQuerySchema
  // ============================================================

  describe('templateQuerySchema', () => {
    test('accepts empty object (all optional)', () => {
      const result = templateQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    test('accepts all valid event_type values', () => {
      const eventTypes = [
        'service_status_change',
        'payment_confirmation',
        'document_delivered',
        'sla_alert',
        'auto_reassurance',
        'disruption_broadcast',
        'task_assignment',
        'agent_communication',
        'campaign_marketing',
        'receipt_delivery',
        'otp',
        'payment_link',
      ] as const;

      for (const event_type of eventTypes) {
        const result = templateQuerySchema.safeParse({ event_type });
        expect(result.success).toBe(true);
      }
    });

    test('accepts all valid channel values', () => {
      for (const channel of ['push', 'whatsapp', 'sms'] as const) {
        const result = templateQuerySchema.safeParse({ channel });
        expect(result.success).toBe(true);
      }
    });

    test('accepts all valid language values', () => {
      for (const language of ['hi', 'en'] as const) {
        const result = templateQuerySchema.safeParse({ language });
        expect(result.success).toBe(true);
      }
    });

    test('rejects invalid event_type', () => {
      const result = templateQuerySchema.safeParse({ event_type: 'invalid_event' });
      expect(result.success).toBe(false);
    });

    test('rejects invalid channel', () => {
      const result = templateQuerySchema.safeParse({ channel: 'email' });
      expect(result.success).toBe(false);
    });

    test('rejects invalid language', () => {
      const result = templateQuerySchema.safeParse({ language: 'fr' });
      expect(result.success).toBe(false);
    });

    test('accepts query with all filters', () => {
      const result = templateQuerySchema.safeParse({
        event_type: 'otp',
        channel: 'sms',
        language: 'en',
      });
      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // registerDeviceTokenSchema
  // ============================================================

  describe('registerDeviceTokenSchema', () => {
    test('accepts valid Android device token', () => {
      const result = registerDeviceTokenSchema.safeParse({
        token: 'eExj_FCM_TOKEN_ANDROID_XYZ_123456789abcdef',
        platform: 'android',
      });
      expect(result.success).toBe(true);
    });

    test('accepts valid iOS device token', () => {
      const result = registerDeviceTokenSchema.safeParse({
        token: 'APNS_TOKEN_IOS_12345678901234567890',
        platform: 'ios',
      });
      expect(result.success).toBe(true);
    });

    test('rejects empty token', () => {
      const result = registerDeviceTokenSchema.safeParse({
        token: '',
        platform: 'android',
      });
      expect(result.success).toBe(false);
    });

    test('rejects token exceeding 500 characters', () => {
      const result = registerDeviceTokenSchema.safeParse({
        token: 'a'.repeat(501),
        platform: 'android',
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid platform', () => {
      const result = registerDeviceTokenSchema.safeParse({
        token: 'valid-token-123',
        platform: 'windows',
      });
      expect(result.success).toBe(false);
    });

    test('rejects missing platform', () => {
      const result = registerDeviceTokenSchema.safeParse({
        token: 'valid-token-123',
      });
      expect(result.success).toBe(false);
    });

    test('rejects missing token', () => {
      const result = registerDeviceTokenSchema.safeParse({
        platform: 'android',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // updatePreferencesSchema
  // ============================================================

  describe('updatePreferencesSchema', () => {
    test('accepts empty object (all optional)', () => {
      const result = updatePreferencesSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    test('accepts valid preferences update', () => {
      const result = updatePreferencesSchema.safeParse({
        serviceUpdatesPush: true,
        serviceUpdatesWhatsapp: false,
        paymentPush: true,
        paymentSms: false,
        documentPush: true,
        documentWhatsapp: false,
        marketingWhatsapp: false,
        preferredLanguage: 'hi',
      });
      expect(result.success).toBe(true);
    });

    test('accepts partial preferences update', () => {
      const result = updatePreferencesSchema.safeParse({
        serviceUpdatesPush: false,
        preferredLanguage: 'en',
      });
      expect(result.success).toBe(true);
    });

    test('rejects invalid preferredLanguage', () => {
      const result = updatePreferencesSchema.safeParse({
        preferredLanguage: 'fr',
      });
      expect(result.success).toBe(false);
    });

    test('rejects non-boolean boolean fields', () => {
      const result = updatePreferencesSchema.safeParse({
        serviceUpdatesPush: 'yes',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // historyQuerySchema
  // ============================================================

  describe('historyQuerySchema', () => {
    test('accepts valid query with serviceInstanceId only', () => {
      const result = historyQuerySchema.safeParse({
        serviceInstanceId: 'svc-instance-001',
      });
      expect(result.success).toBe(true);
    });

    test('accepts valid query with all filters', () => {
      const result = historyQuerySchema.safeParse({
        serviceInstanceId: 'svc-001',
        channel: 'whatsapp',
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        page: 1,
        limit: 20,
      });
      expect(result.success).toBe(true);
    });

    test('defaults page to 1 and limit to 50', () => {
      const result = historyQuerySchema.safeParse({ serviceInstanceId: 'svc-001' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(50);
      }
    });

    test('rejects missing serviceInstanceId', () => {
      const result = historyQuerySchema.safeParse({ channel: 'push' });
      expect(result.success).toBe(false);
    });

    test('rejects invalid channel', () => {
      const result = historyQuerySchema.safeParse({
        serviceInstanceId: 'svc-001',
        channel: 'email',
      });
      expect(result.success).toBe(false);
    });

    test('rejects limit over 100', () => {
      const result = historyQuerySchema.safeParse({
        serviceInstanceId: 'svc-001',
        limit: 101,
      });
      expect(result.success).toBe(false);
    });

    test('rejects page less than 1', () => {
      const result = historyQuerySchema.safeParse({
        serviceInstanceId: 'svc-001',
        page: 0,
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid startDate format', () => {
      const result = historyQuerySchema.safeParse({
        serviceInstanceId: 'svc-001',
        startDate: 'not-a-date',
      });
      expect(result.success).toBe(false);
    });
  });
});
