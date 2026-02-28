/**
 * Journey 3: Legal Case Lifecycle
 *
 * Validates the lawyer/legal case flow:
 *   Ops creates legal case → Lawyer sees assignment → Lawyer accepts →
 *   Lawyer submits opinion → Ops reviews & approves opinion →
 *   Ops delivers opinion → Lawyer reviews case details →
 *   Ops completes case → Lawyer sees earnings
 *
 * Roles: Ops Manager, Lawyer (2 roles, 9 steps)
 *
 * Prerequisites: A completed service request must exist (or the legal case
 * creation must accept a service request ID). The seed data must include
 * a Lawyer record linked to the test_lawyer_001 user.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createJourneyClient, JourneyClient } from '../helpers/journey-client';
import {
  buildServiceRequestPayload,
  buildLegalCasePayload,
  buildLegalOpinionPayload,
  LUCKNOW_CITY_ID,
} from '../helpers/journey-data';
import { cleanupJourneyData, disconnectCleanup } from '../helpers/journey-cleanup';

describe('Journey 3: Legal Case Lifecycle', () => {
  let client: JourneyClient;

  // Shared state
  let serviceRequestId: string;
  let lawyerDbId: string;
  let legalCaseId: string;
  let opinionId: string;

  beforeAll(async () => {
    client = await createJourneyClient();

    // Create a service request to attach the legal case to
    const srRes = await client
      .as('customer')
      .post('/service-requests', buildServiceRequestPayload());
    if (srRes.status === 201) {
      serviceRequestId = srRes.body.data.id ?? srRes.body.data.serviceRequestId;
    }

    // Resolve lawyer DB ID. The legal-case creation needs the Lawyer table PK.
    const lawyerRes = await client.as('lawyer').get('/lawyers/me');
    if (lawyerRes.status === 200) {
      const data = lawyerRes.body.data ?? {};
      lawyerDbId = data.id ?? data.lawyerId ?? '';
    }

    if (!lawyerDbId) {
      console.warn(
        '[Journey 3] No lawyer record found. ' +
          'Ensure seed data includes a Lawyer record for test_lawyer_001.',
      );
    }
  }, 30_000);

  afterAll(async () => {
    await cleanupJourneyData();
    await disconnectCleanup();
  }, 15_000);

  // ── Step 1: Ops creates a legal case ─────────────────────────────

  it('Step 1: Ops Manager creates a legal case', async () => {
    expect(serviceRequestId).toBeTruthy();
    expect(lawyerDbId).toBeTruthy();

    const payload = buildLegalCasePayload(serviceRequestId, lawyerDbId);
    const res = await client.as('ops_manager').post('/legal-cases', payload);

    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    legalCaseId = data.id ?? data.caseId ?? data.legalCaseId;
    expect(legalCaseId).toBeTruthy();
  });

  // ── Step 2: Lawyer sees the assigned case ────────────────────────

  it('Step 2: Lawyer sees assigned case in my-cases', async () => {
    const res = await client.as('lawyer').get('/lawyers/my-cases');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const cases = Array.isArray(res.body.data)
      ? res.body.data
      : res.body.data?.items ?? res.body.data?.cases ?? [];

    const found = cases.some(
      (c: any) => c.id === legalCaseId || c.caseId === legalCaseId,
    );
    expect(found).toBe(true);
  });

  // ── Step 3: Lawyer accepts the case ──────────────────────────────

  it('Step 3: Lawyer accepts the case', async () => {
    const res = await client
      .as('lawyer')
      .post(`/legal-cases/${legalCaseId}/accept`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ── Step 4: Lawyer submits opinion ───────────────────────────────

  it('Step 4: Lawyer submits legal opinion', async () => {
    const payload = buildLegalOpinionPayload(legalCaseId);
    const res = await client.as('lawyer').post('/legal-opinions', payload);

    expect([200, 201]).toContain(res.status);
    expect(res.body.success).toBe(true);

    // Capture opinionId for review & delivery steps
    const data = res.body.data;
    opinionId = data.id ?? data.opinionId ?? '';
    expect(opinionId).toBeTruthy();
  });

  // ── Step 5: Ops reviews and approves the opinion ─────────────────

  it('Step 5: Ops Manager approves the legal opinion', async () => {
    expect(opinionId).toBeTruthy();

    const res = await client.as('ops_manager').post('/legal-opinions/review', {
      opinionId,
      action: 'approve',
      reviewNotes: 'Journey test — opinion approved by ops',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ── Step 6: Ops delivers the opinion ─────────────────────────────

  it('Step 6: Ops Manager delivers the opinion', async () => {
    expect(opinionId).toBeTruthy();

    const res = await client
      .as('ops_manager')
      .post(`/legal-opinions/${opinionId}/deliver`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ── Step 7: Lawyer reviews the case details ──────────────────────

  it('Step 7: Lawyer reviews case details', async () => {
    // Case details endpoint checks lawyer ownership — use the assigned lawyer
    const res = await client
      .as('lawyer')
      .get(`/legal-cases/${legalCaseId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeDefined();
  });

  // ── Step 8: Ops completes the case ───────────────────────────────

  it('Step 8: Ops Manager completes the case', async () => {
    const res = await client
      .as('ops_manager')
      .post(`/legal-cases/${legalCaseId}/complete`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ── Step 9: Lawyer sees earnings ─────────────────────────────────

  it('Step 9: Lawyer sees earnings', async () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    const res = await client
      .as('lawyer')
      .get(`/lawyers/earnings?month=${month}&year=${year}`);

    // Earnings endpoint should work even if no payouts yet
    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
    }
  });
});
