/**
 * WhatsApp Business API client.
 * Supports MSG91 as the primary provider with direct Meta API as fallback.
 * FR108: WhatsApp messages for milestones, communication, receipts
 *
 * Required environment variables:
 *   WHATSAPP_API_KEY     — MSG91 API key (authkey)
 *   WHATSAPP_SENDER_ID   — Registered sender / integrated number
 *   WHATSAPP_PROVIDER    — 'msg91' (default) | 'meta'
 *
 * For the 'meta' provider the existing env vars are reused:
 *   WHATSAPP_PHONE_NUMBER_ID — Meta phone number ID
 *   WHATSAPP_ACCESS_TOKEN    — Meta permanent access token
 */

import { logger } from '../../shared/utils/logger.js';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type WhatsAppProvider = 'msg91' | 'meta';

export interface WhatsAppDeliveryResult {
  messageId: string;
  status: string;
}

export interface WhatsAppClientOptions {
  apiKey: string;
  senderId: string;
  provider?: WhatsAppProvider;
}

// ---------------------------------------------------------------------------
// MSG91 internal payload shapes
// ---------------------------------------------------------------------------

interface Msg91TemplatePayload {
  integrated_number: string;
  content_type: 'template';
  payload: {
    to: string;
    type: 'template';
    template: {
      name: string;
      language: { code: string };
      components: Array<{
        type: 'body';
        parameters: Array<{ type: 'text'; text: string }>;
      }>;
    };
  };
}

interface Msg91TextPayload {
  integrated_number: string;
  content_type: 'text';
  payload: {
    to: string;
    type: 'text';
    text: { body: string };
  };
}

interface Msg91DocumentPayload {
  integrated_number: string;
  content_type: 'document';
  payload: {
    to: string;
    type: 'document';
    document: { link: string; caption: string };
  };
}

// ---------------------------------------------------------------------------
// Meta internal payload shapes
// ---------------------------------------------------------------------------

interface MetaTextPayload {
  messaging_product: 'whatsapp';
  to: string;
  type: 'text';
  text: { body: string };
}

interface MetaTemplatePayload {
  messaging_product: 'whatsapp';
  to: string;
  type: 'template';
  template: {
    name: string;
    language: { code: string };
    components: Array<{
      type: 'body';
      parameters: Array<{ type: 'text'; text: string }>;
    }>;
  };
}

interface MetaDocumentPayload {
  messaging_product: 'whatsapp';
  to: string;
  type: 'document';
  document: { link: string; caption: string };
}

// ---------------------------------------------------------------------------
// Client implementation
// ---------------------------------------------------------------------------

export class WhatsAppClient {
  private readonly apiKey: string;
  private readonly senderId: string;
  private readonly provider: WhatsAppProvider;

  // MSG91
  private readonly msg91BaseUrl = 'https://api.msg91.com/api/v5/whatsapp/';

  // Meta (values pulled from env at runtime so the client stays testable)
  private readonly metaBaseUrl = 'https://graph.facebook.com/v18.0';
  private readonly metaPhoneNumberId: string;
  private readonly metaAccessToken: string;

  constructor(options: WhatsAppClientOptions) {
    this.apiKey = options.apiKey;
    this.senderId = options.senderId;
    this.provider = options.provider ?? 'msg91';
    this.metaPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
    this.metaAccessToken = process.env.WHATSAPP_ACCESS_TOKEN ?? '';
  }

  // -------------------------------------------------------------------------
  // Public API
  // -------------------------------------------------------------------------

  /**
   * Send a pre-approved WhatsApp Business template message.
   * FR108: Used for milestone updates, receipts, payment links.
   */
  async sendTemplate(
    phone: string,
    templateName: string,
    params: Record<string, string>,
  ): Promise<WhatsAppDeliveryResult> {
    logger.info({ phone, templateName, provider: this.provider }, 'WhatsApp: sending template');

    try {
      if (this.provider === 'msg91') {
        return await this.msg91SendTemplate(phone, templateName, params);
      }
      return await this.metaSendTemplate(phone, templateName, params);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ phone, templateName, err: message }, 'WhatsApp: sendTemplate failed');
      return { messageId: '', status: 'error' };
    }
  }

  /**
   * Send a plain text WhatsApp message.
   * Used for ad-hoc agent communications (FR108).
   */
  async sendText(phone: string, message: string): Promise<WhatsAppDeliveryResult> {
    logger.info({ phone, provider: this.provider }, 'WhatsApp: sending text');

    try {
      if (this.provider === 'msg91') {
        return await this.msg91SendText(phone, message);
      }
      return await this.metaSendText(phone, message);
    } catch (err) {
      const message_ = err instanceof Error ? err.message : String(err);
      logger.error({ phone, err: message_ }, 'WhatsApp: sendText failed');
      return { messageId: '', status: 'error' };
    }
  }

  /**
   * Send a document (PDF, image) via WhatsApp.
   * FR108: Receipt and document delivery over WhatsApp.
   */
  async sendDocument(
    phone: string,
    documentUrl: string,
    caption: string,
  ): Promise<WhatsAppDeliveryResult> {
    logger.info({ phone, documentUrl, provider: this.provider }, 'WhatsApp: sending document');

    try {
      if (this.provider === 'msg91') {
        return await this.msg91SendDocument(phone, documentUrl, caption);
      }
      return await this.metaSendDocument(phone, documentUrl, caption);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ phone, documentUrl, err: message }, 'WhatsApp: sendDocument failed');
      return { messageId: '', status: 'error' };
    }
  }

  /**
   * Send a payment link message via WhatsApp.
   * FR108: Payment request communication over WhatsApp.
   * Composes a human-readable text message with the link embedded.
   */
  async sendPaymentLink(
    phone: string,
    amount: string,
    paymentUrl: string,
  ): Promise<WhatsAppDeliveryResult> {
    logger.info({ phone, amount, provider: this.provider }, 'WhatsApp: sending payment link');

    const messageBody =
      `Payment request of ₹${amount} is due.\n` +
      `Please complete your payment here: ${paymentUrl}\n` +
      `This link expires in 24 hours.`;

    try {
      if (this.provider === 'msg91') {
        return await this.msg91SendText(phone, messageBody);
      }
      return await this.metaSendText(phone, messageBody);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ phone, amount, err: message }, 'WhatsApp: sendPaymentLink failed');
      return { messageId: '', status: 'error' };
    }
  }

  // -------------------------------------------------------------------------
  // MSG91 provider internals
  // -------------------------------------------------------------------------

  private normalisePhone(phone: string): string {
    // MSG91 expects plain digits without leading + or country code prefix spaces
    return phone.replace(/\s+/g, '').replace(/^\+/, '');
  }

  private async msg91Post(payload: unknown): Promise<WhatsAppDeliveryResult> {
    const response = await fetch(this.msg91BaseUrl, {
      method: 'POST',
      headers: {
        authkey: this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`MSG91 WhatsApp API error ${response.status}: ${responseText}`);
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      data = {};
    }

    const messageId =
      (data.message_id as string | undefined) ??
      (data.request_id as string | undefined) ??
      '';

    logger.info({ messageId }, 'MSG91 WhatsApp message sent');
    return { messageId, status: 'sent' };
  }

  private async msg91SendTemplate(
    phone: string,
    templateName: string,
    params: Record<string, string>,
  ): Promise<WhatsAppDeliveryResult> {
    const parameters = Object.values(params).map((value) => ({
      type: 'text' as const,
      text: value,
    }));

    const payload: Msg91TemplatePayload = {
      integrated_number: this.senderId,
      content_type: 'template',
      payload: {
        to: this.normalisePhone(phone),
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en' },
          components: [{ type: 'body', parameters }],
        },
      },
    };

    return this.msg91Post(payload);
  }

  private async msg91SendText(
    phone: string,
    message: string,
  ): Promise<WhatsAppDeliveryResult> {
    const payload: Msg91TextPayload = {
      integrated_number: this.senderId,
      content_type: 'text',
      payload: {
        to: this.normalisePhone(phone),
        type: 'text',
        text: { body: message },
      },
    };

    return this.msg91Post(payload);
  }

  private async msg91SendDocument(
    phone: string,
    documentUrl: string,
    caption: string,
  ): Promise<WhatsAppDeliveryResult> {
    const payload: Msg91DocumentPayload = {
      integrated_number: this.senderId,
      content_type: 'document',
      payload: {
        to: this.normalisePhone(phone),
        type: 'document',
        document: { link: documentUrl, caption },
      },
    };

    return this.msg91Post(payload);
  }

  // -------------------------------------------------------------------------
  // Meta provider internals
  // -------------------------------------------------------------------------

  private async metaPost(payload: unknown): Promise<WhatsAppDeliveryResult> {
    const url = `${this.metaBaseUrl}/${this.metaPhoneNumberId}/messages`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.metaAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`Meta WhatsApp API error ${response.status}: ${responseText}`);
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      data = {};
    }

    const messages = data.messages as Array<{ id: string }> | undefined;
    const messageId = messages?.[0]?.id ?? '';

    logger.info({ messageId }, 'Meta WhatsApp message sent');
    return { messageId, status: 'sent' };
  }

  private async metaSendTemplate(
    phone: string,
    templateName: string,
    params: Record<string, string>,
  ): Promise<WhatsAppDeliveryResult> {
    const parameters = Object.values(params).map((value) => ({
      type: 'text' as const,
      text: value,
    }));

    const payload: MetaTemplatePayload = {
      messaging_product: 'whatsapp',
      to: phone.replace('+', ''),
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' },
        components: [{ type: 'body', parameters }],
      },
    };

    return this.metaPost(payload);
  }

  private async metaSendText(
    phone: string,
    message: string,
  ): Promise<WhatsAppDeliveryResult> {
    const payload: MetaTextPayload = {
      messaging_product: 'whatsapp',
      to: phone.replace('+', ''),
      type: 'text',
      text: { body: message },
    };

    return this.metaPost(payload);
  }

  private async metaSendDocument(
    phone: string,
    documentUrl: string,
    caption: string,
  ): Promise<WhatsAppDeliveryResult> {
    const payload: MetaDocumentPayload = {
      messaging_product: 'whatsapp',
      to: phone.replace('+', ''),
      type: 'document',
      document: { link: documentUrl, caption },
    };

    return this.metaPost(payload);
  }
}
