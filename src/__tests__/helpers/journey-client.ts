/**
 * Role-switching HTTP client for journey tests.
 *
 * Usage:
 *   const client = await createJourneyClient();
 *   const res = await client.as('customer').post('/service-requests', body);
 *   const ops = await client.as('ops_manager').get('/ops/service-requests');
 */
import supertest from 'supertest';
import type { Test } from 'supertest';
import { USERS, LUCKNOW_CITY_ID, setLucknowCityId, resolveServiceUuids, type RoleName } from './journey-data';

const API_PREFIX = '/api/v1';

// ── Role configuration ────────────────────────────────────────────────

interface RoleConfig {
  userId: string;
  role: string;
  hasCityScope: boolean;
  email: string;
}

/**
 * Role strings MUST be lowercase to match authorize() middleware calls.
 * The seed data also stores roles as lowercase (e.g., 'customer', 'agent').
 *
 * City ID is NOT stored here — it's read lazily from LUCKNOW_CITY_ID
 * (which is resolved dynamically at startup).
 */
const ROLES: Record<RoleName, RoleConfig> = {
  customer:        { userId: USERS.customer,        role: 'customer',        hasCityScope: true,  email: 'journey_customer@test.local' },
  agent:           { userId: USERS.agent,            role: 'agent',           hasCityScope: true,  email: 'journey_agent@test.local' },
  ops_manager:     { userId: USERS.ops_manager,      role: 'ops_manager',     hasCityScope: true,  email: 'journey_ops@test.local' },
  dealer:          { userId: USERS.dealer,           role: 'dealer',          hasCityScope: true,  email: 'journey_dealer@test.local' },
  lawyer:          { userId: USERS.lawyer,           role: 'lawyer',          hasCityScope: true,  email: 'journey_lawyer@test.local' },
  builder:         { userId: USERS.builder,          role: 'builder',         hasCityScope: true,  email: 'journey_builder@test.local' },
  franchise_owner: { userId: USERS.franchise_owner,  role: 'franchise_owner', hasCityScope: true,  email: 'journey_franchise@test.local' },
  support:         { userId: USERS.support,          role: 'support',         hasCityScope: true,  email: 'journey_support@test.local' },
  admin:           { userId: USERS.admin,            role: 'super_admin',     hasCityScope: false, email: 'journey_admin@test.local' },
};

function makeHeaders(config: RoleConfig): Record<string, string> {
  const h: Record<string, string> = {
    'x-dev-user-id': config.userId,
    'x-dev-role': config.role,
    'x-dev-email': config.email,
  };
  // Read LUCKNOW_CITY_ID lazily so it picks up the dynamically resolved value
  if (config.hasCityScope) {
    h['x-dev-city-id'] = LUCKNOW_CITY_ID;
  }
  return h;
}

// ── Role-scoped request builder ───────────────────────────────────────

export class RoleClient {
  constructor(
    private agent: supertest.Agent,
    private headers: Record<string, string>,
  ) {}

  get(path: string): Test {
    return this.agent.get(`${API_PREFIX}${path}`).set(this.headers);
  }

  post(path: string, body?: unknown): Test {
    const req = this.agent.post(`${API_PREFIX}${path}`).set(this.headers);
    return body !== undefined ? req.send(body as object) : req;
  }

  patch(path: string, body?: unknown): Test {
    const req = this.agent.patch(`${API_PREFIX}${path}`).set(this.headers);
    return body !== undefined ? req.send(body as object) : req;
  }

  put(path: string, body?: unknown): Test {
    const req = this.agent.put(`${API_PREFIX}${path}`).set(this.headers);
    return body !== undefined ? req.send(body as object) : req;
  }

  delete(path: string): Test {
    return this.agent.delete(`${API_PREFIX}${path}`).set(this.headers);
  }
}

// ── Journey client ────────────────────────────────────────────────────

export class JourneyClient {
  constructor(private agent: supertest.Agent) {}

  /** Switch to a role. Returns a RoleClient with appropriate auth headers. */
  as(role: RoleName): RoleClient {
    const config = ROLES[role];
    if (!config) throw new Error(`Unknown journey role: ${role}`);
    return new RoleClient(this.agent, makeHeaders(config));
  }
}

/**
 * Resolve Lucknow's actual city ID by calling GET /api/v1/cities.
 * Updates the shared LUCKNOW_CITY_ID so all subsequent requests use it.
 */
async function resolveLucknowCityId(agent: supertest.Agent): Promise<void> {
  try {
    const res = await agent
      .get(`${API_PREFIX}/cities`)
      .set({ 'x-dev-user-id': USERS.admin, 'x-dev-role': 'super_admin', 'x-dev-email': 'resolve@test.local' });

    if (res.status === 200 && res.body.data) {
      const cities = Array.isArray(res.body.data)
        ? res.body.data
        : res.body.data?.items ?? res.body.data?.cities ?? [];

      const lucknow = cities.find(
        (c: any) => (c.cityName ?? c.name ?? '').toLowerCase() === 'lucknow',
      );
      if (lucknow?.id) {
        setLucknowCityId(lucknow.id);
        return;
      }
    }
  } catch {
    // Fall through to seed default
  }
  console.warn('[journey-client] Could not resolve Lucknow city ID from API, using seed default');
}

/**
 * Creates a JourneyClient.
 *
 * - If `JOURNEY_API_URL` is set, tests run against that remote server.
 * - Otherwise, the Express app is imported in-process.
 * - On first call, resolves Lucknow's city ID dynamically from the DB.
 */
let _clientPromise: Promise<JourneyClient> | null = null;

export function createJourneyClient(): Promise<JourneyClient> {
  if (_clientPromise) return _clientPromise;

  _clientPromise = (async () => {
    // Ensure dev auth bypass is enabled for header-based auth
    process.env.DEV_AUTH_BYPASS = 'true';

    const remoteUrl = process.env.JOURNEY_API_URL;
    let agent: supertest.Agent;

    if (remoteUrl) {
      agent = supertest.agent(remoteUrl);
    } else {
      // In-process mode: dynamically import the app
      const { app, bossReadyPromise } = await import('../../server');
      agent = supertest.agent(app);
      // Wait for pg-boss queues to be created before tests can send jobs
      if (bossReadyPromise) await bossReadyPromise;
    }

    // Resolve the real Lucknow city ID before any tests use it
    await resolveLucknowCityId(agent);

    // Resolve service definition UUIDs for bulk service tests
    await resolveServiceUuids();

    return new JourneyClient(agent);
  })();

  return _clientPromise;
}
