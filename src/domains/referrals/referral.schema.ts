/**
 * Referral validation schemas.
 *
 * Story 4.11: Customer Referral Credits - Earn
 */
import { z } from 'zod';

export const referralCreditsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const referralCreditsResponseSchema = z.object({
  balancePaise: z.string(),
  credits: z.array(z.object({
    id: z.string(),
    referredCustomerName: z.string(),
    creditAmountPaise: z.string(),
    creditedAt: z.string().datetime(),
    serviceRequestId: z.string(),
  })),
  pagination: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
  }),
});

export type ReferralCreditsQuery = z.infer<typeof referralCreditsQuerySchema>;
export type ReferralCreditsResponse = z.infer<typeof referralCreditsResponseSchema>;
