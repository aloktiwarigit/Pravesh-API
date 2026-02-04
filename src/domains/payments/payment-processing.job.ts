/**
 * Payment processing job definition for pg-boss queue.
 *
 * Story 4.15: Payment Processing Retry & Failure Handling
 */

export const PAYMENT_PROCESSING_QUEUE = 'payment-processing';

export interface PaymentProcessingJobData {
  paymentId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amountPaise: string;
  customerId: string;
  serviceRequestId: string;
  tenantId: string;
}

/**
 * Enqueues a payment processing job with pg-boss retry configuration.
 * pg-boss handles exponential backoff: 2s, 4s, 8s (retryDelay: 2, retryBackoff: true).
 */
export async function enqueuePaymentProcessing(
  boss: { send: Function },
  data: PaymentProcessingJobData,
): Promise<string | null> {
  const jobId = await boss.send(PAYMENT_PROCESSING_QUEUE, data, {
    retryLimit: 3,
    retryDelay: 2,
    retryBackoff: true,
    singletonKey: data.razorpayOrderId, // Idempotency via order_id
    expireInSeconds: 300, // 5 minute timeout per attempt
  });

  return jobId;
}
