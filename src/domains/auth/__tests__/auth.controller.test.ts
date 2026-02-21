/**
 * Integration tests for the Auth Controller (HTTP layer).
 * Uses supertest + mock Prisma + mock Firebase admin.
 * Covers: POST /register, GET /me, POST /set-roles, PUT /status,
 *         GET /pending, POST /refresh-claims
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestApp } from '../../../__tests__/helpers/test-app';
import { createAuthController } from '../auth.controller';

// ---------------------------------------------------------------------------
// Global mocks
// ---------------------------------------------------------------------------

const mockFirebaseSetClaims = vi.fn().mockResolvedValue(undefined);
vi.mock('firebase-admin', () => ({
  default: {
    auth: vi.fn(() => ({
      setCustomUserClaims: mockFirebaseSetClaims,
      verifyIdToken: vi.fn(),
    })),
  },
}));

// Mock NriDetectionService
vi.mock('../nri-detection.service', () => ({
  NriDetectionService: {
    isNriPhone: vi.fn(() => false),
    getCountryFromPhone: vi.fn(() => null),
  },
}));

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
// Test helpers
// ---------------------------------------------------------------------------
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const ADMIN_UUID = '660e8400-e29b-41d4-a716-446655440001';

function buildApp(mockPrisma: any) {
  return createTestApp({
    routes(app) {
      app.use('/api/v1/auth', createAuthController(mockPrisma));
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Auth Controller', () => {
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
  // POST /register
  // ==========================================================================

  describe('POST /api/v1/auth/register', () => {
    test('creates a new user and returns 201', async () => {
      const { request } = buildApp(mockPrisma);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: VALID_UUID,
        firebaseUid: 'fb-001',
        phone: '9876543210',
        status: 'PENDING_ROLE',
        isNri: false,
        languagePref: 'hi',
        createdAt: new Date().toISOString(),
      });

      const res = await request.post('/api/v1/auth/register').send({
        phone: '9876543210',
        firebaseUid: 'fb-001',
        displayName: 'Test User',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.isNewUser).toBe(true);
    });

    test('returns 200 for existing user login', async () => {
      const { request } = buildApp(mockPrisma);
      const existingUser = {
        id: VALID_UUID,
        firebaseUid: 'fb-002',
        phone: '9876543211',
        status: 'ACTIVE',
      };
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.update.mockResolvedValue({
        ...existingUser,
        lastLoginAt: new Date().toISOString(),
      });

      const res = await request.post('/api/v1/auth/register').send({
        phone: '9876543211',
        firebaseUid: 'fb-002',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.isNewUser).toBe(false);
    });

    test('returns 400 for invalid phone (less than 10 digits)', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request.post('/api/v1/auth/register').send({
        phone: '12345',
        firebaseUid: 'fb-003',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 400 for missing firebaseUid', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request.post('/api/v1/auth/register').send({
        phone: '9876543210',
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 400 for phone with non-numeric characters', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request.post('/api/v1/auth/register').send({
        phone: 'abcdefghij',
        firebaseUid: 'fb-abc',
      });

      expect(res.status).toBe(400);
    });

    test('accepts optional languagePref en or hi', async () => {
      const { request } = buildApp(mockPrisma);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: VALID_UUID,
        firebaseUid: 'fb-004',
        phone: '9876543212',
        languagePref: 'en',
      });

      const res = await request.post('/api/v1/auth/register').send({
        phone: '9876543212',
        firebaseUid: 'fb-004',
        languagePref: 'en',
      });

      expect(res.status).toBe(201);
    });

    test('returns 400 for invalid languagePref', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request.post('/api/v1/auth/register').send({
        phone: '9876543210',
        firebaseUid: 'fb-005',
        languagePref: 'fr',
      });

      expect(res.status).toBe(400);
    });

    test('response has standard { success, data } shape', async () => {
      const { request } = buildApp(mockPrisma);
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        id: VALID_UUID,
        firebaseUid: 'fb-006',
        phone: '9876543213',
      });

      const res = await request.post('/api/v1/auth/register').send({
        phone: '9876543213',
        firebaseUid: 'fb-006',
      });

      expect(res.body).toHaveProperty('success');
      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('isNewUser');
      expect(res.body.data).toHaveProperty('user');
    });
  });

  // ==========================================================================
  // GET /me
  // ==========================================================================

  describe('GET /api/v1/auth/me', () => {
    test('returns user profile when authenticated', async () => {
      const { request } = buildApp(mockPrisma);
      const userProfile = {
        id: VALID_UUID,
        firebaseUid: 'agent-001',
        phone: '9876543210',
        displayName: 'Agent Smith',
        status: 'ACTIVE',
        roles: ['agent'],
      };
      mockPrisma.user.findUnique.mockResolvedValue(userProfile);

      const res = await request
        .get('/api/v1/auth/me')
        .set('x-dev-user-id', 'agent-001')
        .set('x-dev-role', 'agent');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toMatchObject({
        firebaseUid: 'agent-001',
      });
    });

    test('returns 401 when not authenticated', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request.get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test('returns 404 when user not found in DB', async () => {
      const { request } = buildApp(mockPrisma);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request
        .get('/api/v1/auth/me')
        .set('x-dev-user-id', 'nonexistent-uid')
        .set('x-dev-role', 'customer');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });
  });

  // ==========================================================================
  // POST /set-roles
  // ==========================================================================

  describe('POST /api/v1/auth/set-roles', () => {
    test('allows super_admin to set roles', async () => {
      const { request } = buildApp(mockPrisma);
      const adminUser = { id: ADMIN_UUID, firebaseUid: 'admin-001', roles: ['super_admin'] };
      const targetUser = { id: VALID_UUID, firebaseUid: 'target-001', roles: [], cityId: null };
      const updatedUser = { ...targetUser, roles: ['agent'], status: 'ACTIVE' };

      mockPrisma.user.findUnique
        .mockResolvedValueOnce(adminUser) // getUserByFirebaseUid(admin)
        .mockResolvedValueOnce(adminUser) // setUserRoles: admin lookup
        .mockResolvedValueOnce(targetUser); // setUserRoles: target lookup
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const res = await request
        .post('/api/v1/auth/set-roles')
        .set('x-dev-user-id', 'admin-001')
        .set('x-dev-role', 'super_admin')
        .send({ userId: VALID_UUID, roles: ['agent'] });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('returns 400 for empty roles array', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request
        .post('/api/v1/auth/set-roles')
        .set('x-dev-user-id', 'admin-001')
        .set('x-dev-role', 'super_admin')
        .send({ userId: VALID_UUID, roles: [] });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 400 for invalid role name', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request
        .post('/api/v1/auth/set-roles')
        .set('x-dev-user-id', 'admin-001')
        .set('x-dev-role', 'super_admin')
        .send({ userId: VALID_UUID, roles: ['invalid_role'] });

      expect(res.status).toBe(400);
    });

    test('returns 400 for non-UUID userId', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request
        .post('/api/v1/auth/set-roles')
        .set('x-dev-user-id', 'admin-001')
        .set('x-dev-role', 'super_admin')
        .send({ userId: 'not-a-uuid', roles: ['agent'] });

      expect(res.status).toBe(400);
    });

    test('returns 401 when unauthenticated', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request
        .post('/api/v1/auth/set-roles')
        .send({ userId: VALID_UUID, roles: ['agent'] });

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // PUT /status
  // ==========================================================================

  describe('PUT /api/v1/auth/status', () => {
    test('allows super_admin to update user status', async () => {
      const { request } = buildApp(mockPrisma);
      const adminUser = { id: ADMIN_UUID, firebaseUid: 'admin-001', roles: ['super_admin'] };
      const targetUser = { id: VALID_UUID, status: 'ACTIVE' };
      const updatedUser = { ...targetUser, status: 'SUSPENDED' };

      mockPrisma.user.findUnique
        .mockResolvedValueOnce(adminUser) // getUserByFirebaseUid
        .mockResolvedValueOnce(adminUser) // updateUserStatus: admin
        .mockResolvedValueOnce(targetUser); // updateUserStatus: target
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      const res = await request
        .put('/api/v1/auth/status')
        .set('x-dev-user-id', 'admin-001')
        .set('x-dev-role', 'super_admin')
        .send({ userId: VALID_UUID, status: 'SUSPENDED' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    test('returns 400 for invalid status value', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request
        .put('/api/v1/auth/status')
        .set('x-dev-user-id', 'admin-001')
        .set('x-dev-role', 'super_admin')
        .send({ userId: VALID_UUID, status: 'INVALID' });

      expect(res.status).toBe(400);
    });

    test('returns 400 for missing userId', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request
        .put('/api/v1/auth/status')
        .set('x-dev-user-id', 'admin-001')
        .set('x-dev-role', 'super_admin')
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(400);
    });

    test('returns 401 for unauthenticated request', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request
        .put('/api/v1/auth/status')
        .send({ userId: VALID_UUID, status: 'ACTIVE' });

      expect(res.status).toBe(401);
    });

    test('accepts all valid status values', async () => {
      const validStatuses = ['ACTIVE', 'PENDING_ROLE', 'PENDING_APPROVAL', 'SUSPENDED', 'DEACTIVATED'];
      const { request } = buildApp(mockPrisma);
      const adminUser = { id: ADMIN_UUID, firebaseUid: 'admin-001', roles: ['super_admin'] };
      const targetUser = { id: VALID_UUID, status: 'ACTIVE' };

      for (const status of validStatuses) {
        vi.clearAllMocks();
        mockPrisma.user.findUnique
          .mockResolvedValueOnce(adminUser)
          .mockResolvedValueOnce(adminUser)
          .mockResolvedValueOnce(targetUser);
        mockPrisma.user.update.mockResolvedValue({ ...targetUser, status });

        const res = await request
          .put('/api/v1/auth/status')
          .set('x-dev-user-id', 'admin-001')
          .set('x-dev-role', 'super_admin')
          .send({ userId: VALID_UUID, status });

        expect(res.status).toBe(200);
      }
    });
  });

  // ==========================================================================
  // GET /pending
  // ==========================================================================

  describe('GET /api/v1/auth/pending', () => {
    test('returns pending users list for admin', async () => {
      const { request } = buildApp(mockPrisma);
      const pendingUsers = [
        { id: 'u1', status: 'PENDING_ROLE', phone: '1111111111' },
        { id: 'u2', status: 'PENDING_APPROVAL', phone: '2222222222' },
      ];
      mockPrisma.user.findMany.mockResolvedValue(pendingUsers);

      const res = await request
        .get('/api/v1/auth/pending')
        .set('x-dev-user-id', 'admin-001')
        .set('x-dev-role', 'super_admin');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
    });

    test('supports cityId filter query param', async () => {
      const { request } = buildApp(mockPrisma);
      mockPrisma.user.findMany.mockResolvedValue([]);

      const res = await request
        .get('/api/v1/auth/pending?cityId=city-123')
        .set('x-dev-user-id', 'admin-001')
        .set('x-dev-role', 'super_admin');

      expect(res.status).toBe(200);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ cityId: 'city-123' }),
        }),
      );
    });

    test('returns 401 for unauthenticated request', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request.get('/api/v1/auth/pending');

      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // POST /refresh-claims
  // ==========================================================================

  describe('POST /api/v1/auth/refresh-claims', () => {
    test('refreshes Firebase claims for valid userId', async () => {
      const { request } = buildApp(mockPrisma);
      const targetUser = {
        id: VALID_UUID,
        firebaseUid: 'target-fb-001',
        roles: ['agent'],
        cityId: 'city-001',
        primaryRole: 'agent',
      };
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(targetUser) // getUserById
        .mockResolvedValueOnce(targetUser); // refreshClaims

      const res = await request
        .post('/api/v1/auth/refresh-claims')
        .set('x-dev-user-id', 'admin-001')
        .set('x-dev-role', 'super_admin')
        .send({ userId: VALID_UUID });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.synced).toBe(true);
    });

    test('returns 400 for non-UUID userId', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request
        .post('/api/v1/auth/refresh-claims')
        .set('x-dev-user-id', 'admin-001')
        .set('x-dev-role', 'super_admin')
        .send({ userId: 'not-a-uuid' });

      expect(res.status).toBe(400);
    });

    test('returns 401 for unauthenticated request', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request
        .post('/api/v1/auth/refresh-claims')
        .send({ userId: VALID_UUID });

      expect(res.status).toBe(401);
    });

    test('returns 404 when user not found', async () => {
      const { request } = buildApp(mockPrisma);
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const res = await request
        .post('/api/v1/auth/refresh-claims')
        .set('x-dev-user-id', 'admin-001')
        .set('x-dev-role', 'super_admin')
        .send({ userId: VALID_UUID });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });
  });
});
