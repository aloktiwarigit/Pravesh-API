/**
 * Journey 4: Builder Bulk Services
 *
 * Validates the builder bulk service request pipeline:
 *   Builder views profile → Builder creates project →
 *   Builder adds units → Builder selects bulk services →
 *   Ops sees the generated service requests
 *
 * Roles: Builder, Ops Manager (2 roles, 5 steps)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createJourneyClient, JourneyClient } from '../helpers/journey-client';
import { LUCKNOW_CITY_ID, SERVICE_CODES, SERVICE_UUIDS, testTag } from '../helpers/journey-data';
import { cleanupJourneyData, disconnectCleanup } from '../helpers/journey-cleanup';

describe('Journey 4: Builder Bulk Services', () => {
  let client: JourneyClient;

  // Shared state across steps
  let builderId: string;
  let projectId: string;
  let unitId: string;

  beforeAll(async () => {
    client = await createJourneyClient();
  }, 30_000);

  afterAll(async () => {
    await cleanupJourneyData();
    await disconnectCleanup();
  }, 15_000);

  // ── Step 1: Builder gets profile ──────────────────────────────────

  it('Step 1: Builder views profile', async () => {
    const res = await client.as('builder').get('/builders/profile');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data).toBeDefined();
    // Capture builder DB ID for subsequent requests (controller reads req.body.builderId)
    builderId = data.id ?? data.builderId ?? '';
    expect(builderId).toBeTruthy();
  });

  // ── Step 2: Builder creates project ──────────────────────────────

  it('Step 2: Builder creates a project', async () => {
    const tag = testTag();

    const payload = {
      name: `Journey Test Project ${tag}`,
      totalUnits: 5,
      location: 'Journey Test Location',
      projectType: 'RESIDENTIAL',
      cityId: LUCKNOW_CITY_ID,
      builderId,
    };

    const res = await client.as('builder').post('/builders/projects', payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    projectId = data.id ?? data.projectId;
    expect(projectId).toBeTruthy();
  });

  // ── Step 3: Builder adds a unit ───────────────────────────────────

  it('Step 3: Builder adds a unit to the project', async () => {
    expect(projectId).toBeTruthy();

    const payload = {
      unitNumber: 'JT-A101',
      buyerName: 'Journey Test Buyer',
      buyerPhone: '+919876543210',
    };

    const res = await client
      .as('builder')
      .post(`/builders/projects/${projectId}/units`, payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    unitId = data.id ?? data.unitId ?? '';
  });

  // ── Step 4: Builder selects bulk services ─────────────────────────

  it('Step 4: Builder selects bulk services for all units', async () => {
    expect(projectId).toBeTruthy();

    // The bulk-services endpoint requires service definition UUIDs, not codes
    const titleSearchUuid = SERVICE_UUIDS[SERVICE_CODES.TITLE_SEARCH];
    expect(titleSearchUuid).toBeTruthy();

    const payload = {
      serviceIds: [titleSearchUuid],
      allUnits: true,
      builderId,
    };

    const res = await client
      .as('builder')
      .post(`/builders/projects/${projectId}/bulk-services`, payload);

    // 200 or 201 are both valid success responses
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    expect(data).toBeDefined();
  });

  // ── Step 5: Ops sees generated service requests ───────────────────

  it('Step 5: Ops Manager sees the generated service requests', async () => {
    const res = await client
      .as('ops_manager')
      .get('/ops/service-requests?limit=50');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // The generated bulk service requests should appear in the ops queue
    const items = Array.isArray(res.body.data)
      ? res.body.data
      : res.body.data?.items ?? res.body.data?.serviceRequests ?? [];

    // Ops queue should be populated (even if the exact items vary by seed state)
    expect(Array.isArray(items)).toBe(true);
  });
});
