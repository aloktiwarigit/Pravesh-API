import { describe, test, expect, vi, beforeEach } from 'vitest';
import { WorkflowEngine } from '../workflow-engine';
import type { ServiceDefinitionJson } from '../service-definition.types';

// Mock Prisma Client
const mockPrismaTransaction = vi.fn();
const mockServiceInstanceFindUnique = vi.fn();
const mockServiceInstanceUpdateMany = vi.fn();
const mockServiceStateHistoryCreate = vi.fn();
const mockServiceInstanceFindMany = vi.fn();
const mockServiceStateHistoryFindMany = vi.fn();

const mockPrisma = {
  $transaction: mockPrismaTransaction,
  serviceInstance: {
    findUnique: mockServiceInstanceFindUnique,
    updateMany: mockServiceInstanceUpdateMany,
    findMany: mockServiceInstanceFindMany,
  },
  serviceStateHistory: {
    create: mockServiceStateHistoryCreate,
    findMany: mockServiceStateHistoryFindMany,
  },
} as any;

describe('[P0] Workflow Engine - State Machine', () => {
  let engine: WorkflowEngine;
  let basicDefinition: ServiceDefinitionJson;
  let multiStepDefinition: ServiceDefinitionJson;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new WorkflowEngine(mockPrisma);

    // Basic definition with no steps
    basicDefinition = {
      serviceCode: 'BASIC_001',
      serviceName: 'Basic Service',
      category: 'Property',
      description: 'Simple service',
      steps: [],
      requiredDocuments: [],
      estimatedFees: {
        serviceFeeBasePaise: 10000,
        govtFeeEstimatePaise: 5000,
        totalEstimatePaise: 15000,
      },
      governmentOffices: [],
      estimatedDaysTotal: 7,
      slaBusinessDays: 10,
    };

    // Multi-step definition
    multiStepDefinition = {
      ...basicDefinition,
      serviceCode: 'MULTI_001',
      steps: [
        {
          index: 0,
          name: 'Document Verification',
          description: 'Verify all documents',
          estimatedDays: 2,
        },
        {
          index: 1,
          name: 'Government Submission',
          description: 'Submit to govt office',
          estimatedDays: 3,
        },
        {
          index: 2,
          name: 'Final Processing',
          description: 'Complete processing',
          estimatedDays: 2,
        },
      ],
    };
  });

  describe('[P0] State List Generation', () => {
    test('buildStateList generates correct states for service with no steps', () => {
      // Given: Service definition with no steps
      // When: Build state list
      const states = engine.buildStateList(basicDefinition);

      // Then: Only system states in order
      expect(states).toEqual([
        'requested',
        'assigned',
        'payment_pending',
        'paid',
        'in_progress',
        'completed',
        'delivered',
      ]);
    });

    test('buildStateList inserts step states between in_progress and completed', () => {
      // Given: Service with 3 steps
      // When: Build state list
      const states = engine.buildStateList(multiStepDefinition);

      // Then: Steps inserted in correct position
      expect(states).toEqual([
        'requested',
        'assigned',
        'payment_pending',
        'paid',
        'in_progress',
        'step_1',
        'step_2',
        'step_3',
        'completed',
        'delivered',
      ]);
    });

    test('buildStateList handles single step correctly', () => {
      // Given: Service with 1 step
      const singleStepDef = {
        ...basicDefinition,
        steps: [
          {
            index: 0,
            name: 'Only Step',
            description: 'Single step',
            estimatedDays: 5,
          },
        ],
      };

      // When: Build state list
      const states = engine.buildStateList(singleStepDef);

      // Then: One step state
      expect(states).toEqual([
        'requested',
        'assigned',
        'payment_pending',
        'paid',
        'in_progress',
        'step_1',
        'completed',
        'delivered',
      ]);
    });

    test('buildStateList handles many steps', () => {
      // Given: Service with 10 steps
      const manyStepDef = {
        ...basicDefinition,
        steps: Array.from({ length: 10 }, (_, i) => ({
          index: i,
          name: `Step ${i + 1}`,
          description: `Description ${i + 1}`,
          estimatedDays: 1,
        })),
      };

      // When: Build state list
      const states = engine.buildStateList(manyStepDef);

      // Then: All 10 step states present
      expect(states).toContain('step_1');
      expect(states).toContain('step_5');
      expect(states).toContain('step_10');
      expect(states.filter((s) => s.startsWith('step_'))).toHaveLength(10);
    });
  });

  describe('[P0] Valid Transitions', () => {
    test('getValidTransitions returns correct transitions for system states', () => {
      // Given: Various system states
      // When/Then: Check each state's valid transitions

      // requested can go to assigned or cancelled
      expect(engine.getValidTransitions('requested', basicDefinition)).toEqual([
        'assigned',
        'cancelled',
      ]);

      // assigned can go to payment_pending or cancelled
      expect(engine.getValidTransitions('assigned', basicDefinition)).toEqual([
        'payment_pending',
        'cancelled',
      ]);

      // payment_pending can go to paid, halted, or cancelled
      expect(
        engine.getValidTransitions('payment_pending', basicDefinition)
      ).toEqual(['paid', 'halted', 'cancelled']);

      // paid can go to in_progress or halted
      expect(engine.getValidTransitions('paid', basicDefinition)).toEqual([
        'in_progress',
        'halted',
      ]);
    });

    test('in_progress transitions to completed when no steps exist', () => {
      // Given: Service with no steps
      // When: Get transitions from in_progress
      const transitions = engine.getValidTransitions(
        'in_progress',
        basicDefinition
      );

      // Then: Can transition to completed or halted
      expect(transitions).toEqual(['completed', 'halted']);
    });

    test('in_progress transitions to step_1 when steps exist', () => {
      // Given: Service with steps
      // When: Get transitions from in_progress
      const transitions = engine.getValidTransitions(
        'in_progress',
        multiStepDefinition
      );

      // Then: Can transition to step_1 or halted
      expect(transitions).toEqual(['step_1', 'halted']);
    });

    test('step states chain correctly (step_1 → step_2 → ... → completed)', () => {
      // Given: Service with 3 steps
      // When/Then: Check step chaining

      // step_1 → step_2
      expect(engine.getValidTransitions('step_1', multiStepDefinition)).toEqual([
        'step_2',
        'halted',
      ]);

      // step_2 → step_3
      expect(engine.getValidTransitions('step_2', multiStepDefinition)).toEqual([
        'step_3',
        'halted',
      ]);

      // step_3 (last) → completed
      expect(engine.getValidTransitions('step_3', multiStepDefinition)).toEqual([
        'completed',
        'halted',
      ]);
    });

    test('all step states can be halted', () => {
      // Given: Service with steps
      // When: Check all step states
      const step1Transitions = engine.getValidTransitions(
        'step_1',
        multiStepDefinition
      );
      const step2Transitions = engine.getValidTransitions(
        'step_2',
        multiStepDefinition
      );
      const step3Transitions = engine.getValidTransitions(
        'step_3',
        multiStepDefinition
      );

      // Then: All include halted
      expect(step1Transitions).toContain('halted');
      expect(step2Transitions).toContain('halted');
      expect(step3Transitions).toContain('halted');
    });

    test('terminal states have no valid transitions', () => {
      // Given: Terminal states
      // When: Get transitions from terminal states

      // delivered is terminal
      const deliveredTransitions = engine.getValidTransitions(
        'delivered',
        basicDefinition
      );
      expect(deliveredTransitions).toEqual([]);

      // cancelled is terminal
      const cancelledTransitions = engine.getValidTransitions(
        'cancelled',
        basicDefinition
      );
      expect(cancelledTransitions).toEqual([]);
    });

    test('halted state can resume, refund, or cancel', () => {
      // Given: halted state
      // When: Get transitions
      const transitions = engine.getValidTransitions('halted', basicDefinition);

      // Then: Can resume, refund, or cancel
      expect(transitions).toEqual(['in_progress', 'refund_pending', 'cancelled']);
    });

    test('completed can only go to delivered', () => {
      // Given: completed state
      // When: Get transitions
      const transitions = engine.getValidTransitions('completed', basicDefinition);

      // Then: Only delivered
      expect(transitions).toEqual(['delivered']);
    });

    test('refund_pending can only go to cancelled', () => {
      // Given: refund_pending state
      // When: Get transitions
      const transitions = engine.getValidTransitions(
        'refund_pending',
        basicDefinition
      );

      // Then: Only cancelled
      expect(transitions).toEqual(['cancelled']);
    });
  });

  describe('[P0] State Transition Execution', () => {
    test('transition() with valid transition succeeds', async () => {
      // Given: Service instance in requested state
      const mockInstance = {
        id: 'instance-123',
        state: 'requested',
        currentStepIndex: 0,
        metadata: {},
        serviceDefinition: {
          definition: basicDefinition,
        },
      };

      mockPrismaTransaction.mockImplementation(async (callback) => {
        return callback({
          serviceInstance: {
            findUnique: vi.fn().mockResolvedValue(mockInstance),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          serviceStateHistory: {
            create: vi.fn().mockResolvedValue({
              id: 'history-456',
              serviceInstanceId: 'instance-123',
              fromState: 'requested',
              toState: 'assigned',
              changedBy: 'agent-001',
            }),
          },
        });
      });

      // When: Transition from requested to assigned
      const result = await engine.transition({
        serviceInstanceId: 'instance-123',
        newState: 'assigned',
        changedBy: 'agent-001',
        reason: 'Agent assigned to service',
      });

      // Then: Transition succeeds
      expect(result.success).toBe(true);
      expect(result.fromState).toBe('requested');
      expect(result.toState).toBe('assigned');
      expect(result.historyId).toBe('history-456');
      expect(result.error).toBeUndefined();
    });

    test('transition() with optimistic locking succeeds when count = 1', async () => {
      // Given: Instance in payment_pending state
      const mockInstance = {
        id: 'instance-789',
        state: 'payment_pending',
        currentStepIndex: 0,
        metadata: {},
        serviceDefinition: { definition: basicDefinition },
      };

      mockPrismaTransaction.mockImplementation(async (callback) => {
        return callback({
          serviceInstance: {
            findUnique: vi.fn().mockResolvedValue(mockInstance),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }), // Successful update
          },
          serviceStateHistory: {
            create: vi.fn().mockResolvedValue({ id: 'history-xyz' }),
          },
        });
      });

      // When: Transition to paid
      const result = await engine.transition({
        serviceInstanceId: 'instance-789',
        newState: 'paid',
        changedBy: 'system',
      });

      // Then: Success
      expect(result.success).toBe(true);
      expect(result.fromState).toBe('payment_pending');
      expect(result.toState).toBe('paid');
    });

    test('transition() detects concurrent state mutation (count === 0)', async () => {
      // Given: Instance in paid state
      const mockInstance = {
        id: 'instance-concurrent',
        state: 'paid',
        currentStepIndex: 0,
        metadata: {},
        serviceDefinition: { definition: basicDefinition },
      };

      mockPrismaTransaction.mockImplementation(async (callback) => {
        return callback({
          serviceInstance: {
            findUnique: vi.fn().mockResolvedValue(mockInstance),
            updateMany: vi.fn().mockResolvedValue({ count: 0 }), // No rows updated
          },
          serviceStateHistory: {
            create: vi.fn(),
          },
        });
      });

      // When: Attempt transition but state changed concurrently
      const result = await engine.transition({
        serviceInstanceId: 'instance-concurrent',
        newState: 'in_progress',
        changedBy: 'agent-002',
      });

      // Then: Fails with concurrent change error
      expect(result.success).toBe(false);
      expect(result.error).toContain('Concurrent state change detected');
      expect(result.error).toContain("state is no longer 'paid'");
    });

    test('transition() rejects invalid transitions', async () => {
      // Given: Instance in requested state
      const mockInstance = {
        id: 'instance-invalid',
        state: 'requested',
        currentStepIndex: 0,
        metadata: {},
        serviceDefinition: { definition: basicDefinition },
      };

      mockPrismaTransaction.mockImplementation(async (callback) => {
        return callback({
          serviceInstance: {
            findUnique: vi.fn().mockResolvedValue(mockInstance),
            updateMany: vi.fn(),
          },
          serviceStateHistory: {
            create: vi.fn(),
          },
        });
      });

      // When: Attempt invalid transition (requested → completed)
      const result = await engine.transition({
        serviceInstanceId: 'instance-invalid',
        newState: 'completed',
        changedBy: 'hacker',
      });

      // Then: Rejected
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid transition');
      expect(result.error).toContain("from 'requested' to 'completed'");
      expect(result.error).toContain('Valid: [assigned, cancelled]');
    });

    test('transition() rejects transitions from terminal states', async () => {
      // Given: Instance in delivered (terminal) state
      const mockInstance = {
        id: 'instance-terminal',
        state: 'delivered',
        currentStepIndex: 0,
        metadata: {},
        serviceDefinition: { definition: basicDefinition },
      };

      mockPrismaTransaction.mockImplementation(async (callback) => {
        return callback({
          serviceInstance: {
            findUnique: vi.fn().mockResolvedValue(mockInstance),
            updateMany: vi.fn(),
          },
          serviceStateHistory: {
            create: vi.fn(),
          },
        });
      });

      // When: Attempt transition from terminal state
      const result = await engine.transition({
        serviceInstanceId: 'instance-terminal',
        newState: 'in_progress',
        changedBy: 'agent-003',
      });

      // Then: Rejected
      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot transition from terminal state: delivered');
    });

    test('transition() rejects from cancelled terminal state', async () => {
      // Given: Cancelled instance
      const mockInstance = {
        id: 'instance-cancelled',
        state: 'cancelled',
        currentStepIndex: 0,
        metadata: {},
        serviceDefinition: { definition: basicDefinition },
      };

      mockPrismaTransaction.mockImplementation(async (callback) => {
        return callback({
          serviceInstance: {
            findUnique: vi.fn().mockResolvedValue(mockInstance),
            updateMany: vi.fn(),
          },
          serviceStateHistory: {
            create: vi.fn(),
          },
        });
      });

      // When: Attempt to resume
      const result = await engine.transition({
        serviceInstanceId: 'instance-cancelled',
        newState: 'assigned',
        changedBy: 'admin',
      });

      // Then: Rejected
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot transition from terminal state');
    });

    test('transition() returns error when service instance not found', async () => {
      // Given: Non-existent instance
      mockPrismaTransaction.mockImplementation(async (callback) => {
        return callback({
          serviceInstance: {
            findUnique: vi.fn().mockResolvedValue(null),
            updateMany: vi.fn(),
          },
          serviceStateHistory: {
            create: vi.fn(),
          },
        });
      });

      // When: Attempt transition
      const result = await engine.transition({
        serviceInstanceId: 'nonexistent-id',
        newState: 'assigned',
        changedBy: 'agent',
      });

      // Then: Error
      expect(result.success).toBe(false);
      expect(result.error).toBe('Service instance not found');
      expect(result.fromState).toBe('');
    });

    test('transition() updates currentStepIndex for step states', async () => {
      // Given: Instance transitioning to step_2
      const mockInstance = {
        id: 'instance-step',
        state: 'step_1',
        currentStepIndex: 0,
        metadata: {},
        serviceDefinition: { definition: multiStepDefinition },
      };

      let capturedUpdateData: any;
      mockPrismaTransaction.mockImplementation(async (callback) => {
        return callback({
          serviceInstance: {
            findUnique: vi.fn().mockResolvedValue(mockInstance),
            updateMany: vi.fn().mockImplementation(({ data }) => {
              capturedUpdateData = data;
              return Promise.resolve({ count: 1 });
            }),
          },
          serviceStateHistory: {
            create: vi.fn().mockResolvedValue({ id: 'hist-step' }),
          },
        });
      });

      // When: Transition to step_2
      await engine.transition({
        serviceInstanceId: 'instance-step',
        newState: 'step_2',
        changedBy: 'agent',
      });

      // Then: currentStepIndex updated to 1 (0-indexed)
      expect(capturedUpdateData.currentStepIndex).toBe(1);
    });

    test('transition() preserves metadata and merges new metadata', async () => {
      // Given: Instance with existing metadata
      const mockInstance = {
        id: 'instance-meta',
        state: 'in_progress',
        currentStepIndex: 0,
        metadata: { existingKey: 'existingValue', count: 5 },
        serviceDefinition: { definition: multiStepDefinition },
      };

      let capturedMetadata: any;
      mockPrismaTransaction.mockImplementation(async (callback) => {
        return callback({
          serviceInstance: {
            findUnique: vi.fn().mockResolvedValue(mockInstance),
            updateMany: vi.fn().mockImplementation(({ data }) => {
              capturedMetadata = data.metadata;
              return Promise.resolve({ count: 1 });
            }),
          },
          serviceStateHistory: {
            create: vi.fn().mockResolvedValue({ id: 'hist' }),
          },
        });
      });

      // When: Transition with new metadata
      await engine.transition({
        serviceInstanceId: 'instance-meta',
        newState: 'step_1',
        changedBy: 'agent',
        metadata: { newKey: 'newValue', count: 10 },
      });

      // Then: Metadata merged
      expect(capturedMetadata).toEqual({
        existingKey: 'existingValue',
        count: 10, // Overridden
        newKey: 'newValue', // Added
      });
    });

    test('transition() creates history record with reason', async () => {
      // Given: Valid transition
      const mockInstance = {
        id: 'instance-reason',
        state: 'halted',
        currentStepIndex: 0,
        metadata: {},
        serviceDefinition: { definition: basicDefinition },
      };

      let capturedHistoryData: any;
      mockPrismaTransaction.mockImplementation(async (callback) => {
        return callback({
          serviceInstance: {
            findUnique: vi.fn().mockResolvedValue(mockInstance),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          serviceStateHistory: {
            create: vi.fn().mockImplementation(({ data }) => {
              capturedHistoryData = data;
              return Promise.resolve({ id: 'hist-reason' });
            }),
          },
        });
      });

      // When: Transition with reason
      await engine.transition({
        serviceInstanceId: 'instance-reason',
        newState: 'cancelled',
        changedBy: 'admin-005',
        reason: 'Customer requested cancellation',
        metadata: { refundIssued: true },
      });

      // Then: History includes reason and metadata
      expect(capturedHistoryData).toEqual({
        serviceInstanceId: 'instance-reason',
        fromState: 'halted',
        toState: 'cancelled',
        changedBy: 'admin-005',
        reason: 'Customer requested cancellation',
        metadata: { refundIssued: true },
      });
    });
  });

  describe('[P0] Edge Cases', () => {
    test('transition through entire happy path workflow', async () => {
      // Given: Service instance starting from requested
      let currentState = 'requested';
      const instanceId = 'full-workflow';

      const states = [
        'requested',
        'assigned',
        'payment_pending',
        'paid',
        'in_progress',
        'completed',
        'delivered',
      ];

      // Mock transaction for each transition
      for (let i = 0; i < states.length - 1; i++) {
        const fromState = states[i];
        const toState = states[i + 1];

        mockPrismaTransaction.mockImplementationOnce(async (callback) => {
          return callback({
            serviceInstance: {
              findUnique: vi.fn().mockResolvedValue({
                id: instanceId,
                state: fromState,
                currentStepIndex: 0,
                metadata: {},
                serviceDefinition: { definition: basicDefinition },
              }),
              updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            serviceStateHistory: {
              create: vi.fn().mockResolvedValue({ id: `hist-${i}` }),
            },
          });
        });

        // When: Transition to next state
        const result = await engine.transition({
          serviceInstanceId: instanceId,
          newState: toState,
          changedBy: 'system',
        });

        // Then: Each transition succeeds
        expect(result.success).toBe(true);
        expect(result.fromState).toBe(fromState);
        expect(result.toState).toBe(toState);
      }
    });

    test('step workflow with all steps', async () => {
      // Given: Service with 3 steps
      const stepStates = ['in_progress', 'step_1', 'step_2', 'step_3', 'completed'];

      for (let i = 0; i < stepStates.length - 1; i++) {
        const fromState = stepStates[i];
        const toState = stepStates[i + 1];

        mockPrismaTransaction.mockImplementationOnce(async (callback) => {
          return callback({
            serviceInstance: {
              findUnique: vi.fn().mockResolvedValue({
                id: 'step-workflow',
                state: fromState,
                currentStepIndex: i,
                metadata: {},
                serviceDefinition: { definition: multiStepDefinition },
              }),
              updateMany: vi.fn().mockResolvedValue({ count: 1 }),
            },
            serviceStateHistory: {
              create: vi.fn().mockResolvedValue({ id: `step-hist-${i}` }),
            },
          });
        });

        // When: Transition through steps
        const result = await engine.transition({
          serviceInstanceId: 'step-workflow',
          newState: toState,
          changedBy: 'agent',
        });

        // Then: Success
        expect(result.success).toBe(true);
      }
    });

    test('halt and resume workflow', async () => {
      // Given: Service in step_2
      mockPrismaTransaction.mockImplementationOnce(async (callback) => {
        return callback({
          serviceInstance: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'halt-resume',
              state: 'step_2',
              currentStepIndex: 1,
              metadata: {},
              serviceDefinition: { definition: multiStepDefinition },
            }),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          serviceStateHistory: {
            create: vi.fn().mockResolvedValue({ id: 'halt-1' }),
          },
        });
      });

      // When: Halt
      const haltResult = await engine.transition({
        serviceInstanceId: 'halt-resume',
        newState: 'halted',
        changedBy: 'agent',
        reason: 'Missing documents',
      });
      expect(haltResult.success).toBe(true);

      // Then: Can resume to in_progress
      mockPrismaTransaction.mockImplementationOnce(async (callback) => {
        return callback({
          serviceInstance: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'halt-resume',
              state: 'halted',
              currentStepIndex: 1,
              metadata: {},
              serviceDefinition: { definition: multiStepDefinition },
            }),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          serviceStateHistory: {
            create: vi.fn().mockResolvedValue({ id: 'resume-1' }),
          },
        });
      });

      const resumeResult = await engine.transition({
        serviceInstanceId: 'halt-resume',
        newState: 'in_progress',
        changedBy: 'agent',
        reason: 'Documents received',
      });
      expect(resumeResult.success).toBe(true);
    });

    test('cannot skip steps', async () => {
      // Given: Service in step_1
      mockPrismaTransaction.mockImplementation(async (callback) => {
        return callback({
          serviceInstance: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'no-skip',
              state: 'step_1',
              currentStepIndex: 0,
              metadata: {},
              serviceDefinition: { definition: multiStepDefinition },
            }),
            updateMany: vi.fn(),
          },
          serviceStateHistory: {
            create: vi.fn(),
          },
        });
      });

      // When: Attempt to skip to step_3
      const result = await engine.transition({
        serviceInstanceId: 'no-skip',
        newState: 'step_3',
        changedBy: 'agent',
      });

      // Then: Rejected
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid transition');
    });

    test('cannot go backwards in workflow', async () => {
      // Given: Service in completed state
      mockPrismaTransaction.mockImplementation(async (callback) => {
        return callback({
          serviceInstance: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'no-backward',
              state: 'completed',
              currentStepIndex: 0,
              metadata: {},
              serviceDefinition: { definition: basicDefinition },
            }),
            updateMany: vi.fn(),
          },
          serviceStateHistory: {
            create: vi.fn(),
          },
        });
      });

      // When: Attempt to go back to in_progress
      const result = await engine.transition({
        serviceInstanceId: 'no-backward',
        newState: 'in_progress',
        changedBy: 'agent',
      });

      // Then: Rejected (only delivered is valid)
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid transition');
    });
  });
});
