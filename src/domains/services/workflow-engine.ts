// property-legal-agent-api/src/domains/services/workflow-engine.ts
// Story 5-5: Config-driven workflow state machine engine
// States: requested → assigned → payment_pending → paid → in_progress → step_1..step_N → completed → delivered
// Branches: halted, refund_pending, cancelled (from any active state)

import type { PrismaClient } from '@prisma/client';
import type { ServiceDefinitionJson } from './service-definition.types.js';

// ============================================================
// State Machine Configuration
// ============================================================

const SYSTEM_STATES = [
  'requested',
  'assigned',
  'payment_pending',
  'paid',
  'in_progress',
  'completed',
  'delivered',
  'halted',
  'refund_pending',
  'cancelled',
] as const;

export type SystemState = (typeof SYSTEM_STATES)[number];
export type StepState = `step_${number}`;
export type ServiceState = SystemState | StepState;

/** States that are considered "active" — the service is in progress */
export const ACTIVE_STATES: readonly string[] = ['in_progress'];

/** States from which a service can be halted */
const HALTABLE_STATES = new Set<string>([
  'in_progress',
  'payment_pending',
  'paid',
]);

/** States from which a service can be cancelled */
const CANCELLABLE_STATES = new Set<string>([
  'requested',
  'assigned',
  'payment_pending',
]);

/** Terminal states — no further transitions allowed */
const TERMINAL_STATES = new Set<string>(['delivered', 'cancelled']);

/**
 * Base forward transitions (without dynamic step states).
 * step_N states are generated dynamically based on definition.steps.length.
 */
const BASE_TRANSITIONS: Record<string, string[]> = {
  requested: ['assigned', 'cancelled'],
  assigned: ['payment_pending', 'cancelled'],
  payment_pending: ['paid', 'halted', 'cancelled'],
  paid: ['in_progress', 'halted'],
  in_progress: ['completed', 'halted'], // step_1 added dynamically
  completed: ['delivered'],
  delivered: [],
  halted: ['in_progress', 'refund_pending', 'cancelled'],
  refund_pending: ['cancelled'],
  cancelled: [],
};

// ============================================================
// Transition Types
// ============================================================

export interface TransitionRequest {
  serviceInstanceId: string;
  newState: string;
  changedBy: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

export interface TransitionResult {
  success: boolean;
  fromState: string;
  toState: string;
  serviceInstanceId: string;
  historyId?: string;
  error?: string;
}

// ============================================================
// Workflow Engine
// ============================================================

export class WorkflowEngine {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Build the full ordered list of states for a service definition.
   * System states + step_1..step_N inserted between in_progress and completed.
   */
  buildStateList(definition: ServiceDefinitionJson): string[] {
    const states: string[] = [
      'requested',
      'assigned',
      'payment_pending',
      'paid',
      'in_progress',
    ];

    for (let i = 1; i <= definition.steps.length; i++) {
      states.push(`step_${i}`);
    }

    states.push('completed', 'delivered');
    return states;
  }

  /**
   * Get valid transitions from a given state, considering the service definition.
   */
  getValidTransitions(
    currentState: string,
    definition: ServiceDefinitionJson,
  ): string[] {
    const totalSteps = definition.steps.length;
    const transitions: string[] = [];

    // Check step states
    const stepMatch = currentState.match(/^step_(\d+)$/);
    if (stepMatch) {
      const stepNum = parseInt(stepMatch[1], 10);
      if (stepNum < totalSteps) {
        transitions.push(`step_${stepNum + 1}`);
      } else {
        transitions.push('completed');
      }
      transitions.push('halted');
      return transitions;
    }

    // Base transitions
    const base = BASE_TRANSITIONS[currentState];
    if (base) {
      transitions.push(...base);
    }

    // in_progress can go to step_1 if steps exist
    if (currentState === 'in_progress' && totalSteps > 0) {
      // Replace 'completed' with 'step_1' when steps exist
      const idx = transitions.indexOf('completed');
      if (idx !== -1) {
        transitions.splice(idx, 1);
      }
      transitions.unshift('step_1');
    }

    // All active step states can be halted
    if (HALTABLE_STATES.has(currentState)) {
      if (!transitions.includes('halted')) {
        transitions.push('halted');
      }
    }

    return transitions;
  }

  /**
   * Execute a state transition with validation, persistence, and history.
   * Uses an interactive transaction to prevent TOCTOU race conditions.
   */
  async transition(request: TransitionRequest): Promise<TransitionResult> {
    return this.prisma.$transaction(async (tx) => {
      // Read inside the transaction to prevent TOCTOU
      const instance = await tx.serviceInstance.findUnique({
        where: { id: request.serviceInstanceId },
        include: { serviceDefinition: true },
      });

      if (!instance) {
        return {
          success: false,
          fromState: '',
          toState: request.newState,
          serviceInstanceId: request.serviceInstanceId,
          error: 'Service instance not found',
        };
      }

      const currentState = instance.state;

      // Check terminal state
      if (TERMINAL_STATES.has(currentState)) {
        return {
          success: false,
          fromState: currentState,
          toState: request.newState,
          serviceInstanceId: request.serviceInstanceId,
          error: `Cannot transition from terminal state: ${currentState}`,
        };
      }

      // Validate transition
      const definition = instance.serviceDefinition
        .definition as unknown as ServiceDefinitionJson;
      const validTransitions = this.getValidTransitions(currentState, definition);

      if (!validTransitions.includes(request.newState)) {
        return {
          success: false,
          fromState: currentState,
          toState: request.newState,
          serviceInstanceId: request.serviceInstanceId,
          error: `Invalid transition from '${currentState}' to '${request.newState}'. Valid: [${validTransitions.join(', ')}]`,
        };
      }

      // Calculate step index for step states
      let currentStepIndex = instance.currentStepIndex;
      const stepMatch = request.newState.match(/^step_(\d+)$/);
      if (stepMatch) {
        currentStepIndex = parseInt(stepMatch[1], 10) - 1; // 0-indexed
      }

      // Optimistic lock: only update if state still matches what we read
      const updateResult = await tx.serviceInstance.updateMany({
        where: {
          id: request.serviceInstanceId,
          state: currentState, // WHERE clause prevents concurrent mutation
        },
        data: {
          state: request.newState,
          currentStepIndex,
          metadata: (request.metadata
            ? {
                ...((instance.metadata as Record<string, unknown>) || {}),
                ...request.metadata,
              }
            : instance.metadata) as any,
        },
      });

      // If no rows updated, another transaction changed state concurrently
      if (updateResult.count === 0) {
        return {
          success: false,
          fromState: currentState,
          toState: request.newState,
          serviceInstanceId: request.serviceInstanceId,
          error: `Concurrent state change detected — state is no longer '${currentState}'`,
        };
      }

      const history = await tx.serviceStateHistory.create({
        data: {
          serviceInstanceId: request.serviceInstanceId,
          fromState: currentState,
          toState: request.newState,
          changedBy: request.changedBy,
          reason: request.reason,
          metadata: request.metadata as any,
        },
      });

      return {
        success: true,
        fromState: currentState,
        toState: request.newState,
        serviceInstanceId: request.serviceInstanceId,
        historyId: history.id,
      };
    });
  }

  /**
   * Get the current state info for a service instance.
   */
  async getState(serviceInstanceId: string) {
    const instance = await this.prisma.serviceInstance.findUnique({
      where: { id: serviceInstanceId },
      include: { serviceDefinition: true },
    });
    if (!instance) return null;

    const definition = instance.serviceDefinition
      .definition as unknown as ServiceDefinitionJson;
    const stateList = this.buildStateList(definition);
    const validTransitions = this.getValidTransitions(
      instance.state,
      definition,
    );

    return {
      serviceInstanceId: instance.id,
      currentState: instance.state,
      currentStepIndex: instance.currentStepIndex,
      currentStepName:
        definition.steps[instance.currentStepIndex]?.name || null,
      totalSteps: definition.steps.length,
      stateList,
      validTransitions,
      isTerminal: TERMINAL_STATES.has(instance.state),
    };
  }

  /**
   * Get full transition history for a service instance.
   */
  async getHistory(serviceInstanceId: string) {
    return this.prisma.serviceStateHistory.findMany({
      where: { serviceInstanceId },
      orderBy: { createdAt: 'asc' },
    });
  }
}

/**
 * Generate the list of all active step states for queries.
 * Returns ['in_progress', 'step_1', 'step_2', ... 'step_20']
 */
export function getAllActiveStates(maxSteps = 20): string[] {
  const states = ['in_progress'];
  for (let i = 1; i <= maxSteps; i++) {
    states.push(`step_${i}`);
  }
  return states;
}
