import { z } from 'zod';

export const assignAgentPayloadSchema = z.object({
  serviceRequestId: z.string().optional(),
});

export const notifyAgentAssignmentPayloadSchema = z.object({
  serviceRequestId: z.string(),
  agentId: z.string(),
  customerName: z.string().min(1),
  serviceName: z.string().min(1),
  propertyAddress: z.string().min(1),
});

export const opsAlertPayloadSchema = z.object({
  type: z.literal('no_agent_available'),
  serviceRequestId: z.string(),
  cityId: z.string(),
  reason: z.string().min(1),
});

export type AssignAgentPayload = z.infer<typeof assignAgentPayloadSchema>;
export type NotifyAgentAssignmentPayload = z.infer<
  typeof notifyAgentAssignmentPayloadSchema
>;
export type OpsAlertPayload = z.infer<typeof opsAlertPayloadSchema>;
