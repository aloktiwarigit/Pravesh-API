/**
 * Fee variance validation schemas.
 *
 * Story 4.6: Fee Variance Handling
 */
import { z } from 'zod';
import { positiveBigIntStringSchema, bigIntStringSchema } from '../../core/validation/bigint-string.js';

export const reportFeeVarianceSchema = z.object({
  serviceRequestId: z.string().min(1),
  estimatedGovtFeePaise: positiveBigIntStringSchema,
  actualGovtFeePaise: positiveBigIntStringSchema,
  varianceReasonEn: z.string().min(10).max(500),
  varianceReasonHi: z.string().min(5).max(500),
  evidenceUrls: z.array(z.string().url()).optional(),
});

export const resolveFeeVarianceSchema = z.object({
  varianceId: z.string().min(1),
  resolution: z.enum(['APPROVED', 'REJECTED', 'ADJUSTED']),
  adjustedAmountPaise: bigIntStringSchema.optional(),
  resolutionNotes: z.string().min(1).max(500),
});

export type ReportFeeVarianceInput = z.infer<typeof reportFeeVarianceSchema>;
export type ResolveFeeVarianceInput = z.infer<typeof resolveFeeVarianceSchema>;
