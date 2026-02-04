/**
 * Credit application validation schemas.
 *
 * Story 4.12: Customer Referral Credits - Apply to Payment
 */
import { z } from 'zod';

export const applyCreditRequestSchema = z.object({
  serviceRequestId: z.string().min(1),
  applyCredits: z.boolean(),
});

export const paymentBreakdownResponseSchema = z.object({
  serviceFeePaise: z.string(),
  govtFeePaise: z.string(),
  creditsAppliedPaise: z.string(),
  razorpayChargePaise: z.string(),
  totalPaise: z.string(),
  creditBalancePaise: z.string(),
  creditBalanceAfterPaise: z.string(),
});

export type ApplyCreditRequest = z.infer<typeof applyCreditRequestSchema>;
export type PaymentBreakdownResponse = z.infer<typeof paymentBreakdownResponseSchema>;
