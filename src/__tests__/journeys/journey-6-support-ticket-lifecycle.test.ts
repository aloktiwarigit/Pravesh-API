/**
 * Journey 6: Support Ticket Lifecycle
 *
 * Validates the support ticket flow:
 *   Customer creates ticket → Support sees it in queue →
 *   Support resolves ticket → Customer sees resolved status →
 *   Support checks metrics via the queue endpoint
 *
 * Roles: Customer, Support (2 roles, 5 steps)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createJourneyClient, JourneyClient } from '../helpers/journey-client';
import { buildSupportTicketPayload } from '../helpers/journey-data';
import { cleanupJourneyData, disconnectCleanup } from '../helpers/journey-cleanup';

describe('Journey 6: Support Ticket Lifecycle', () => {
  let client: JourneyClient;

  // Shared state across steps
  let ticketId: string;
  let ticketNumber: string;

  beforeAll(async () => {
    client = await createJourneyClient();
  }, 30_000);

  afterAll(async () => {
    await cleanupJourneyData();
    await disconnectCleanup();
  }, 15_000);

  // ── Step 1: Customer creates a support ticket ─────────────────────

  it('Step 1: Customer creates a support ticket', async () => {
    const payload = buildSupportTicketPayload();

    const res = await client.as('customer').post('/support/tickets', payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const data = res.body.data;
    ticketId = data.id ?? data.ticketId ?? data.supportTicketId;
    ticketNumber = data.ticketNumber ?? data.number ?? data.referenceNumber ?? '';

    expect(ticketId).toBeTruthy();
  });

  // ── Step 2: Support sees the ticket in queue ──────────────────────

  it('Step 2: Support sees the ticket in queue', async () => {
    const res = await client.as('support').get('/support/tickets?limit=50');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const items = Array.isArray(res.body.data)
      ? res.body.data
      : res.body.data?.items ?? res.body.data?.tickets ?? [];

    const found = items.some(
      (t: any) =>
        t.id === ticketId ||
        t.ticketId === ticketId ||
        (ticketNumber && (t.ticketNumber === ticketNumber || t.number === ticketNumber)),
    );
    expect(found).toBe(true);
  });

  // ── Step 3: Support resolves the ticket ──────────────────────────

  it('Step 3: Support resolves the ticket', async () => {
    const res = await client
      .as('support')
      .patch(`/support/tickets/${ticketId}`, { status: 'RESOLVED' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ── Step 4: Customer sees the resolved status ─────────────────────

  it('Step 4: Customer sees resolved status on the ticket', async () => {
    // Try the single-ticket endpoint first; fall back to listing
    const singleRes = await client
      .as('customer')
      .get(`/support/tickets/${ticketId}`);

    if (singleRes.status === 200) {
      expect(singleRes.body.success).toBe(true);
      const data = singleRes.body.data;
      const status = (
        data.status ??
        data.ticket?.status ??
        ''
      ).toUpperCase();
      expect(status).toMatch(/RESOLVED/i);
    } else {
      // Fall back to list endpoint and locate the ticket
      const listRes = await client.as('customer').get('/support/tickets?limit=50');

      expect(listRes.status).toBe(200);
      expect(listRes.body.success).toBe(true);

      const items = Array.isArray(listRes.body.data)
        ? listRes.body.data
        : listRes.body.data?.items ?? listRes.body.data?.tickets ?? [];

      const ticket = items.find(
        (t: any) => t.id === ticketId || t.ticketId === ticketId,
      );
      expect(ticket).toBeTruthy();

      const status = (ticket.status ?? '').toUpperCase();
      expect(status).toMatch(/RESOLVED/i);
    }
  });

  // ── Step 5: Support checks metrics via queue endpoint ────────────

  it('Step 5: Support checks ticket queue metrics', async () => {
    const res = await client.as('support').get('/support/tickets?limit=1');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // The response must carry a data payload (array or paginated object)
    const data = res.body.data;
    expect(data).toBeDefined();
  });
});
