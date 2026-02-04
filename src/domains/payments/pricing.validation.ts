/**
 * Pricing validation schemas.
 *
 * Story 4.4: Dynamic Pricing by Property Value Slabs
 */
import { z } from 'zod';
import { positiveBigIntStringSchema } from '../../core/validation/bigint-string.js';

export const calculatePricingSchema = z.object({
  serviceId: z.string().min(1),
  propertyValuePaise: positiveBigIntStringSchema,
  cityId: z.string().min(1),
});

export const getSlabsQuerySchema = z.object({
  serviceId: z.string().min(1),
  cityId: z.string().min(1),
});

export type CalculatePricingInput = z.infer<typeof calculatePricingSchema>;
export type GetSlabsQuery = z.infer<typeof getSlabsQuerySchema>;
