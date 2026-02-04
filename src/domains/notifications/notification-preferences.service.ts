/**
 * Story 7-7: Notification Preferences Service
 * Manages per-user notification preferences and category-level opt-out
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../shared/utils/logger';

// Maps event types to preference fields
const PREFERENCE_MAP: Record<string, Record<string, string>> = {
  service_status_change: { push: 'serviceUpdatesPush', whatsapp: 'serviceUpdatesWhatsapp' },
  payment_confirmation: { push: 'paymentPush', sms: 'paymentSms' },
  document_delivered: { push: 'documentPush', whatsapp: 'documentWhatsapp' },
  campaign_marketing: { whatsapp: 'marketingWhatsapp' },
};

// These event types can NEVER be disabled (AC3)
const CRITICAL_EVENT_TYPES = [
  'sla_alert',
  'receipt_delivery',
  'otp',
];

export class NotificationPreferencesService {
  constructor(private readonly prisma: PrismaClient) {}

  async getPreferences(userId: string) {
    let prefs = await this.prisma.userNotificationPreference.findUnique({
      where: { userId },
    });

    if (!prefs) {
      // Create default preferences
      prefs = await this.prisma.userNotificationPreference.create({
        data: { userId },
      });
    }

    return prefs;
  }

  async updatePreferences(userId: string, updates: Record<string, boolean | string>) {
    const data: Record<string, any> = {};

    const allowedFields = [
      'serviceUpdatesPush', 'serviceUpdatesWhatsapp',
      'paymentPush', 'paymentSms',
      'documentPush', 'documentWhatsapp',
      'marketingWhatsapp', 'preferredLanguage',
    ];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        data[key] = value;
      }
    }

    return this.prisma.userNotificationPreference.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });
  }

  /**
   * AC6: Check if a notification should be sent based on user preferences.
   * Returns true if notification is allowed, false if user has disabled it.
   * Critical notifications always return true.
   */
  async isNotificationAllowed(
    userId: string,
    eventType: string,
    channel: string,
  ): Promise<boolean> {
    // Critical events are always allowed
    if (CRITICAL_EVENT_TYPES.includes(eventType)) {
      return true;
    }

    const mapping = PREFERENCE_MAP[eventType];
    if (!mapping) {
      return true; // Unknown event type -- allow by default
    }

    const preferenceField = mapping[channel];
    if (!preferenceField) {
      return true;
    }

    const prefs = await this.getPreferences(userId);
    return (prefs as any)[preferenceField] ?? true;
  }

  async getUserLanguage(userId: string): Promise<'hi' | 'en'> {
    const prefs = await this.getPreferences(userId);
    return prefs.preferredLanguage as 'hi' | 'en';
  }
}
