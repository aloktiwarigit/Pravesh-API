import { z } from 'zod';

export const upsertCommissionConfigSchema = z.object({
  role: z.enum(['agent', 'dealer']),
  serviceDefinitionId: z.string().uuid(),
  commissionAmountPaise: z.number().int().positive(),
});

export type UpsertCommissionConfigInput = z.infer<typeof upsertCommissionConfigSchema>;
