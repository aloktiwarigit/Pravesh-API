/**
 * Razorpay API client for server-side operations.
 * key_secret NEVER leaves the server.
 *
 * Story 4.1: Razorpay SDK Integration
 * Story 4.13: Refund processing
 * Story 4.15: Payment fetch for retry
 */
import crypto from 'crypto';

export interface RazorpayOrderOptions {
  amount: number; // in paise
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayOrderResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  created_at: number;
}

export interface RazorpayRefundResponse {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  payment_id: string;
  status: string;
  created_at: number;
}

export interface RazorpayPaymentResponse {
  id: string;
  entity: string;
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  order_id: string;
  method: string;
  captured: boolean;
  description: string;
  error_code: string | null;
  error_description: string | null;
}

export class RazorpayClient {
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly baseUrl = 'https://api.razorpay.com/v1';

  constructor(keyId: string, keySecret: string) {
    this.keyId = keyId;
    this.keySecret = keySecret;
  }

  get publicKeyId(): string {
    return this.keyId;
  }

  /**
   * Creates a Razorpay order. Amount must be in paise.
   */
  async createOrder(options: RazorpayOrderOptions): Promise<RazorpayOrderResponse> {
    const url = `${this.baseUrl}/orders`;
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Razorpay order creation failed: ${response.status} ${errorBody}`);
    }

    return response.json() as Promise<RazorpayOrderResponse>;
  }

  /**
   * Verifies the Razorpay payment signature using HMAC-SHA256.
   * This is the server-side verification step after Flutter payment completion.
   */
  verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string,
  ): boolean {
    const payload = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(payload)
      .digest('hex');
    const expectedBuf = Buffer.from(expectedSignature, 'hex');
    const signatureBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  }

  /**
   * Verifies a Razorpay webhook signature.
   */
  verifyWebhookSignature(
    body: string,
    signature: string,
    webhookSecret: string,
  ): boolean {
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body)
      .digest('hex');
    const expectedBuf = Buffer.from(expectedSignature, 'hex');
    const signatureBuf = Buffer.from(signature, 'hex');
    if (expectedBuf.length !== signatureBuf.length) return false;
    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  }

  /**
   * Creates a Razorpay payment link for WhatsApp fallback.
   */
  async createPaymentLink(options: {
    amount: number;
    currency: string;
    description: string;
    customer: { name: string; contact: string; email?: string };
    notify: { sms: boolean; email: boolean; whatsapp: boolean };
    callback_url: string;
    callback_method: string;
    notes?: Record<string, string>;
    expire_by?: number;
  }): Promise<{ id: string; short_url: string; status: string }> {
    const url = `${this.baseUrl}/payment_links`;
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(options),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Razorpay payment link creation failed: ${response.status} ${errorBody}`);
    }

    return response.json() as Promise<{ id: string; short_url: string; status: string }>;
  }

  /**
   * Fetches a payment by ID from Razorpay.
   * Story 4.15: Used for retry idempotency check.
   */
  async fetchPayment(paymentId: string): Promise<RazorpayPaymentResponse> {
    const url = `${this.baseUrl}/payments/${paymentId}`;
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
      },
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Razorpay fetch payment failed: ${response.status} ${errorBody}`);
    }

    return response.json() as Promise<RazorpayPaymentResponse>;
  }

  /**
   * Processes a refund via Razorpay API.
   * Story 4.13: Amount is in paise (smallest currency unit).
   */
  async refund(paymentId: string, amountPaise: number): Promise<RazorpayRefundResponse> {
    const url = `${this.baseUrl}/payments/${paymentId}/refund`;
    const auth = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountPaise,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Razorpay refund failed: ${response.status} ${errorBody}`);
    }

    return response.json() as Promise<RazorpayRefundResponse>;
  }
}
