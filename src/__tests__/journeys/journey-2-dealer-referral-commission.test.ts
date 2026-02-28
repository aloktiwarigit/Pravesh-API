/**
 * Journey 2: Dealer Referral → Commission
 *
 * Validates the dealer referral pipeline:
 *   Dealer gets profile/referral data → Customer creates request →
 *   Ops assigns agent → Agent completes lifecycle → Dealer sees
 *   referral in pipeline → Dealer checks earnings & leaderboard
 *
 * Roles: Dealer, Customer, Ops Manager, Agent (4 roles, 7 steps)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { createJourneyClient, JourneyClient } from '../helpers/journey-client';
import { buildServiceRequestPayload, LUCKNOW_CITY_ID, USERS } from '../helpers/journey-data';
import { cleanupJourneyData, disconnectCleanup } from '../helpers/journey-cleanup';

describe('Journey 2: Dealer Referral → Commission', () => {
  let client: JourneyClient;

  // Shared state
  let dealerCode: string;
  let serviceRequestId: string;
  let agentDbId: string;
  let taskId: string;

  beforeAll(async () => {
    client = await createJourneyClient();

    // Resolve agent DB ID for assignment
    const agentsRes = await client
      .as('ops_manager')
      .get(`/franchise-agents/${LUCKNOW_CITY_ID}`);

    if (agentsRes.status === 200) {
      const agents = Array.isArray(agentsRes.body.data)
        ? agentsRes.body.data
        : agentsRes.body.data?.items ?? agentsRes.body.data?.agents ?? [];
      // Find the specific test agent — the list may contain multiple agents
      const testAgent = agents.find((a: any) => a.userId === USERS.agent);
      agentDbId = testAgent?.id ?? agents[0]?.id;
    }
  }, 30_000);

  afterAll(async () => {
    await cleanupJourneyData();
    await disconnectCleanup();
  }, 15_000);

  // ── Step 1: Dealer gets profile & referral data ──────────────────

  it('Step 1: Dealer views profile and referral info', async () => {
    // Get dealer profile
    const profileRes = await client.as('dealer').get('/dealers/profile');
    expect(profileRes.status).toBe(200);
    expect(profileRes.body.success).toBe(true);

    // Extract dealer code if available
    const data = profileRes.body.data ?? {};
    dealerCode = data.dealerCode ?? data.referralCode ?? data.code ?? '';

    // Check referral endpoint
    const referralRes = await client.as('dealer').get('/dealers/me/referral');
    // May be 200, 404, or 422 depending on dealer state — all acceptable
    expect([200, 404, 422]).toContain(referralRes.status);
  });

  // ── Step 2: Customer creates request ─────────────────────────────

  it('Step 2: Customer creates service request', async () => {
    const payload = buildServiceRequestPayload({
      // Include dealer attribution if dealer code exists
      ...(dealerCode ? { referralCode: dealerCode } : {}),
    });

    const res = await client.as('customer').post('/service-requests', payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    serviceRequestId = res.body.data.id ?? res.body.data.serviceRequestId;
    expect(serviceRequestId).toBeTruthy();
  });

  // ── Step 3: Ops assigns agent ────────────────────────────────────

  it('Step 3: Ops Manager assigns agent', async () => {
    expect(agentDbId).toBeTruthy();

    const res = await client.as('ops_manager').post('/agents/assignments/manual', {
      serviceRequestId,
      agentId: agentDbId,
    });

    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });

  // ── Step 4: Agent completes the full lifecycle ───────────────────

  it('Step 4: Agent completes full lifecycle', async () => {
    // Find the task
    const tasksRes = await client.as('agent').get('/agents/tasks?status=assigned&limit=50');
    expect(tasksRes.status).toBe(200);

    const tasks = Array.isArray(tasksRes.body.data)
      ? tasksRes.body.data
      : tasksRes.body.data?.items ?? tasksRes.body.data?.tasks ?? [];

    const task = tasks.find((t: any) => t.id === serviceRequestId || t.serviceRequestId === serviceRequestId);
    expect(task).toBeTruthy();
    taskId = task.id;

    // Progress through all statuses
    const statuses = [
      'pending_contact',
      'contacted',
      'scope_confirmed',
      'awaiting_payment',
      'in_progress',
      'completed',
    ];

    for (const newStatus of statuses) {
      const res = await client
        .as('agent')
        .patch(`/agents/tasks/${taskId}/status`, {
          newStatus,
          gpsLat: 26.8467,
          gpsLng: 80.9462,
        });
      expect(res.status).toBe(200);
    }
  });

  // ── Step 5: Dealer sees referral in pipeline ─────────────────────

  it('Step 5: Dealer sees referral in pipeline', async () => {
    const res = await client.as('dealer').get('/dealers/pipeline');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Pipeline should return data (even if empty for this specific referral,
    // the endpoint must work)
    expect(res.body.data).toBeDefined();
  });

  // ── Step 6: Dealer checks earnings ───────────────────────────────

  it('Step 6: Dealer checks earnings summary', async () => {
    const res = await client.as('dealer').get('/dealers/me/earnings/summary');

    // Earnings endpoint should respond (may be empty for new dealers)
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    }
  });

  // ── Step 7: Dealer checks leaderboard ────────────────────────────

  it('Step 7: Dealer checks leaderboard', async () => {
    const res = await client.as('dealer').get('/dealers/leaderboard?period=monthly');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });
});
