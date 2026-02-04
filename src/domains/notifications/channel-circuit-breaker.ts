/**
 * Story 7-12: Channel Circuit Breaker
 * Prevents cascading failures when external APIs (FCM, WhatsApp, SMS) are down
 */

import { logger } from '../../shared/utils/logger';

interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
  halfOpenAt: number;
}

const FAILURE_THRESHOLD = 5;
const RECOVERY_TIME_MS = 60 * 1000; // 1 minute

export class ChannelCircuitBreaker {
  private states: Map<string, CircuitBreakerState> = new Map();

  isChannelAvailable(channel: string): boolean {
    const state = this.states.get(channel);
    if (!state) return true;

    if (state.isOpen) {
      // Check if recovery time has passed (half-open)
      if (Date.now() >= state.halfOpenAt) {
        state.isOpen = false;
        return true;
      }
      return false;
    }

    return true;
  }

  recordSuccess(channel: string): void {
    this.states.delete(channel);
  }

  recordFailure(channel: string): void {
    const state = this.states.get(channel) ?? {
      failures: 0,
      lastFailure: 0,
      isOpen: false,
      halfOpenAt: 0,
    };

    state.failures++;
    state.lastFailure = Date.now();

    if (state.failures >= FAILURE_THRESHOLD) {
      state.isOpen = true;
      state.halfOpenAt = Date.now() + RECOVERY_TIME_MS;
      logger.error({
        channel,
        failures: state.failures,
        halfOpenAt: new Date(state.halfOpenAt).toISOString(),
      }, 'Circuit breaker OPEN for channel');
    }

    this.states.set(channel, state);
  }

  getStatus(): Record<string, { isOpen: boolean; failures: number }> {
    const result: Record<string, { isOpen: boolean; failures: number }> = {};
    for (const [channel, state] of this.states) {
      result[channel] = { isOpen: state.isOpen, failures: state.failures };
    }
    return result;
  }
}

// Singleton instance
export const channelCircuitBreaker = new ChannelCircuitBreaker();
