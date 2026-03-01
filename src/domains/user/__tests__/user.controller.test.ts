/**
 * Integration tests for the User Controller (HTTP layer).
 * Covers: GET /me, PUT /me, GET /search, GET /:userId
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestApp } from '../../../__tests__/helpers/test-app';
import { createUserController } from '../user.controller';

// ---------------------------------------------------------------------------
// Mock Prisma factory
// ---------------------------------------------------------------------------
function createMockPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  } as any;
}

// ---------------------------------------------------------------------------
// Build test app
// ---------------------------------------------------------------------------
function buildApp(mockPrisma: any) {
  return createTestApp({
    routes(app) {
      app.use('/api/v1/users', createUserController(mockPrisma));
    },
  });
}

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('User Controller', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.DEV_AUTH_BYPASS = 'true';
  });

  afterEach(() => {
    delete process.env.DEV_AUTH_BYPASS;
  });

  // ==========================================================================
  // GET /me
  // ==========================================================================

  describe('GET /api/v1/users/me', () => {
    test('returns user profile for authenticated user', async () => {
      const { request } = buildApp(mockPrisma);
      const user = {
        id: VALID_UUID,
        firebaseUid: 'customer-001',
        displayName: 'Test Customer',
        phone: '9876543210',
        status: 'ACTIVE',
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const res = await request
        .get('/api/v1/users/me')
        .set('x-dev-user-id', 'customer-001')
        .set('x-dev-role', 'customer');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.firebaseUid).toBe('customer-001');
    });

    test('returns 401 when not authenticated', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request.get('/api/v1/users/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('returns 404 when user not found', async () => {
      const { request } = buildApp(mockPrisma);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request
        .get('/api/v1/users/me')
        .set('x-dev-user-id', 'unknown-user')
        .set('x-dev-role', 'customer');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });
  });

  // ==========================================================================
  // PUT /me
  // ==========================================================================

  describe('PUT /api/v1/users/me', () => {
    test('updates user profile successfully', async () => {
      const { request } = buildApp(mockPrisma);
      const existingUser = { id: VALID_UUID, firebaseUid: 'customer-001' };
      const updatedUser = { ...existingUser, displayName: 'Updated Name' };
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const res = await request
        .put('/api/v1/users/me')
        .set('x-dev-user-id', 'customer-001')
        .set('x-dev-role', 'customer')
        .send({ displayName: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.displayName).toBe('Updated Name');
    });

    test('returns 400 for invalid email format', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request
        .put('/api/v1/users/me')
        .set('x-dev-user-id', 'customer-001')
        .set('x-dev-role', 'customer')
        .send({ email: 'not-an-email' });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_INVALID_INPUT');
    });

    test('returns 400 for invalid languagePref', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request
        .put('/api/v1/users/me')
        .set('x-dev-user-id', 'customer-001')
        .set('x-dev-role', 'customer')
        .send({ languagePref: 'fr' });

      expect(res.status).toBe(400);
    });

    test('accepts valid language preferences en and hi', async () => {
      const { request } = buildApp(mockPrisma);
      const existingUser = { id: VALID_UUID, firebaseUid: 'customer-001' };

      for (const lang of ['en', 'hi']) {
        vi.clearAllMocks();
        mockPrisma.user.findUnique.mockResolvedValue(existingUser);
        mockPrisma.user.update.mockResolvedValue({ ...existingUser, languagePref: lang });

        const res = await request
          .put('/api/v1/users/me')
          .set('x-dev-user-id', 'customer-001')
          .set('x-dev-role', 'customer')
          .send({ languagePref: lang });

        expect(res.status).toBe(200);
      }
    });

    test('returns 400 for empty displayName', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request
        .put('/api/v1/users/me')
        .set('x-dev-user-id', 'customer-001')
        .set('x-dev-role', 'customer')
        .send({ displayName: '' });

      expect(res.status).toBe(400);
    });

    test('returns 401 when not authenticated', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request
        .put('/api/v1/users/me')
        .send({ displayName: 'Test' });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // GET /search — Admin only
  // ==========================================================================

  describe('GET /api/v1/users/search', () => {
    test('allows super_admin to search users', async () => {
      const { request } = buildApp(mockPrisma);
      const users = [
        { id: 'u-1', displayName: 'User One', phone: '9111111111' },
        { id: 'u-2', displayName: 'User Two', phone: '9222222222' },
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);
      mockPrisma.user.count.mockResolvedValue(2);

      const res = await request
        .get('/api/v1/users/search')
        .set('x-dev-user-id', 'admin-001')
        .set('x-dev-role', 'super_admin');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('allows ops to search users', async () => {
      const { request } = buildApp(mockPrisma);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      const res = await request
        .get('/api/v1/users/search')
        .set('x-dev-user-id', 'ops-001')
        .set('x-dev-role', 'ops');

      expect(res.status).toBe(200);
    });

    test('returns 403 for customer role', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request
        .get('/api/v1/users/search')
        .set('x-dev-user-id', 'customer-001')
        .set('x-dev-role', 'customer');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('AUTH_INSUFFICIENT_ROLE');
    });

    test('returns 401 when not authenticated', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request.get('/api/v1/users/search');

      expect(res.status).toBe(401);
    });

    test('supports query param filters', async () => {
      const { request } = buildApp(mockPrisma);
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      const res = await request
        .get('/api/v1/users/search?query=test&role=customer&status=ACTIVE')
        .set('x-dev-user-id', 'admin-001')
        .set('x-dev-role', 'super_admin');

      expect(res.status).toBe(200);
    });

    test('returns 400 for invalid cityId (non-UUID)', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request
        .get('/api/v1/users/search?cityId=not-a-uuid')
        .set('x-dev-user-id', 'admin-001')
        .set('x-dev-role', 'super_admin');

      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // GET /:userId — Admin only
  // ==========================================================================

  describe('GET /api/v1/users/:userId', () => {
    test('returns user by ID for super_admin', async () => {
      const { request } = buildApp(mockPrisma);
      const user = {
        id: VALID_UUID,
        firebaseUid: 'fb-123',
        displayName: 'Some User',
        status: 'ACTIVE',
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      const res = await request
        .get(`/api/v1/users/${VALID_UUID}`)
        .set('x-dev-user-id', 'admin-001')
        .set('x-dev-role', 'super_admin');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(VALID_UUID);
    });

    test('returns 404 when user not found', async () => {
      const { request } = buildApp(mockPrisma);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request
        .get(`/api/v1/users/${VALID_UUID}`)
        .set('x-dev-user-id', 'admin-001')
        .set('x-dev-role', 'super_admin');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });

    test('returns 403 for non-admin role', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request
        .get(`/api/v1/users/${VALID_UUID}`)
        .set('x-dev-user-id', 'dealer-001')
        .set('x-dev-role', 'dealer');

      expect(res.status).toBe(403);
    });

    test('returns 401 when not authenticated', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request.get(`/api/v1/users/${VALID_UUID}`);

      expect(res.status).toBe(401);
    });
  });
});
