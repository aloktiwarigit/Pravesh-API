/**
 * Journey 1: Service Request Lifecycle ★ (most critical)
 *
 * Validates the core business flow:
 *   Customer creates request → Ops sees it → Ops assigns agent →
 *   Agent processes through statuses → Agent collects payment →
 *   Agent completes → Customer verifies → Customer rates
 *
 * Roles: Customer, Ops Manager, Agent (3 roles, 9 steps)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { createJourneyClient, JourneyClient } from '../helpers/journey-client';
import { buildServiceRequestPayload, LUCKNOW_CITY_ID, USERS } from '../helpers/journey-data';
import { cleanupJourneyData, disconnectCleanup } from '../helpers/journey-cleanup';

describe('Journey 1: Service Request Lifecycle', () => {
  let client: JourneyClient;

  // Shared state across steps
  let serviceRequestId: string;
  let serviceInstanceId: string;
  let requestNumber: string;
  let agentDbId: string;
  let taskId: string;

  beforeAll(async () => {
    client = await createJourneyClient();

    // Resolve the Agent table PK for assignment.
    // The manual assignment endpoint requires the Agent.id (UUID), not the firebase UID.
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

    if (!agentDbId) {
      console.warn(
        '[Journey 1] No agent found in Lucknow. ' +
          'Ensure seed data includes an Agent record linked to a Lucknow user.',
      );
    }
  }, 30_000);

  afterAll(async () => {
    await cleanupJourneyData();
    await disconnectCleanup();
  }, 15_000);

  // ── Step 1: Customer creates service request ─────────────────────

  it('Step 1: Customer creates a service request', async () => {
    const payload = buildServiceRequestPayload();

    const res = await client.as('customer').post('/service-requests', payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    serviceRequestId = data.id ?? data.serviceRequestId ?? data.requestId;
    serviceInstanceId = data.serviceInstanceId ?? data.instanceId ?? '';
    requestNumber = data.requestNumber ?? data.number ?? '';

    expect(serviceRequestId).toBeTruthy();
  });

  // ── Step 2: Ops sees the pending request ─────────────────────────

  it('Step 2: Ops Manager sees the pending request', async () => {
    const res = await client
      .as('ops_manager')
      .get('/ops/service-requests?status=pending&limit=50');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // The created request should appear in the ops queue
    const items = Array.isArray(res.body.data)
      ? res.body.data
      : res.body.data?.items ?? res.body.data?.serviceRequests ?? [];

    const found = items.some(
      (r: any) => r.id === serviceRequestId || r.serviceRequestId === serviceRequestId,
    );
    expect(found).toBe(true);
  });

  // ── Step 3: Ops assigns an agent ─────────────────────────────────

  it('Step 3: Ops Manager assigns an agent', async () => {
    expect(agentDbId).toBeTruthy();

    const res = await client.as('ops_manager').post('/agents/assignments/manual', {
      serviceRequestId,
      agentId: agentDbId,
    });

    // Accept 200 or 201 — both indicate success
    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });

  // ── Step 4: Agent sees the assigned task ─────────────────────────

  it('Step 4: Agent sees the assigned task', async () => {
    const res = await client.as('agent').get('/agents/tasks?status=assigned&limit=50');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const tasks = Array.isArray(res.body.data)
      ? res.body.data
      : res.body.data?.items ?? res.body.data?.tasks ?? [];

    // Tasks ARE service requests — the task ID is the service request's own `id`
    const task = tasks.find(
      (t: any) =>
        t.id === serviceRequestId ||
        t.serviceRequestId === serviceRequestId,
    );
    expect(task).toBeTruthy();
    // taskId = service request ID (since agent tasks ARE service requests)
    taskId = task.id;
    expect(taskId).toBeTruthy();
  });

  // ── Step 5: Agent progresses through statuses ────────────────────

  it('Step 5: Agent progresses through task statuses', async () => {
    expect(taskId).toBeTruthy();

    const transitions = [
      'pending_contact',
      'contacted',
      'scope_confirmed',
      'awaiting_payment',
      'in_progress',
    ];

    for (const newStatus of transitions) {
      const res = await client
        .as('agent')
        .patch(`/agents/tasks/${taskId}/status`, {
          newStatus,
          gpsLat: 26.8467,
          gpsLng: 80.9462,
          notes: `Journey test transition to ${newStatus}`,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    }
  });

  // ── Step 6: Agent collects cash payment ──────────────────────────

  it('Step 6: Agent collects cash payment', async () => {
    const res = await client.as('agent').post('/agents/cash/receipts', {
      receiptId: uuidv4(),
      taskId,
      serviceRequestId,
      amountPaise: '500000',
      customerName: 'Journey Test Customer',
      serviceName: 'Title Search',
      gpsLat: 26.8467,
      gpsLng: 80.9462,
      signatureHash: 'journey-test-signature-hash',
      clientTimestamp: new Date().toISOString(),
    });

    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });

  // ── Step 7: Agent completes the task ─────────────────────────────

  it('Step 7: Agent completes the task', async () => {
    const res = await client.as('agent').patch(`/agents/tasks/${taskId}/status`, {
      newStatus: 'completed',
      gpsLat: 26.8467,
      gpsLng: 80.9462,
      notes: 'Journey test — task completed',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ── Step 8: Customer verifies completion ─────────────────────────

  it('Step 8: Customer sees the request as completed', async () => {
    const res = await client
      .as('customer')
      .get(`/service-requests/${serviceRequestId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    // The status should reflect completion (exact value depends on business logic)
    const status = (
      data.status ??
      data.serviceRequest?.status ??
      ''
    ).toLowerCase();
    expect(status).toMatch(/complet/i);
  });

  // ── Step 9: Customer rates the service ───────────────────────────

  it('Step 9: Customer rates the service', async () => {
    const res = await client.as('customer').post('/ratings', {
      rating: 5,
      serviceRequestId,
      reviewText: 'Journey test — excellent service',
    });

    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);
  });
});
