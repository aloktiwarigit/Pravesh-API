/**
 * Integration tests: Authentication & Authorization flow
 *
 * Exercises the full Express middleware chain (authenticate -> authorize)
 * using a real HTTP request via supertest.  Firebase admin is mocked so
 * no external service is needed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express, { Request, Response } from 'express';
import { createTestApp, createMockFirebaseAuth, TEST_USERS } from '../helpers/test-app';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';

// ---------------------------------------------------------------------------
// Mock firebase-admin globally (same pattern as middleware/__tests__)
// ---------------------------------------------------------------------------
const mockFirebaseAuth = createMockFirebaseAuth();

vi.mock('firebase-admin', () => ({
  default: {
    auth: vi.fn(() => mockFirebaseAuth),
  },
}));

describe('[P0] Auth Flow Integration', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Default to production mode so DEV_AUTH_BYPASS is off
    process.env.NODE_ENV = 'production';
    delete process.env.DEV_AUTH_BYPASS;
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // -----------------------------------------------------------------------
  // Helper: build a test app with customer and ops routes
  // -----------------------------------------------------------------------
  function buildApp() {
    return createTestApp({
      routes(app) {
        // Public health endpoint (no auth)
        app.get('/health', (_req: Request, res: Response) => {
          res.json({ success: true, data: { status: 'healthy' } });
        });

        // Customer-accessible route
        app.get(
          '/api/v1/my-services',
          authenticate,
          authorize('CUSTOMER', 'SUPER_ADMIN'),
          (_req: Request, res: Response) => {
            res.json({ success: true, data: { services: [] } });
          },
        );

        // Ops-only route
        app.get(
          '/api/v1/ops/dashboard',
          authenticate,
          authorize('OPS_MANAGER', 'SUPER_ADMIN'),
          (_req: Request, res: Response) => {
            res.json({ success: true, data: { dashboard: {} } });
          },
        );
      },
    });
  }

  // -----------------------------------------------------------------------
  // 1. Unauthenticated request returns 401
  // -----------------------------------------------------------------------
  it('returns 401 when no Authorization header is present', async () => {
    // Given: a request with no credentials
    const { request } = buildApp();

    // When: hitting a protected route
    const res = await request.get('/api/v1/my-services');

    // Then: 401 with proper error code
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_TOKEN_INVALID');
  });

  // -----------------------------------------------------------------------
  // 2. Invalid token returns 401
  // -----------------------------------------------------------------------
  it('returns 401 when Firebase rejects the token', async () => {
    // Given: Firebase will reject the token
    mockFirebaseAuth.failWith('Token expired');
    const { request } = buildApp();

    // When: request with an invalid Bearer token
    const res = await request
      .get('/api/v1/my-services')
      .set('Authorization', 'Bearer expired-token-xyz');

    // Then: 401 with auth error
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_TOKEN_INVALID');
    expect(mockFirebaseAuth.verifyIdToken).toHaveBeenCalledWith('expired-token-xyz');
  });

  // -----------------------------------------------------------------------
  // 3. Valid token with CUSTOMER role can access customer routes
  // -----------------------------------------------------------------------
  it('allows CUSTOMER role to access customer routes', async () => {
    // Given: Firebase returns valid CUSTOMER claims
    mockFirebaseAuth.succeedWith({
      uid: 'cust-001',
      email: 'alice@example.com',
      role: 'CUSTOMER',
      cityId: 'lucknow',
      permissions: ['read:services'],
    });
    const { request } = buildApp();

    // When: request with valid Bearer token
    const res = await request
      .get('/api/v1/my-services')
      .set('Authorization', 'Bearer valid-customer-token');

    // Then: 200 success
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.services).toBeDefined();
  });

  // -----------------------------------------------------------------------
  // 4. CUSTOMER cannot access ops routes -> 403
  // -----------------------------------------------------------------------
  it('returns 403 when CUSTOMER tries to access ops routes', async () => {
    // Given: Firebase returns CUSTOMER claims
    mockFirebaseAuth.succeedWith({
      uid: 'cust-001',
      email: 'alice@example.com',
      role: 'CUSTOMER',
      cityId: 'lucknow',
      permissions: [],
    });
    const { request } = buildApp();

    // When: CUSTOMER hits an ops-only endpoint
    const res = await request
      .get('/api/v1/ops/dashboard')
      .set('Authorization', 'Bearer valid-customer-token');

    // Then: 403 with role error
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('AUTH_INSUFFICIENT_ROLE');
    expect(res.body.error.message).toContain('CUSTOMER');
  });

  // -----------------------------------------------------------------------
  // 5. SUPER_ADMIN can access any route
  // -----------------------------------------------------------------------
  it('allows SUPER_ADMIN to access customer routes', async () => {
    // Given: Firebase returns SUPER_ADMIN claims
    mockFirebaseAuth.succeedWith({
      uid: 'admin-001',
      email: 'admin@example.com',
      role: 'SUPER_ADMIN',
      permissions: ['*'],
    });
    const { request } = buildApp();

    // When: admin hits customer route
    const res = await request
      .get('/api/v1/my-services')
      .set('Authorization', 'Bearer valid-admin-token');

    // Then: 200 (SUPER_ADMIN is in the allowedRoles list)
    expect(res.status).toBe(200);
  });

  it('allows SUPER_ADMIN to access ops routes', async () => {
    // Given: Firebase returns SUPER_ADMIN claims
    mockFirebaseAuth.succeedWith({
      uid: 'admin-001',
      email: 'admin@example.com',
      role: 'SUPER_ADMIN',
      permissions: ['*'],
    });
    const { request } = buildApp();

    // When: admin hits ops route
    const res = await request
      .get('/api/v1/ops/dashboard')
      .set('Authorization', 'Bearer valid-admin-token');

    // Then: 200
    expect(res.status).toBe(200);
  });

  // -----------------------------------------------------------------------
  // 6. DEV_AUTH_BYPASS works in development mode
  // -----------------------------------------------------------------------
  it('allows DEV_AUTH_BYPASS headers in development mode', async () => {
    // Given: development mode with bypass enabled
    process.env.NODE_ENV = 'development';
    process.env.DEV_AUTH_BYPASS = 'true';
    const { request } = buildApp();

    // When: request with dev headers (no Bearer token needed)
    const res = await request
      .get('/api/v1/my-services')
      .set(TEST_USERS.customer);

    // Then: 200 success
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // Firebase verifyIdToken should NOT be called
    expect(mockFirebaseAuth.verifyIdToken).not.toHaveBeenCalled();
  });

  it('rejects DEV_AUTH_BYPASS headers in production mode', async () => {
    // Given: production mode
    process.env.NODE_ENV = 'production';
    process.env.DEV_AUTH_BYPASS = 'true';
    const { request } = buildApp();

    // When: request with dev headers
    const res = await request
      .get('/api/v1/my-services')
      .set(TEST_USERS.customer);

    // Then: 401 (bypass is ignored in production)
    expect(res.status).toBe(401);
  });

  it('allows DEV_AUTH_BYPASS in test mode', async () => {
    // Given: test mode with bypass
    process.env.NODE_ENV = 'test';
    process.env.DEV_AUTH_BYPASS = 'true';
    const { request } = buildApp();

    // When: request with super admin dev headers on ops route
    const res = await request
      .get('/api/v1/ops/dashboard')
      .set(TEST_USERS.superAdmin);

    // Then: 200
    expect(res.status).toBe(200);
  });

  // -----------------------------------------------------------------------
  // Edge cases
  // -----------------------------------------------------------------------
  it('returns 403 when token has no role assigned', async () => {
    // Given: valid token but no role claim
    mockFirebaseAuth.succeedWith({
      uid: 'user-no-role',
      email: 'norole@example.com',
      role: '',
    });
    const { request } = buildApp();

    // When: hitting protected route
    const res = await request
      .get('/api/v1/my-services')
      .set('Authorization', 'Bearer token-no-role');

    // Then: 403 (user has no role)
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('AUTH_NO_ROLE');
  });

  it('returns 401 for non-Bearer auth schemes', async () => {
    // Given: Basic auth instead of Bearer
    const { request } = buildApp();

    // When: sending Basic auth
    const res = await request
      .get('/api/v1/my-services')
      .set('Authorization', 'Basic dXNlcjpwYXNz');

    // Then: 401
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('AUTH_TOKEN_INVALID');
  });
});
