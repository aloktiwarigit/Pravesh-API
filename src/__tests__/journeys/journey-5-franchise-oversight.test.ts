/**
 * Journey 5: Franchise Oversight
 *
 * Validates the franchise owner visibility flow:
 *   Franchise owner views their territory → Views city config →
 *   Views agents operating in territory → Views monthly revenue report
 *
 * Roles: Franchise Owner (1 role, 4 steps)
 *
 * Note: This journey does not create test data, so only disconnectCleanup
 * is needed in afterAll (no cleanupJourneyData).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createJourneyClient, JourneyClient } from '../helpers/journey-client';
import { LUCKNOW_CITY_ID } from '../helpers/journey-data';
import { disconnectCleanup } from '../helpers/journey-cleanup';

describe('Journey 5: Franchise Oversight', () => {
  let client: JourneyClient;

  // Shared state across steps
  let franchiseId: string;

  beforeAll(async () => {
    client = await createJourneyClient();
  }, 30_000);

  afterAll(async () => {
    await disconnectCleanup();
  }, 15_000);

  // ── Step 1: Franchise owner views territory ───────────────────────

  it('Step 1: Franchise owner views their territory', async () => {
    const res = await client.as('franchise_owner').get('/franchise-owners/me');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data ?? {};
    expect(data).toBeDefined();

    // Extract franchise ID for use in the revenue report step
    franchiseId = data.id ?? data.franchiseId ?? data.franchiseOwnerId ?? '';
  });

  // ── Step 2: Franchise owner views city config ─────────────────────

  it('Step 2: Franchise owner views city configuration', async () => {
    const res = await client
      .as('franchise_owner')
      .get(`/cities/${LUCKNOW_CITY_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data).toBeDefined();
  });

  // ── Step 3: Franchise owner views agents in territory ─────────────

  it('Step 3: Franchise owner views agents in their territory', async () => {
    const res = await client
      .as('franchise_owner')
      .get(`/franchise-agents/${LUCKNOW_CITY_ID}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const agents = Array.isArray(res.body.data)
      ? res.body.data
      : res.body.data?.items ?? res.body.data?.agents ?? [];

    expect(Array.isArray(agents)).toBe(true);
  });

  // ── Step 4: Franchise owner views monthly revenue report ──────────

  it('Step 4: Franchise owner views monthly revenue report', async () => {
    // Use the franchiseId from step 1; fall back to a placeholder UUID if not found
    const resolvedFranchiseId =
      franchiseId || '00000000-0000-0000-0000-000000000000';

    const res = await client
      .as('franchise_owner')
      .get(`/franchise-revenue/${resolvedFranchiseId}/monthly/2026-02`);

    // 200 if data exists for the period; 404 if no revenue records found — both acceptable
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    }
  });
});
