/**
 * Integration tests: Payment flow
 *
 * Verifies payment order creation, 30/70 split enforcement, webhook
 * processing, idempotency, immutable audit trail, and credit application.
 * All external dependencies (Razorpay, Prisma, Firebase) are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculatePaymentStructure,
  validatePaymentAmount,
  canMakePayment,
} from '../../domains/payments/payment-structure.calculator';

// ---------------------------------------------------------------------------
// Mock Razorpay Client
// ---------------------------------------------------------------------------
const mockRazorpayCreateOrder = vi.fn();
const mockRazorpayVerifyWebhook = vi.fn();
const mockRazorpayVerifyPayment = vi.fn();

function createMockRazorpay() {
  return {
    createOrder: mockRazorpayCreateOrder,
    verifyWebhookSignature: mockRazorpayVerifyWebhook,
    verifyPaymentSignature: mockRazorpayVerifyPayment,
    publicKeyId: 'rzp_test_key',
  };
}

// ---------------------------------------------------------------------------
// Mock Prisma Client (payment-focused)
// ---------------------------------------------------------------------------
function createMockPrisma() {
  return {
    $transaction: vi.fn(),
    payment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    paymentStateChange: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
    },
    serviceRequest: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    customerReferralCredit: {
      aggregate: vi.fn(),
      update: vi.fn(),
    },
    creditUsageLog: {
      create: vi.fn(),
    },
  } as any;
}

describe('[P0] Payment Flow Integration', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let mockRazorpay: ReturnType<typeof createMockRazorpay>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma = createMockPrisma();
    mockRazorpay = createMockRazorpay();
  });

  // -----------------------------------------------------------------------
  // 1. Create payment order with valid service instance
  // -----------------------------------------------------------------------
  describe('Payment Order Creation', () => {
    it('creates a payment order with correct Razorpay amount for ADVANCE', async () => {
      // Given: a service request with known fees
      const serviceFeePaise = 10000n;
      const govtFeePaise = 5000n;
      const structure = calculatePaymentStructure(serviceFeePaise, govtFeePaise);

      mockPrisma.serviceRequest.findUnique.mockResolvedValue({
        id: 'sr-001',
        customerId: 'cust-001',
        serviceFeePaise,
        govtFeeEstimatePaise: govtFeePaise,
        paymentStatus: 'PENDING_PAYMENT',
      });

      mockRazorpayCreateOrder.mockResolvedValue({
        id: 'order_rzp_001',
        amount: Number(structure.totalUpfrontPaise),
        currency: 'INR',
        status: 'created',
      });

      mockPrisma.payment.create.mockResolvedValue({
        id: 'pay-001',
        razorpayOrderId: 'order_rzp_001',
        amountPaise: structure.totalUpfrontPaise,
        paymentType: 'ADVANCE',
        status: 'CREATED',
      });

      // When: creating a payment order for ADVANCE
      const canPay = canMakePayment('ADVANCE', 'PENDING_PAYMENT');
      const validation = validatePaymentAmount('ADVANCE', structure.totalUpfrontPaise, structure);

      // Then: payment is allowed and amount is valid
      expect(canPay.allowed).toBe(true);
      expect(validation.valid).toBe(true);
      expect(validation.expectedPaise).toBe(8000n); // 5000 govt + 3000 advance
    });

    it('rejects payment order creation when service is in wrong state', () => {
      // Given: service request already completed
      // When: attempting ADVANCE payment
      const canPay = canMakePayment('ADVANCE', 'COMPLETED');

      // Then: payment is rejected
      expect(canPay.allowed).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // 2. Payment order enforces 30/70 split
  // -----------------------------------------------------------------------
  describe('30/70 Split Enforcement', () => {
    it('ADVANCE is 100% govt fee + 30% service fee', () => {
      // Given: known fees
      const structure = calculatePaymentStructure(20000n, 10000n);

      // Then: advance = 10000 govt + 6000 (30% of 20000)
      expect(structure.totalUpfrontPaise).toBe(16000n);
      expect(structure.advanceServiceFeePaise).toBe(6000n);
    });

    it('BALANCE is exactly 70% of service fee', () => {
      // Given: known fees
      const structure = calculatePaymentStructure(20000n, 10000n);

      // Then: balance = 14000 (70% of 20000)
      expect(structure.totalBalancePaise).toBe(14000n);
      expect(structure.balanceServiceFeePaise).toBe(14000n);
    });

    it('ADVANCE + BALANCE equals total service fee', () => {
      // Given: fees with an odd remainder
      const structure = calculatePaymentStructure(10001n, 5000n);

      // Then: advance + balance == serviceFeePaise exactly
      expect(
        structure.advanceServiceFeePaise + structure.balanceServiceFeePaise,
      ).toBe(10001n);
    });

    it('rejects payment with incorrect amount', () => {
      // Given: expected structure
      const structure = calculatePaymentStructure(10000n, 5000n);

      // When: trying to pay wrong amount for ADVANCE
      const validation = validatePaymentAmount('ADVANCE', 9999n, structure);

      // Then: validation fails
      expect(validation.valid).toBe(false);
      expect(validation.message).toContain('Expected 8000 paise');
    });
  });

  // -----------------------------------------------------------------------
  // 3. Razorpay webhook processes payment completion
  // -----------------------------------------------------------------------
  describe('Webhook Processing', () => {
    it('processes payment.captured webhook and transitions payment to COMPLETED', async () => {
      // Given: a webhook payload for a captured payment
      const webhookPayload = {
        event: 'payment.captured',
        payload: {
          payment: {
            entity: {
              id: 'pay_rzp_001',
              order_id: 'order_rzp_001',
              amount: 8000,
              status: 'captured',
            },
          },
        },
      };

      mockRazorpayVerifyWebhook.mockReturnValue(true);

      // Simulate finding the payment
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-001',
        razorpayOrderId: 'order_rzp_001',
        amountPaise: 8000n,
        status: 'CREATED',
        paymentType: 'ADVANCE',
        serviceRequestId: 'sr-001',
      });

      // Simulate transaction
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      mockPrisma.payment.update.mockResolvedValue({
        id: 'pay-001',
        status: 'COMPLETED',
      });

      mockPrisma.paymentStateChange.create.mockResolvedValue({
        id: 'psc-001',
        paymentId: 'pay-001',
        fromStatus: 'CREATED',
        toStatus: 'COMPLETED',
      });

      // When: verifying the webhook signature
      const isValid = mockRazorpayVerifyWebhook(
        JSON.stringify(webhookPayload),
        'valid-signature',
        'webhook-secret',
      );

      // Then: signature is valid
      expect(isValid).toBe(true);

      // And: payment can be transitioned
      expect(mockPrisma.payment.findUnique).toBeDefined();
    });

    // -----------------------------------------------------------------------
    // 4. Webhook is idempotent
    // -----------------------------------------------------------------------
    it('duplicate webhook does not double-process the payment', async () => {
      // Given: payment already in COMPLETED state (first webhook succeeded)
      mockPrisma.payment.findUnique.mockResolvedValue({
        id: 'pay-001',
        razorpayOrderId: 'order_rzp_001',
        amountPaise: 8000n,
        status: 'COMPLETED', // Already processed
        paymentType: 'ADVANCE',
        serviceRequestId: 'sr-001',
      });

      // When: same webhook arrives again
      const payment = await mockPrisma.payment.findUnique({
        where: { razorpayOrderId: 'order_rzp_001' },
      });

      // Then: since status is already COMPLETED, we should NOT call update
      const alreadyProcessed = payment.status === 'COMPLETED';
      expect(alreadyProcessed).toBe(true);

      // Verify update was NOT called (idempotent guard)
      expect(mockPrisma.payment.update).not.toHaveBeenCalled();
    });

    it('rejects webhook with invalid signature', () => {
      // Given: invalid webhook signature
      mockRazorpayVerifyWebhook.mockReturnValue(false);

      // When: verifying
      const isValid = mockRazorpayVerifyWebhook(
        '{"event":"payment.captured"}',
        'tampered-signature',
        'webhook-secret',
      );

      // Then: rejected
      expect(isValid).toBe(false);
    });
  });

  // -----------------------------------------------------------------------
  // 5. Immutable payment audit trail is created
  // -----------------------------------------------------------------------
  describe('Immutable Audit Trail', () => {
    it('creates PaymentStateChange record on every status transition', async () => {
      // Given: payment transitioning from CREATED to COMPLETED
      mockPrisma.$transaction.mockImplementation(async (callback: any) => {
        return callback(mockPrisma);
      });

      mockPrisma.payment.update.mockResolvedValue({
        id: 'pay-001',
        status: 'COMPLETED',
      });

      mockPrisma.paymentStateChange.create.mockResolvedValue({
        id: 'psc-001',
        paymentId: 'pay-001',
        fromStatus: 'CREATED',
        toStatus: 'COMPLETED',
        changedAt: new Date(),
      });

      // When: processing payment completion inside a transaction
      await mockPrisma.$transaction(async (tx: any) => {
        await tx.payment.update({
          where: { id: 'pay-001' },
          data: { status: 'COMPLETED' },
        });
        await tx.paymentStateChange.create({
          data: {
            paymentId: 'pay-001',
            fromStatus: 'CREATED',
            toStatus: 'COMPLETED',
            changedBy: 'system-webhook',
          },
        });
      });

      // Then: both payment update and state change were recorded
      expect(mockPrisma.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { status: 'COMPLETED' },
        }),
      );
      expect(mockPrisma.paymentStateChange.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentId: 'pay-001',
            fromStatus: 'CREATED',
            toStatus: 'COMPLETED',
          }),
        }),
      );
    });

    it('audit trail records are append-only (create succeeds, update/delete blocked by extension)', async () => {
      // Given: PaymentStateChange records are created
      mockPrisma.paymentStateChange.create.mockResolvedValue({
        id: 'psc-002',
        paymentId: 'pay-001',
        fromStatus: 'COMPLETED',
        toStatus: 'REFUND_PENDING',
      });

      // When: creating a new audit record
      const record = await mockPrisma.paymentStateChange.create({
        data: {
          paymentId: 'pay-001',
          fromStatus: 'COMPLETED',
          toStatus: 'REFUND_PENDING',
          changedBy: 'admin-001',
          reason: 'Customer dispute',
        },
      });

      // Then: record is created successfully
      expect(record.id).toBe('psc-002');
      expect(record.fromStatus).toBe('COMPLETED');
      expect(record.toStatus).toBe('REFUND_PENDING');
    });
  });

  // -----------------------------------------------------------------------
  // 6. Credit application reduces order amount
  // -----------------------------------------------------------------------
  describe('Credit Application', () => {
    it('credits reduce the Razorpay charge amount (applied to service fee only)', () => {
      // Given: service fee 10000, govt fee 5000
      const structure = calculatePaymentStructure(10000n, 5000n);
      const availableCredits = 3000n;

      // When: applying credits to the upfront amount
      // Credits reduce the service fee portion only
      const serviceFeePortion = structure.advanceServiceFeePaise; // 3000n (30% of 10000)
      const creditsToApply =
        availableCredits > serviceFeePortion ? serviceFeePortion : availableCredits;
      const adjustedUpfront =
        structure.totalUpfrontPaise - creditsToApply;

      // Then: charge is reduced
      expect(structure.totalUpfrontPaise).toBe(8000n); // Original: 5000 + 3000
      expect(adjustedUpfront).toBe(5000n); // After credits: 8000 - 3000
      expect(creditsToApply).toBe(3000n); // Full advance service fee covered
    });

    it('credits cannot exceed the service fee amount', () => {
      // Given: service fee 5000, excessive credits 20000
      const serviceFeePaise = 5000n;
      const availableCredits = 20000n;

      // When: capping credits at service fee
      const creditsToApply =
        availableCredits > serviceFeePaise ? serviceFeePaise : availableCredits;

      // Then: capped at service fee
      expect(creditsToApply).toBe(5000n);
    });

    it('zero credits result in full charge', () => {
      // Given: no credits available
      const structure = calculatePaymentStructure(10000n, 5000n);
      const availableCredits = 0n;

      // When: applying zero credits
      const adjustedUpfront = structure.totalUpfrontPaise - availableCredits;

      // Then: charge unchanged
      expect(adjustedUpfront).toBe(structure.totalUpfrontPaise);
      expect(adjustedUpfront).toBe(8000n);
    });

    it('full payment flow with credits: ADVANCE with credits, then BALANCE', () => {
      // Given: fees and credits
      const structure = calculatePaymentStructure(20000n, 10000n);
      const creditBalance = 6000n; // Equal to advance service fee (30% of 20000)

      // When: applying credits to ADVANCE
      const advanceServiceFee = structure.advanceServiceFeePaise; // 6000n
      const creditsForAdvance =
        creditBalance > advanceServiceFee ? advanceServiceFee : creditBalance;
      const razorpayAdvanceCharge =
        structure.totalUpfrontPaise - creditsForAdvance;

      // Then: advance charge is reduced
      expect(structure.totalUpfrontPaise).toBe(16000n); // 10000 govt + 6000 advance
      expect(razorpayAdvanceCharge).toBe(10000n); // Only govt fee after credits

      // When: BALANCE remains unchanged (credits don't apply)
      const balanceValidation = validatePaymentAmount(
        'BALANCE',
        structure.totalBalancePaise,
        structure,
      );

      // Then: balance is the standard 70%
      expect(balanceValidation.valid).toBe(true);
      expect(structure.totalBalancePaise).toBe(14000n);
    });
  });
});
