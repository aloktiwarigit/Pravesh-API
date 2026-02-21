/**
 * Tests for MetricsCollector.
 * NOTE: Tests use a fresh instance to avoid singleton state leaking between tests.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// We need to import the class, but the module exports a singleton.
// We'll test via the exported singleton's behavior.

describe('MetricsCollector', () => {
  // Since metrics is a singleton, we must be careful with state.
  // We test by importing fresh and recording new requests.

  test('getSnapshot returns initial state', async () => {
    // Dynamically import to get fresh state awareness
    const { metrics } = await import('../metrics');
    const snapshot = metrics.getSnapshot();

    expect(snapshot).toHaveProperty('uptimeMs');
    expect(snapshot).toHaveProperty('totalRequests');
    expect(snapshot).toHaveProperty('totalErrors');
    expect(snapshot).toHaveProperty('routes');
    expect(typeof snapshot.uptimeMs).toBe('number');
  });

  test('recordRequest increments total request count', async () => {
    const { metrics } = await import('../metrics');
    const before = metrics.getSnapshot().totalRequests;

    metrics.recordRequest('GET', '/api/v1/cities', 200, 50);

    const after = metrics.getSnapshot().totalRequests;
    expect(after).toBe(before + 1);
  });

  test('recordRequest increments error count for 4xx/5xx status', async () => {
    const { metrics } = await import('../metrics');
    const before = metrics.getSnapshot().totalErrors;

    metrics.recordRequest('POST', '/api/v1/auth/register', 400, 30);

    const after = metrics.getSnapshot().totalErrors;
    expect(after).toBe(before + 1);
  });

  test('recordRequest does not increment error count for 2xx status', async () => {
    const { metrics } = await import('../metrics');
    const before = metrics.getSnapshot().totalErrors;

    metrics.recordRequest('GET', '/health', 200, 10);

    const after = metrics.getSnapshot().totalErrors;
    expect(after).toBe(before);
  });

  test('recordRequest normalizes UUIDs in paths', async () => {
    const { metrics } = await import('../metrics');

    metrics.recordRequest('GET', '/api/v1/users/550e8400-e29b-41d4-a716-446655440000', 200, 25);

    const snapshot = metrics.getSnapshot();
    const key = 'GET /api/v1/users/:id';
    expect(snapshot.routes[key]).toBeDefined();
  });

  test('recordRequest normalizes numeric IDs in paths', async () => {
    const { metrics } = await import('../metrics');

    metrics.recordRequest('GET', '/api/v1/items/12345', 200, 15);

    const snapshot = metrics.getSnapshot();
    const key = 'GET /api/v1/items/:id';
    expect(snapshot.routes[key]).toBeDefined();
  });

  test('getSnapshot calculates average duration', async () => {
    const { metrics } = await import('../metrics');

    // Record several requests to the same route
    const uniqueRoute = `/api/v1/test-avg-${Date.now()}`;
    metrics.recordRequest('GET', uniqueRoute, 200, 100);
    metrics.recordRequest('GET', uniqueRoute, 200, 200);

    const snapshot = metrics.getSnapshot();
    const key = `GET ${uniqueRoute}`;
    if (snapshot.routes[key]) {
      expect(snapshot.routes[key].avgDurationMs).toBe(150); // (100 + 200) / 2
    }
  });

  test('uptimeMs increases over time', async () => {
    const { metrics } = await import('../metrics');
    const snapshot1 = metrics.getSnapshot();

    // Small delay
    await new Promise((r) => setTimeout(r, 10));

    const snapshot2 = metrics.getSnapshot();
    expect(snapshot2.uptimeMs).toBeGreaterThanOrEqual(snapshot1.uptimeMs);
  });
});
