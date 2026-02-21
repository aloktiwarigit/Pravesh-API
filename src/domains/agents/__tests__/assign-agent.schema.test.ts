/**
 * Tests for agent-related Zod validation schemas.
 * Covers: assignAgentPayloadSchema, notifyAgentAssignmentPayloadSchema, opsAlertPayloadSchema
 */
import { describe, test, expect } from 'vitest';
import {
  assignAgentPayloadSchema,
  notifyAgentAssignmentPayloadSchema,
  opsAlertPayloadSchema,
} from '../assign-agent.schema';

describe('Agent Schemas', () => {
  // ============================================================
  // assignAgentPayloadSchema
  // ============================================================

  describe('assignAgentPayloadSchema', () => {
    test('accepts empty object (serviceRequestId is optional)', () => {
      const result = assignAgentPayloadSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    test('accepts with serviceRequestId', () => {
      const result = assignAgentPayloadSchema.safeParse({
        serviceRequestId: 'some-request-id',
      });
      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // notifyAgentAssignmentPayloadSchema
  // ============================================================

  describe('notifyAgentAssignmentPayloadSchema', () => {
    const validPayload = {
      serviceRequestId: 'sr-001',
      agentId: 'agent-001',
      customerName: 'Priya Singh',
      serviceName: 'Property Title Check',
      propertyAddress: '123 MG Road, Lucknow',
    };

    test('accepts valid notification payload', () => {
      const result = notifyAgentAssignmentPayloadSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
    });

    test('rejects empty customerName', () => {
      const result = notifyAgentAssignmentPayloadSchema.safeParse({
        ...validPayload,
        customerName: '',
      });
      expect(result.success).toBe(false);
    });

    test('rejects empty serviceName', () => {
      const result = notifyAgentAssignmentPayloadSchema.safeParse({
        ...validPayload,
        serviceName: '',
      });
      expect(result.success).toBe(false);
    });

    test('rejects empty propertyAddress', () => {
      const result = notifyAgentAssignmentPayloadSchema.safeParse({
        ...validPayload,
        propertyAddress: '',
      });
      expect(result.success).toBe(false);
    });

    test('rejects missing required fields', () => {
      const result = notifyAgentAssignmentPayloadSchema.safeParse({
        serviceRequestId: 'sr-001',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // opsAlertPayloadSchema
  // ============================================================

  describe('opsAlertPayloadSchema', () => {
    test('accepts valid ops alert', () => {
      const result = opsAlertPayloadSchema.safeParse({
        type: 'no_agent_available',
        serviceRequestId: 'sr-001',
        cityId: 'city-001',
        reason: 'All agents offline',
      });
      expect(result.success).toBe(true);
    });

    test('rejects invalid type (only no_agent_available allowed)', () => {
      const result = opsAlertPayloadSchema.safeParse({
        type: 'agent_late',
        serviceRequestId: 'sr-001',
        cityId: 'city-001',
        reason: 'Agent late',
      });
      expect(result.success).toBe(false);
    });

    test('rejects empty reason', () => {
      const result = opsAlertPayloadSchema.safeParse({
        type: 'no_agent_available',
        serviceRequestId: 'sr-001',
        cityId: 'city-001',
        reason: '',
      });
      expect(result.success).toBe(false);
    });

    test('rejects missing cityId', () => {
      const result = opsAlertPayloadSchema.safeParse({
        type: 'no_agent_available',
        serviceRequestId: 'sr-001',
        reason: 'No agents',
      });
      expect(result.success).toBe(false);
    });
  });
});
