/**
 * Journey 7: Admin Platform Management
 *
 * Validates admin-level read operations and access control:
 *   Admin views platform stats → Admin searches users →
 *   Admin views cities → Admin views audit logs →
 *   Customer is forbidden from admin endpoint (negative test)
 *
 * Roles: Admin (super_admin), Customer for negative test (2 roles, 5 steps)
 *
 * Note: This journey is mostly read-only — no cleanupJourneyData needed.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createJourneyClient, JourneyClient } from '../helpers/journey-client';
import { disconnectCleanup } from '../helpers/journey-cleanup';

describe('Journey 7: Admin Platform Management', () => {
  let client: JourneyClient;

  beforeAll(async () => {
    client = await createJourneyClient();
  }, 30_000);

  afterAll(async () => {
    await disconnectCleanup();
  }, 15_000);

  // ── Step 1: Admin views platform stats ────────────────────────────

  it('Step 1: Admin views platform stats', async () => {
    const res = await client.as('admin').get('/admin/platform-stats');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data ?? res.body;
    // At least one top-level stat field must be present
    const hasStat =
      data.totalUsers !== undefined ||
      data.total_users !== undefined ||
      data.users !== undefined ||
      data.stats !== undefined ||
      data.summary !== undefined;
    expect(hasStat).toBe(true);
  });

  // ── Step 2: Admin searches users ─────────────────────────────────

  it('Step 2: Admin searches users', async () => {
    const res = await client.as('admin').get('/users/search?query=test');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const users = Array.isArray(res.body.data)
      ? res.body.data
      : res.body.data?.items ?? res.body.data?.users ?? [];

    // The search endpoint must return an array (may be empty for a given query)
    expect(Array.isArray(users)).toBe(true);
  });

  // ── Step 3: Admin views cities ────────────────────────────────────

  it('Step 3: Admin views cities and Lucknow appears in list', async () => {
    const res = await client.as('admin').get('/cities');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const cities = Array.isArray(res.body.data)
      ? res.body.data
      : res.body.data?.items ?? res.body.data?.cities ?? [];

    const hasLucknow = cities.some(
      (c: any) =>
        (c.name ?? c.cityName ?? '').toLowerCase().includes('lucknow'),
    );
    expect(hasLucknow).toBe(true);
  });

  // ── Step 4: Admin views audit logs ───────────────────────────────

  it('Step 4: Admin views corporate audit logs', async () => {
    const res = await client.as('admin').get('/corporate-audits');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Paginated response — data may be an array or a pagination wrapper
    const data = res.body.data;
    expect(data).toBeDefined();

    const items = Array.isArray(data)
      ? data
      : data?.items ?? data?.audits ?? data?.logs ?? [];

    expect(Array.isArray(items)).toBe(true);
  });

  // ── Step 5: Customer is forbidden from admin endpoint ─────────────

  it('Step 5: Customer receives 403 on admin platform-stats endpoint', async () => {
    const res = await client.as('customer').get('/admin/platform-stats');

    expect(res.status).toBe(403);
  });
});
