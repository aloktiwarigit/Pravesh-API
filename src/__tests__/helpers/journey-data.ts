/**
 * Journey test constants and factories.
 *
 * IMPORTANT: The user IDs and service codes below must match the seed data
 * created by `npm run seed`. Update these if your seed uses different values.
 */

/**
 * Lucknow city ID — resolved dynamically at test startup.
 * Falls back to the deterministic seed value if resolution hasn't run yet.
 */
export const LUCKNOW_CITY_ID_SEED = 'c842d713-59f0-44c3-adc9-8ff7809ac5c4';
export let LUCKNOW_CITY_ID = LUCKNOW_CITY_ID_SEED;

/** Called once by createJourneyClient to resolve the real city ID from the API. */
export function setLucknowCityId(id: string): void {
  LUCKNOW_CITY_ID = id;
}

/**
 * Firebase UIDs for each test role.
 * These must correspond to User records in the seeded database.
 */
export const USERS = {
  customer: 'test_customer_001',
  agent: 'test_agent_001',
  ops_manager: 'test_ops_001',
  dealer: 'test_dealer_001',
  lawyer: 'test_lawyer_001',
  builder: 'test_builder_001',
  franchise_owner: 'test_franchise_001',
  support: 'test_support_001',
  admin: 'test_superadmin_001',
} as const;

export type RoleName = keyof typeof USERS;

/**
 * Known service definition codes/IDs from the seed catalog.
 * Update if your seed uses different identifiers.
 */
export const SERVICE_CODES = {
  TITLE_SEARCH: 'PRE-001',
  MUTATION: 'POST-001',
} as const;

/**
 * Resolved service definition UUIDs (populated at runtime).
 * The bulk-services endpoint requires UUIDs, not service codes.
 */
export const SERVICE_UUIDS: Record<string, string> = {};

/** Called once to populate SERVICE_UUIDS from the database. */
export async function resolveServiceUuids(): Promise<void> {
  try {
    const { prisma } = await import('../../shared/prisma/client');
    const defs = await (prisma as any).$queryRawUnsafe(
      `SELECT id, code FROM service_definitions WHERE code IN ('PRE-001', 'POST-001')`,
    );
    for (const d of defs as any[]) {
      SERVICE_UUIDS[d.code] = d.id;
    }
  } catch {
    // Service definitions may not be seeded yet
  }
}

/** Monotonically increasing counter for unique tags within a process. */
let _seq = 0;

/** Returns a unique tag for this test run (e.g., `J1740700000000-1`). */
export function testTag(): string {
  return `J${Date.now()}-${++_seq}`;
}

/**
 * Builds a service-request payload with a unique `propertyLocation`.
 * The 'Journey Test' prefix is used by cleanup to identify test data.
 */
export function buildServiceRequestPayload(overrides?: Record<string, unknown>) {
  const tag = testTag();
  return {
    serviceId: SERVICE_CODES.TITLE_SEARCH,
    propertyType: 'APARTMENT',
    propertyLocation: `Journey Test Property ${tag}`,
    ownershipStatus: 'SELF_OWNED',
    ...overrides,
  };
}

/**
 * Builds a support-ticket payload.
 * Uses TicketCategory enum values from the Prisma schema.
 */
export function buildSupportTicketPayload(overrides?: Record<string, unknown>) {
  const tag = testTag();
  return {
    category: 'GENERAL_INQUIRY',
    priority: 'NORMAL',
    subject: `Journey Test Ticket ${tag}`,
    description: `Automated journey test ticket created at ${new Date().toISOString()}`,
    ...overrides,
  };
}

/**
 * Builds a legal-case payload.
 * Requires a valid serviceRequestId and lawyerId from the test context.
 */
export function buildLegalCasePayload(
  serviceRequestId: string,
  lawyerId: string,
  overrides?: Record<string, unknown>,
) {
  return {
    serviceRequestId,
    requiredExpertise: 'TITLE_OPINIONS',
    lawyerId,
    issueSummary: 'Journey Test — automated legal case for cross-role validation',
    caseFeeInPaise: 500000,
    casePriority: 'NORMAL',
    ...overrides,
  };
}

/**
 * Builds a legal-opinion payload.
 */
export function buildLegalOpinionPayload(
  caseId: string,
  overrides?: Record<string, unknown>,
) {
  return {
    caseId,
    opinionDocUrl: 'https://example.com/journey-test-opinion.pdf',
    opinionType: 'FAVORABLE',
    summary: 'Journey Test — automated opinion submission',
    ...overrides,
  };
}
