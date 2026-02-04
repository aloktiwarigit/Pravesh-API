/**
 * Story 7-4: WhatsApp Webhook Service
 * Handles delivery status updates and incoming messages (STOP opt-out)
 */

import { PrismaClient } from '@prisma/client';
import { env } from '../../shared/config/env';
import { logger } from '../../shared/utils/logger';
import crypto from 'node:crypto';

export class WhatsAppWebhookService {
  constructor(private readonly prisma: PrismaClient) {}

  verifyWebhook(mode: string, token: string, challenge: string): string | null {
    if (mode === 'subscribe' && token === env.WHATSAPP_VERIFY_TOKEN) {
      return challenge;
    }
    return null;
  }

  verifySignature(body: string, signature: string): boolean {
    const expectedSig = crypto
      .createHmac('sha256', env.WHATSAPP_APP_SECRET)
      .update(body)
      .digest('hex');
    const expectedFull = `sha256=${expectedSig}`;
    const expectedBuf = Buffer.from(expectedFull, 'utf8');
    const signatureBuf = Buffer.from(signature, 'utf8');
    if (expectedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  }

  async processWebhook(payload: any): Promise<void> {
    const entries = payload.entry ?? [];

    for (const entry of entries) {
      const changes = entry.changes ?? [];
      for (const change of changes) {
        if (change.field === 'messages') {
          await this.handleMessageStatus(change.value);
          await this.handleIncomingMessage(change.value);
        }
      }
    }
  }

  private async handleMessageStatus(value: any): Promise<void> {
    const statuses = value.statuses ?? [];

    for (const status of statuses) {
      const { id: messageId, status: deliveryStatus, timestamp } = status;

      const statusMap: Record<string, any> = {
        sent: { status: 'sent', sentAt: new Date(parseInt(timestamp) * 1000) },
        delivered: { status: 'delivered', deliveredAt: new Date(parseInt(timestamp) * 1000) },
        read: { status: 'read', readAt: new Date(parseInt(timestamp) * 1000) },
        failed: {
          status: 'failed',
          failedAt: new Date(parseInt(timestamp) * 1000),
          failureReason: status.errors?.[0]?.title ?? 'Unknown',
        },
      };

      const update = statusMap[deliveryStatus];
      if (!update) continue;

      await this.prisma.notificationLog.updateMany({
        where: { externalMessageId: messageId },
        data: update,
      });

      logger.info({ messageId, deliveryStatus }, 'WhatsApp delivery status updated');
    }
  }

  private async handleIncomingMessage(value: any): Promise<void> {
    const messages = value.messages ?? [];

    for (const message of messages) {
      // AC8: Handle STOP opt-out
      if (message.type === 'text') {
        const text = message.text?.body?.toUpperCase().trim();
        if (text === 'STOP') {
          const phone = message.from;

          logger.info({ phone }, 'WhatsApp STOP received - processing opt-out');

          try {
            // Find user by phone number
            // TODO: User model does not exist in Prisma schema yet. Using (prisma as any).
            const user = await (this.prisma as any).user.findFirst({
              where: { phone },
              select: { id: true },
            });

            if (user) {
              // Disable all WhatsApp notification channels for this user
              await this.prisma.userNotificationPreference.upsert({
                where: { userId: user.id },
                update: {
                  serviceUpdatesWhatsapp: false,
                  documentWhatsapp: false,
                  marketingWhatsapp: false,
                },
                create: {
                  userId: user.id,
                  serviceUpdatesWhatsapp: false,
                  documentWhatsapp: false,
                  marketingWhatsapp: false,
                },
              });

              logger.info({ phone, userId: user.id }, 'WhatsApp opt-out applied - all WhatsApp channels disabled');
            } else {
              // Store opt-out record even if user not found, so it can be
              // applied when the phone number is later associated with a user
              logger.warn({ phone }, 'WhatsApp STOP received but no user found for phone — logging for deferred processing');
              // TODO: WhatsappOptOut model does not exist in Prisma schema yet. Using (prisma as any).
              await (this.prisma as any).whatsappOptOut.create({
                data: {
                  phone,
                  optedOutAt: new Date(),
                },
              }).catch(() => {
                // Table may not exist yet; log and continue
                logger.warn({ phone }, 'Could not persist WhatsApp opt-out record — whatsappOptOut table may not exist');
              });
            }
          } catch (e) {
            logger.error({ phone, error: e }, 'Failed to process STOP opt-out');
          }
        }
      }
    }
  }
}
