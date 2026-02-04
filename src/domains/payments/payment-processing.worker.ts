/**
 * Payment processing worker for pg-boss retry queue.
 *
 * Story 4.15: Payment Processing Retry & Failure Handling
 */
import { PrismaClient } from '@prisma/client';
import { RazorpayClient } from '../../core/integrations/razorpay.client.js';
import {
  PAYMENT_PROCESSING_QUEUE,
  PaymentProcessingJobData,
} from './payment-processing.job.js';

export async function registerPaymentProcessingWorker(
  boss: any,
  prisma: PrismaClient,
  razorpay: RazorpayClient,
): Promise<void> {
  await boss.work(
    PAYMENT_PROCESSING_QUEUE,
    { teamSize: 5, teamConcurrency: 2 },
    async (job: any) => {
      const { data } = job;
      const attemptNumber = (job.retrycount ?? 0) + 1;

      try {
        // AC8: Check if payment already captured (idempotent)
        const existingPayment = await prisma.payment.findUnique({
          where: { id: data.paymentId },
        });

        if (existingPayment?.status === 'paid') {
          return; // Already captured, skip
        }

        // Verify payment with Razorpay
        const razorpayPayment = await razorpay.fetchPayment(data.razorpayPaymentId);

        if (razorpayPayment.status === 'captured') {
          await handlePaymentSuccess(prisma, data, attemptNumber);
          return;
        }

        if (razorpayPayment.status === 'failed') {
          await handleFinalFailure(prisma, data, 'Payment failed at Razorpay');
          return;
        }

        // Payment still pending — throw to trigger retry
        throw new Error(`Payment status: ${razorpayPayment.status}, awaiting capture`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // AC2: Log retry attempt
        await logRetryAttempt(prisma, data, attemptNumber, errorMessage);

        // Check if this is the last attempt
        if (attemptNumber >= 3) {
          await handleFinalFailure(prisma, data, errorMessage);
          return; // Don't throw — job is considered handled
        }

        // Re-throw to trigger pg-boss retry
        throw error;
      }
    },
  );
}

async function handlePaymentSuccess(
  prisma: PrismaClient,
  data: PaymentProcessingJobData,
  attemptNumber: number,
): Promise<void> {
  await prisma.payment.update({
    where: { id: data.paymentId },
    data: { status: 'paid', paidAt: new Date() },
  });

  // TODO: paymentStateChange model does not exist in schema yet.
  // State change logging is stubbed until the model is added.

  // TODO: serviceRequest model does not exist in schema.
  // Use serviceInstance if applicable, or add model later.
}

async function handleFinalFailure(
  prisma: PrismaClient,
  data: PaymentProcessingJobData,
  errorMessage: string,
): Promise<void> {
  // AC3: Set payment status to failed
  await prisma.payment.update({
    where: { id: data.paymentId },
    data: { status: 'failed' },
  });

  // TODO: paymentStateChange model does not exist in schema yet.
  // State change logging is stubbed until the model is added.

  // AC5: Flag for ops review via OpsReviewTask
  await prisma.opsReviewTask.create({
    data: {
      type: 'payment_failed',
      resourceId: data.paymentId,
      resourceType: 'payment',
      status: 'pending',
      metadata: { error: errorMessage, retries: 3 },
      cityId: data.tenantId, // tenantId maps to cityId in schema
    },
  });
}

async function logRetryAttempt(
  prisma: PrismaClient,
  data: PaymentProcessingJobData,
  attemptNumber: number,
  errorMessage: string,
): Promise<void> {
  // TODO: PaymentRetryLog model does not exist in schema yet.
  // Retry logging is stubbed until the model is added.
  const _backoffSeconds = Math.pow(2, attemptNumber); // 2, 4, 8
  const _nextRetryAt = attemptNumber < 3
    ? new Date(Date.now() + _backoffSeconds * 1000)
    : null;

  // Log to PaymentAuditLog as a fallback
  await prisma.paymentAuditLog.create({
    data: {
      paymentId: data.paymentId,
      action: 'retry_attempt',
      performedBy: 'system',
      details: JSON.stringify({
        attemptNumber,
        errorMessage,
        nextRetryAt: _nextRetryAt,
      }),
    },
  });
}
