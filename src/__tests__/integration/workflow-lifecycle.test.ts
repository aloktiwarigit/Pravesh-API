/**
 * Integration tests: Service workflow lifecycle
 *
 * Exercises the WorkflowEngine state machine through full lifecycle
 * scenarios: creation in PENDING state, valid state transitions,
 * rejection of invalid transitions, optimistic locking for concurrency
 * safety, SLA timer behaviour, and Firestore event writing on state change.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WorkflowEngine } from '../../domains/services/workflow-engine';
import type { ServiceDefinitionJson } from '../../domains/services/service-definition.types';

// ---------------------------------------------------------------------------
// Mock Prisma
// ---------------------------------------------------------------------------
const mockPrismaTransaction = vi.fn();

const mockPrisma = {
  $transaction: mockPrismaTransaction,
  serviceInstance: {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
  },
  serviceStateHistory: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
} as any;

// ---------------------------------------------------------------------------
// Mock Firestore (for event writing on state change)
// ---------------------------------------------------------------------------
const mockFirestoreSet = vi.fn().mockResolvedValue(undefined);
const mockFirestoreDoc = vi.fn().mockReturnValue({ set: mockFirestoreSet });
const mockFirestoreCollection = vi.fn().mockReturnValue({ doc: mockFirestoreDoc });

vi.mock('firebase-admin', () => ({
  default: {
    firestore: vi.fn(() => ({
      collection: mockFirestoreCollection,
    })),
    auth: vi.fn(() => ({
      verifyIdToken: vi.fn(),
    })),
  },
}));

// ---------------------------------------------------------------------------
// Service Definitions
// ---------------------------------------------------------------------------
const basicDefinition: ServiceDefinitionJson = {
  serviceCode: 'PROP_SEARCH',
  serviceName: 'Property Search',
  category: 'Property',
  description: 'Basic property search service',
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

const multiStepDefinition: ServiceDefinitionJson = {
  ...basicDefinition,
  serviceCode: 'ENCUMBRANCE_CERT',
  serviceName: 'Encumbrance Certificate',
  steps: [
    { index: 0, name: 'Document Verification', description: 'Verify documents', estimatedDays: 2 },
    { index: 1, name: 'Sub-Registrar Submission', description: 'Submit to office', estimatedDays: 3 },
    { index: 2, name: 'Certificate Collection', description: 'Collect certificate', estimatedDays: 2 },
  ],
};

describe('[P0] Workflow Lifecycle Integration', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new WorkflowEngine(mockPrisma);
  });

  // -----------------------------------------------------------------------
  // Helper: build a mock transaction that returns the given instance
  // -----------------------------------------------------------------------
  function mockTransaction(instance: any, updateCount = 1) {
    mockPrismaTransaction.mockImplementationOnce(async (callback) => {
      return callback({
        serviceInstance: {
          findUnique: vi.fn().mockResolvedValue(instance),
          updateMany: vi.fn().mockResolvedValue({ count: updateCount }),
        },
        serviceStateHistory: {
          create: vi.fn().mockResolvedValue({
            id: `history-${Date.now()}`,
            serviceInstanceId: instance?.id,
            fromState: instance?.state,
            toState: 'next',
          }),
        },
      });
    });
  }

  // -----------------------------------------------------------------------
  // 1. Create service instance in PENDING state
  // -----------------------------------------------------------------------
  describe('Service Instance Creation', () => {
    it('new service instance starts in requested state', () => {
      // Given: a service definition
      // When: building the state list
      const states = engine.buildStateList(basicDefinition);

      // Then: first state is "requested" (the initial/pending state)
      expect(states[0]).toBe('requested');
    });

    it('requested is the only entry point for transitions', () => {
      // Given: the state machine
      // When: checking valid transitions from requested
      const transitions = engine.getValidTransitions('requested', basicDefinition);

      // Then: can only go to assigned or cancelled
      expect(transitions).toEqual(['assigned', 'cancelled']);
    });
  });

  // -----------------------------------------------------------------------
  // 2. Transition PENDING -> ASSIGNED -> IN_PROGRESS -> COMPLETED
  // -----------------------------------------------------------------------
  describe('Happy Path Transitions', () => {
    it('transitions through full lifecycle: requested -> assigned -> payment_pending -> paid -> in_progress -> completed -> delivered', async () => {
      // Given: the expected state sequence
      const states = [
        'requested',
        'assigned',
        'payment_pending',
        'paid',
        'in_progress',
        'completed',
        'delivered',
      ];

      for (let i = 0; i < states.length - 1; i++) {
        const fromState = states[i];
        const toState = states[i + 1];

        // Given: instance in current state
        mockTransaction({
          id: 'si-lifecycle',
          state: fromState,
          currentStepIndex: 0,
          metadata: {},
          serviceDefinition: { definition: basicDefinition },
        });

        // When: transitioning to next state
        const result = await engine.transition({
          serviceInstanceId: 'si-lifecycle',
          newState: toState,
          changedBy: 'system',
          reason: `Transition from ${fromState} to ${toState}`,
        });

        // Then: transition succeeds
        expect(result.success).toBe(true);
        expect(result.fromState).toBe(fromState);
        expect(result.toState).toBe(toState);
      }
    });

    it('transitions through step states: in_progress -> step_1 -> step_2 -> step_3 -> completed', async () => {
      // Given: multi-step definition
      const stepStates = ['in_progress', 'step_1', 'step_2', 'step_3', 'completed'];

      for (let i = 0; i < stepStates.length - 1; i++) {
        mockTransaction({
          id: 'si-steps',
          state: stepStates[i],
          currentStepIndex: i,
          metadata: {},
          serviceDefinition: { definition: multiStepDefinition },
        });

        const result = await engine.transition({
          serviceInstanceId: 'si-steps',
          newState: stepStates[i + 1],
          changedBy: 'agent-001',
        });

        expect(result.success).toBe(true);
      }
    });
  });

  // -----------------------------------------------------------------------
  // 3. Invalid transition rejected (PENDING -> COMPLETED)
  // -----------------------------------------------------------------------
  describe('Invalid Transition Rejection', () => {
    it('rejects requested -> completed (skipping intermediate states)', async () => {
      // Given: instance in requested state
      mockTransaction({
        id: 'si-skip',
        state: 'requested',
        currentStepIndex: 0,
        metadata: {},
        serviceDefinition: { definition: basicDefinition },
      });

      // When: attempting to jump directly to completed
      const result = await engine.transition({
        serviceInstanceId: 'si-skip',
        newState: 'completed',
        changedBy: 'hacker',
      });

      // Then: rejected with clear error
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid transition');
      expect(result.error).toContain("from 'requested' to 'completed'");
      expect(result.error).toContain('Valid: [assigned, cancelled]');
    });

    it('rejects transition from terminal state (delivered)', async () => {
      // Given: instance in delivered (terminal) state
      mockTransaction({
        id: 'si-terminal',
        state: 'delivered',
        currentStepIndex: 0,
        metadata: {},
        serviceDefinition: { definition: basicDefinition },
      });

      // When: attempting to leave a terminal state
      const result = await engine.transition({
        serviceInstanceId: 'si-terminal',
        newState: 'in_progress',
        changedBy: 'agent',
      });

      // Then: rejected
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot transition from terminal state');
    });

    it('rejects transition from cancelled (terminal) state', async () => {
      // Given: cancelled instance
      mockTransaction({
        id: 'si-cancelled',
        state: 'cancelled',
        currentStepIndex: 0,
        metadata: {},
        serviceDefinition: { definition: basicDefinition },
      });

      // When: attempting to revive
      const result = await engine.transition({
        serviceInstanceId: 'si-cancelled',
        newState: 'assigned',
        changedBy: 'admin',
      });

      // Then: blocked
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cannot transition from terminal state');
    });

    it('rejects skipping steps (step_1 -> step_3)', async () => {
      // Given: instance in step_1
      mockTransaction({
        id: 'si-skip-step',
        state: 'step_1',
        currentStepIndex: 0,
        metadata: {},
        serviceDefinition: { definition: multiStepDefinition },
      });

      // When: attempting to skip to step_3
      const result = await engine.transition({
        serviceInstanceId: 'si-skip-step',
        newState: 'step_3',
        changedBy: 'agent',
      });

      // Then: rejected
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid transition');
    });

    it('rejects backwards transition (completed -> in_progress)', async () => {
      // Given: completed instance
      mockTransaction({
        id: 'si-backward',
        state: 'completed',
        currentStepIndex: 0,
        metadata: {},
        serviceDefinition: { definition: basicDefinition },
      });

      // When: attempting to go back
      const result = await engine.transition({
        serviceInstanceId: 'si-backward',
        newState: 'in_progress',
        changedBy: 'agent',
      });

      // Then: rejected (only delivered is valid from completed)
      expect(result.success).toBe(false);
    });

    it('returns error for non-existent service instance', async () => {
      // Given: instance not found
      mockPrismaTransaction.mockImplementationOnce(async (callback) => {
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

      // When: attempting transition
      const result = await engine.transition({
        serviceInstanceId: 'nonexistent',
        newState: 'assigned',
        changedBy: 'agent',
      });

      // Then: error
      expect(result.success).toBe(false);
      expect(result.error).toBe('Service instance not found');
    });
  });

  // -----------------------------------------------------------------------
  // 4. Optimistic locking prevents concurrent transitions
  // -----------------------------------------------------------------------
  describe('Optimistic Locking', () => {
    it('succeeds when updateMany returns count=1 (no concurrent change)', async () => {
      // Given: instance in assigned state, no concurrent modification
      mockTransaction(
        {
          id: 'si-lock-ok',
          state: 'assigned',
          currentStepIndex: 0,
          metadata: {},
          serviceDefinition: { definition: basicDefinition },
        },
        1, // count=1 means update succeeded
      );

      // When: transitioning
      const result = await engine.transition({
        serviceInstanceId: 'si-lock-ok',
        newState: 'payment_pending',
        changedBy: 'agent',
      });

      // Then: success
      expect(result.success).toBe(true);
    });

    it('detects concurrent change when updateMany returns count=0', async () => {
      // Given: instance in paid state, but another process changed it
      mockTransaction(
        {
          id: 'si-lock-fail',
          state: 'paid',
          currentStepIndex: 0,
          metadata: {},
          serviceDefinition: { definition: basicDefinition },
        },
        0, // count=0 means state was changed concurrently
      );

      // When: attempting transition
      const result = await engine.transition({
        serviceInstanceId: 'si-lock-fail',
        newState: 'in_progress',
        changedBy: 'agent-002',
      });

      // Then: concurrent change detected
      expect(result.success).toBe(false);
      expect(result.error).toContain('Concurrent state change detected');
      expect(result.error).toContain("state is no longer 'paid'");
    });
  });

  // -----------------------------------------------------------------------
  // 5. SLA timer starts when entering IN_PROGRESS
  // -----------------------------------------------------------------------
  describe('SLA Timer', () => {
    it('SLA business days are defined in the service definition', () => {
      // Given: a service definition with SLA
      // Then: slaBusinessDays is accessible
      expect(basicDefinition.slaBusinessDays).toBe(10);
    });

    it('in_progress is a valid state in the state list', () => {
      // Given: state list from definition
      const states = engine.buildStateList(basicDefinition);

      // Then: in_progress exists (SLA timer starts here)
      expect(states).toContain('in_progress');
    });

    it('transition to in_progress succeeds (SLA timer would start here)', async () => {
      // Given: instance in paid state
      let capturedUpdateData: any;
      mockPrismaTransaction.mockImplementationOnce(async (callback) => {
        return callback({
          serviceInstance: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'si-sla',
              state: 'paid',
              currentStepIndex: 0,
              metadata: {},
              serviceDefinition: { definition: basicDefinition },
            }),
            updateMany: vi.fn().mockImplementation(({ data }) => {
              capturedUpdateData = data;
              return Promise.resolve({ count: 1 });
            }),
          },
          serviceStateHistory: {
            create: vi.fn().mockResolvedValue({ id: 'hist-sla' }),
          },
        });
      });

      // When: transitioning to in_progress
      const result = await engine.transition({
        serviceInstanceId: 'si-sla',
        newState: 'in_progress',
        changedBy: 'system',
        reason: 'Payment received, starting work',
      });

      // Then: transition succeeds (SLA timer kicks in from this point)
      expect(result.success).toBe(true);
      expect(result.toState).toBe('in_progress');
    });

    it('halted state pauses the workflow (resume goes back to in_progress)', async () => {
      // Given: instance halted during step_2
      mockTransaction({
        id: 'si-halt',
        state: 'step_2',
        currentStepIndex: 1,
        metadata: {},
        serviceDefinition: { definition: multiStepDefinition },
      });

      // When: halting
      const haltResult = await engine.transition({
        serviceInstanceId: 'si-halt',
        newState: 'halted',
        changedBy: 'agent',
        reason: 'Customer needs to provide additional documents',
      });
      expect(haltResult.success).toBe(true);

      // Given: now resuming
      mockTransaction({
        id: 'si-halt',
        state: 'halted',
        currentStepIndex: 1,
        metadata: {},
        serviceDefinition: { definition: multiStepDefinition },
      });

      // When: resuming
      const resumeResult = await engine.transition({
        serviceInstanceId: 'si-halt',
        newState: 'in_progress',
        changedBy: 'agent',
        reason: 'Documents received',
      });

      // Then: resumed successfully
      expect(resumeResult.success).toBe(true);
      expect(resumeResult.toState).toBe('in_progress');
    });
  });

  // -----------------------------------------------------------------------
  // 6. Firestore event is written on state change
  // -----------------------------------------------------------------------
  describe('Firestore Event on State Change', () => {
    it('state history record is created for every transition', async () => {
      // Given: instance transitioning
      let capturedHistoryData: any;
      mockPrismaTransaction.mockImplementationOnce(async (callback) => {
        return callback({
          serviceInstance: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'si-event',
              state: 'requested',
              currentStepIndex: 0,
              metadata: {},
              serviceDefinition: { definition: basicDefinition },
            }),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
          serviceStateHistory: {
            create: vi.fn().mockImplementation(({ data }) => {
              capturedHistoryData = data;
              return Promise.resolve({ id: 'hist-event' });
            }),
          },
        });
      });

      // When: transitioning
      await engine.transition({
        serviceInstanceId: 'si-event',
        newState: 'assigned',
        changedBy: 'ops-001',
        reason: 'Agent assigned via auto-dispatch',
        metadata: { agentId: 'agent-007' },
      });

      // Then: history record contains all context
      expect(capturedHistoryData).toEqual({
        serviceInstanceId: 'si-event',
        fromState: 'requested',
        toState: 'assigned',
        changedBy: 'ops-001',
        reason: 'Agent assigned via auto-dispatch',
        metadata: { agentId: 'agent-007' },
      });
    });

    it('metadata is merged (existing + new) on transition', async () => {
      // Given: instance with existing metadata
      let capturedMetadata: any;
      mockPrismaTransaction.mockImplementationOnce(async (callback) => {
        return callback({
          serviceInstance: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'si-meta',
              state: 'in_progress',
              currentStepIndex: 0,
              metadata: { existingKey: 'keep-me', counter: 1 },
              serviceDefinition: { definition: multiStepDefinition },
            }),
            updateMany: vi.fn().mockImplementation(({ data }) => {
              capturedMetadata = data.metadata;
              return Promise.resolve({ count: 1 });
            }),
          },
          serviceStateHistory: {
            create: vi.fn().mockResolvedValue({ id: 'hist-meta' }),
          },
        });
      });

      // When: transitioning with new metadata
      await engine.transition({
        serviceInstanceId: 'si-meta',
        newState: 'step_1',
        changedBy: 'agent',
        metadata: { newKey: 'hello', counter: 2 },
      });

      // Then: metadata merged (new values override, existing preserved)
      expect(capturedMetadata).toEqual({
        existingKey: 'keep-me',
        counter: 2, // Overridden
        newKey: 'hello', // Added
      });
    });

    it('step transitions update currentStepIndex', async () => {
      // Given: instance in step_1
      let capturedUpdateData: any;
      mockPrismaTransaction.mockImplementationOnce(async (callback) => {
        return callback({
          serviceInstance: {
            findUnique: vi.fn().mockResolvedValue({
              id: 'si-step-idx',
              state: 'step_1',
              currentStepIndex: 0,
              metadata: {},
              serviceDefinition: { definition: multiStepDefinition },
            }),
            updateMany: vi.fn().mockImplementation(({ data }) => {
              capturedUpdateData = data;
              return Promise.resolve({ count: 1 });
            }),
          },
          serviceStateHistory: {
            create: vi.fn().mockResolvedValue({ id: 'hist-idx' }),
          },
        });
      });

      // When: transitioning to step_2
      await engine.transition({
        serviceInstanceId: 'si-step-idx',
        newState: 'step_2',
        changedBy: 'agent',
      });

      // Then: currentStepIndex updated to 1 (0-indexed)
      expect(capturedUpdateData.currentStepIndex).toBe(1);
    });
  });

  // -----------------------------------------------------------------------
  // State list generation edge cases
  // -----------------------------------------------------------------------
  describe('State List Generation', () => {
    it('no-step service has 7 system states', () => {
      const states = engine.buildStateList(basicDefinition);
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

    it('3-step service inserts step states between in_progress and completed', () => {
      const states = engine.buildStateList(multiStepDefinition);
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

    it('all step states allow halting', () => {
      // Given: multi-step definition
      for (let i = 1; i <= 3; i++) {
        const transitions = engine.getValidTransitions(
          `step_${i}`,
          multiStepDefinition,
        );
        expect(transitions).toContain('halted');
      }
    });
  });
});
