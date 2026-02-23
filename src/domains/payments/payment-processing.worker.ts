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
import { PaymentStateChangeService } from './payment-state-change.service.js';

export async function registerPaymentProcessingWorker(
  boss: any,
  prisma: PrismaClient,
  razorpay: RazorpayClient,
): Promise<void> {
  const stateChangeService = new PaymentStateChangeService(prisma);

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
          await handlePaymentSuccess(prisma, stateChangeService, data, attemptNumber);
          return;
        }

        if (razorpayPayment.status === 'failed') {
          await handleFinalFailure(prisma, stateChangeService, data, 'Payment failed at Razorpay');
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
          await handleFinalFailure(prisma, stateChangeService, data, errorMessage);
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
  _stateChangeService: PaymentStateChangeService,
  data: PaymentProcessingJobData,
  attemptNumber: number,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: data.paymentId },
      data: { status: 'paid', paidAt: new Date() },
    });

    // Log state change
    await tx.paymentStateChange.create({
      data: {
        paymentId: data.paymentId,
        oldState: 'pending',
        newState: 'paid',
        changedBy: 'system:payment-worker',
        metadata: JSON.parse(JSON.stringify({ attemptNumber })),
      },
    });

    // Update corresponding service request payment status
    await tx.serviceRequest.updateMany({
      where: { id: data.serviceRequestId },
      data: { paymentStatus: 'verified' },
    });
  });
}

async function handleFinalFailure(
  prisma: PrismaClient,
  _stateChangeService: PaymentStateChangeService,
  data: PaymentProcessingJobData,
  errorMessage: string,
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    // AC3: Set payment status to failed
    await tx.payment.update({
      where: { id: data.paymentId },
      data: { status: 'failed' },
    });

    // Log state change
    await tx.paymentStateChange.create({
      data: {
        paymentId: data.paymentId,
        oldState: 'pending',
        newState: 'failed',
        changedBy: 'system:payment-worker',
        metadata: JSON.parse(JSON.stringify({ errorMessage, retries: 3 })),
      },
    });

    // AC5: Flag for ops review via OpsReviewTask
    await tx.opsReviewTask.create({
      data: {
        type: 'payment_failed',
        resourceId: data.paymentId,
        resourceType: 'payment',
        status: 'pending',
        metadata: JSON.parse(JSON.stringify({ error: errorMessage, retries: 3 })),
        cityId: data.tenantId, // tenantId maps to cityId in schema
      },
    });
  });
}

async function logRetryAttempt(
  prisma: PrismaClient,
  data: PaymentProcessingJobData,
  attemptNumber: number,
  errorMessage: string,
): Promise<void> {
  const backoffSeconds = Math.pow(2, attemptNumber); // 2, 4, 8
  const nextRetryAt = attemptNumber < 3
    ? new Date(Date.now() + backoffSeconds * 1000)
    : null;

  // Log to PaymentAuditLog for retry tracking
  await prisma.paymentAuditLog.create({
    data: {
      paymentId: data.paymentId,
      action: 'retry_attempt',
      performedBy: 'system',
      details: JSON.stringify({
        attemptNumber,
        errorMessage,
        nextRetryAt,
      }),
    },
  });
}
