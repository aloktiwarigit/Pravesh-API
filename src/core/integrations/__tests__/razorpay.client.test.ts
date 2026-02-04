/**
 * [P1] Tests for Razorpay client - HMAC signature verification and API calls
 * Story 4.1, 4.13, 4.15
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';
import { RazorpayClient } from '../razorpay.client.js';

describe('[P1] RazorpayClient - Payment Signature Verification', () => {
  let client: RazorpayClient;
  const TEST_KEY_ID = 'rzp_test_key123';
  const TEST_KEY_SECRET = 'test_secret_456';

  beforeEach(() => {
    client = new RazorpayClient(TEST_KEY_ID, TEST_KEY_SECRET);
  });

  test('verifyPaymentSignature returns true for valid signature', () => {
    // Given
    const orderId = 'order_N1A2B3C4D5E6F7';
    const paymentId = 'pay_X1Y2Z3A4B5C6D7';
    const payload = `${orderId}|${paymentId}`;
    const validSignature = crypto
      .createHmac('sha256', TEST_KEY_SECRET)
      .update(payload)
      .digest('hex');

    // When
    const result = client.verifyPaymentSignature(orderId, paymentId, validSignature);

    // Then
    expect(result).toBe(true);
  });

  test('verifyPaymentSignature returns false for invalid signature', () => {
    // Given
    const orderId = 'order_N1A2B3C4D5E6F7';
    const paymentId = 'pay_X1Y2Z3A4B5C6D7';
    const invalidSignature = 'invalid_signature_12345';

    // When
    const result = client.verifyPaymentSignature(orderId, paymentId, invalidSignature);

    // Then
    expect(result).toBe(false);
  });

  test('verifyPaymentSignature uses timingSafeEqual to prevent timing attacks', () => {
    // Given
    const timingSafeEqualSpy = vi.spyOn(crypto, 'timingSafeEqual');
    const orderId = 'order_ABC123';
    const paymentId = 'pay_XYZ789';
    const payload = `${orderId}|${paymentId}`;
    const validSignature = crypto
      .createHmac('sha256', TEST_KEY_SECRET)
      .update(payload)
      .digest('hex');

    // When
    client.verifyPaymentSignature(orderId, paymentId, validSignature);

    // Then
    expect(timingSafeEqualSpy).toHaveBeenCalledOnce();
    timingSafeEqualSpy.mockRestore();
  });

  test('verifyPaymentSignature returns false for length mismatch before timingSafeEqual', () => {
    // Given - signature with different length
    const orderId = 'order_ABC123';
    const paymentId = 'pay_XYZ789';
    const shortSignature = 'abc123'; // Much shorter than HMAC-SHA256 hex output (64 chars)
    const timingSafeEqualSpy = vi.spyOn(crypto, 'timingSafeEqual');

    // When
    const result = client.verifyPaymentSignature(orderId, paymentId, shortSignature);

    // Then
    expect(result).toBe(false);
    expect(timingSafeEqualSpy).not.toHaveBeenCalled(); // Should not call timingSafeEqual
    timingSafeEqualSpy.mockRestore();
  });

  test('verifyPaymentSignature rejects tampered orderId', () => {
    // Given
    const orderId = 'order_ORIGINAL123';
    const paymentId = 'pay_XYZ789';
    const payload = `${orderId}|${paymentId}`;
    const validSignature = crypto
      .createHmac('sha256', TEST_KEY_SECRET)
      .update(payload)
      .digest('hex');

    const tamperedOrderId = 'order_TAMPERED456';

    // When
    const result = client.verifyPaymentSignature(tamperedOrderId, paymentId, validSignature);

    // Then
    expect(result).toBe(false);
  });
});

describe('[P1] RazorpayClient - Webhook Signature Verification', () => {
  let client: RazorpayClient;
  const WEBHOOK_SECRET = 'webhook_secret_xyz789';

  beforeEach(() => {
    client = new RazorpayClient('key_id', 'key_secret');
  });

  test('verifyWebhookSignature returns true for valid signature', () => {
    // Given
    const webhookBody = '{"event":"payment.captured","payload":{"payment":{"id":"pay_123"}}}';
    const validSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(webhookBody)
      .digest('hex');

    // When
    const result = client.verifyWebhookSignature(webhookBody, validSignature, WEBHOOK_SECRET);

    // Then
    expect(result).toBe(true);
  });

  test('verifyWebhookSignature returns false for invalid signature', () => {
    // Given
    const webhookBody = '{"event":"payment.captured"}';
    const invalidSignature = 'wrong_signature_abc123';

    // When
    const result = client.verifyWebhookSignature(webhookBody, invalidSignature, WEBHOOK_SECRET);

    // Then
    expect(result).toBe(false);
  });

  test('verifyWebhookSignature returns false for length mismatch', () => {
    // Given
    const webhookBody = '{"event":"payment.captured"}';
    const shortSignature = 'abc';
    const timingSafeEqualSpy = vi.spyOn(crypto, 'timingSafeEqual');

    // When
    const result = client.verifyWebhookSignature(webhookBody, shortSignature, WEBHOOK_SECRET);

    // Then
    expect(result).toBe(false);
    expect(timingSafeEqualSpy).not.toHaveBeenCalled();
    timingSafeEqualSpy.mockRestore();
  });

  test('verifyWebhookSignature uses timingSafeEqual', () => {
    // Given
    const timingSafeEqualSpy = vi.spyOn(crypto, 'timingSafeEqual');
    const webhookBody = '{"event":"payment.captured"}';
    const validSignature = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(webhookBody)
      .digest('hex');

    // When
    client.verifyWebhookSignature(webhookBody, validSignature, WEBHOOK_SECRET);

    // Then
    expect(timingSafeEqualSpy).toHaveBeenCalledOnce();
    timingSafeEqualSpy.mockRestore();
  });
});

describe('[P1] RazorpayClient - API Operations', () => {
  let client: RazorpayClient;
  const TEST_KEY_ID = 'rzp_test_key123';
  const TEST_KEY_SECRET = 'test_secret_456';

  beforeEach(() => {
    client = new RazorpayClient(TEST_KEY_ID, TEST_KEY_SECRET);
    vi.clearAllMocks();
  });

  test('createOrder sends correct parameters to Razorpay API', async () => {
    // Given
    const orderOptions = {
      amount: 50000, // 500.00 INR in paise
      currency: 'INR',
      receipt: 'receipt_SR123',
      notes: { customerId: 'cust_456', serviceRequestId: 'sr_789' },
    };

    const mockResponse = {
      id: 'order_NqZ1W2X3Y4Z5A6',
      entity: 'order',
      amount: 50000,
      amount_paid: 0,
      amount_due: 50000,
      currency: 'INR',
      receipt: 'receipt_SR123',
      status: 'created',
      created_at: 1672531200,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    // When
    const result = await client.createOrder(orderOptions);

    // Then
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.razorpay.com/v1/orders',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': expect.stringMatching(/^Basic /),
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify(orderOptions),
      })
    );
    expect(result).toEqual(mockResponse);
  });

  test('createOrder includes correct Basic Auth header', async () => {
    // Given
    const orderOptions = {
      amount: 50000,
      currency: 'INR',
      receipt: 'receipt_123',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'order_123' }),
    });

    // When
    await client.createOrder(orderOptions);

    // Then
    const expectedAuth = Buffer.from(`${TEST_KEY_ID}:${TEST_KEY_SECRET}`).toString('base64');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          'Authorization': `Basic ${expectedAuth}`,
        }),
      })
    );
  });

  test('refund sends correct amount in paise', async () => {
    // Given
    const paymentId = 'pay_ABC123XYZ789';
    const amountPaise = 25000; // 250.00 INR

    const mockRefundResponse = {
      id: 'rfnd_XYZ123ABC456',
      entity: 'refund',
      amount: 25000,
      currency: 'INR',
      payment_id: paymentId,
      status: 'processed',
      created_at: 1672531200,
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRefundResponse,
    });

    // When
    const result = await client.refund(paymentId, amountPaise);

    // Then
    expect(global.fetch).toHaveBeenCalledWith(
      `https://api.razorpay.com/v1/payments/${paymentId}/refund`,
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ amount: amountPaise }),
      })
    );
    expect(result.amount).toBe(25000);
    expect(result.payment_id).toBe(paymentId);
  });

  test('refund throws error on API failure', async () => {
    // Given
    const paymentId = 'pay_ABC123';
    const amountPaise = 10000;

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => 'Payment already refunded',
    });

    // When & Then
    await expect(client.refund(paymentId, amountPaise)).rejects.toThrow(
      'Razorpay refund failed: 400 Payment already refunded'
    );
  });

  test('createOrder throws error on API failure', async () => {
    // Given
    const orderOptions = {
      amount: 50000,
      currency: 'INR',
      receipt: 'receipt_123',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => 'Authentication failed',
    });

    // When & Then
    await expect(client.createOrder(orderOptions)).rejects.toThrow(
      'Razorpay order creation failed: 401 Authentication failed'
    );
  });

  test('publicKeyId returns the correct key ID', () => {
    // When
    const keyId = client.publicKeyId;

    // Then
    expect(keyId).toBe(TEST_KEY_ID);
  });
});
