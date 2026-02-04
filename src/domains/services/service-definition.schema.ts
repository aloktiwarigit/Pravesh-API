// property-legal-agent-api/src/domains/services/service-definition.schema.ts
// Story 5-1: Zod validation schemas for service definitions

import { z } from 'zod';

export const governmentOfficeSchema = z.object({
  officeName: z.string().min(1),
  department: z.string().optional(),
  address: z.string().optional(),
});

export const requiredDocumentSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  isMandatory: z.boolean(),
  source: z.enum(['customer', 'government', 'agent']),
});

export const serviceStepSchema = z.object({
  index: z.number().int().min(0),
  name: z.string().min(1),
  description: z.string(),
  estimatedDays: z.number().int().min(0),
  governmentOffice: governmentOfficeSchema.optional(),
  requiredDocuments: z.array(requiredDocumentSchema).optional(),
  outputDocuments: z.array(requiredDocumentSchema).optional(),
  agentActions: z.array(z.string()).optional(),
  customerActions: z.array(z.string()).optional(),
});

export const estimatedFeesSchema = z.object({
  serviceFeeBasePaise: z.number().int().min(0),
  govtFeeEstimatePaise: z.number().int().min(0),
  totalEstimatePaise: z.number().int().min(0),
  stampDutyPercent: z.number().optional(),
  registrationPercent: z.number().optional(),
});

export const serviceDefinitionJsonSchema = z.object({
  serviceCode: z.string().min(1),
  serviceName: z.string().min(1),
  category: z.string().min(1),
  subcategory: z.string().optional(),
  description: z.string(),
  steps: z.array(serviceStepSchema).min(1),
  requiredDocuments: z.array(requiredDocumentSchema),
  estimatedFees: estimatedFeesSchema,
  governmentOffices: z.array(governmentOfficeSchema),
  estimatedDaysTotal: z.number().int().min(1),
  slaBusinessDays: z.number().int().min(1),
  prerequisites: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
});

export const createServiceDefinitionSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  category: z.enum([
    'pre_purchase',
    'purchase',
    'post_purchase',
    'inheritance',
    'construction',
    'utility',
    'specialized',
  ]),
  definition: serviceDefinitionJsonSchema,
  isActive: z.boolean().optional().default(true),
});
