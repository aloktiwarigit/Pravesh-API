/**
 * Integration tests: Notification endpoints
 *
 * Exercises the full Express middleware chain for notification routes.
 * Tests GET /history, PUT /:id/read, PUT /read-all, GET /unread-count.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestApp, createMockPrisma, TEST_USERS } from '../helpers/test-app';
import { authenticate } from '../../middleware/authenticate';
import { createNotificationController } from '../../domains/notifications/notification.controller';

// ---------------------------------------------------------------------------
// Mock firebase-admin globally
// ---------------------------------------------------------------------------
vi.mock('firebase-admin', () => ({
  default: {
    auth: vi.fn(() => ({
      verifyIdToken: vi.fn(),
    })),
  },
}));

describe('[P1] Notification Endpoints Integration', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let mockPrisma: any;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
    process.env.DEV_AUTH_BYPASS = 'true';

    // Create mock Prisma and add notificationLog methods
    mockPrisma = createMockPrisma();
    (mockPrisma as any).notificationLog = {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // -----------------------------------------------------------------------
  // Helper: build test app with notification routes
  // -----------------------------------------------------------------------
  function buildApp() {
    return createTestApp({
      routes(app) {
        app.use('/notifications', authenticate, createNotificationController(mockPrisma));
      },
    });
  }

  // -----------------------------------------------------------------------
  // GET /notifications/history
  // -----------------------------------------------------------------------
  describe('GET /notifications/history', () => {
    it('returns notifications for current user', async () => {
      // Given: user has notifications
      const mockNotifications = [
        {
          id: 'notif-1',
          userId: 'customer-001',
          channel: 'SMS',
          message: 'Test notification 1',
          createdAt: new Date('2026-02-14T10:00:00Z'),
          readAt: null,
        },
        {
          id: 'notif-2',
          userId: 'customer-001',
          channel: 'EMAIL',
          message: 'Test notification 2',
          createdAt: new Date('2026-02-14T09:00:00Z'),
          readAt: new Date('2026-02-14T09:30:00Z'),
        },
      ];
      mockPrisma.notificationLog.findMany.mockResolvedValue(mockNotifications);
      const { request } = buildApp();

      // When: requesting notification history
      const res = await request
        .get('/notifications/history')
        .set(TEST_USERS.customer);

      // Then: returns user's notifications
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].id).toBe('notif-1');
      expect(res.body.meta.hasMore).toBe(false);
      expect(res.body.meta.nextCursor).toBeNull();
      expect(mockPrisma.notificationLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'customer-001' },
          orderBy: { createdAt: 'desc' },
          take: 21,
        }),
      );
    });

    it('supports cursor pagination with hasMore = true when results exceed limit', async () => {
      // Given: more notifications than limit (limit = 2, return 3)
      const mockNotifications = [
        { id: 'notif-1', userId: 'customer-001', message: 'Notification 1', createdAt: new Date() },
        { id: 'notif-2', userId: 'customer-001', message: 'Notification 2', createdAt: new Date() },
        { id: 'notif-3', userId: 'customer-001', message: 'Notification 3', createdAt: new Date() },
      ];
      mockPrisma.notificationLog.findMany.mockResolvedValue(mockNotifications);
      const { request } = buildApp();

      // When: requesting with limit = 2
      const res = await request
        .get('/notifications/history?limit=2')
        .set(TEST_USERS.customer);

      // Then: returns first 2 with hasMore = true
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].id).toBe('notif-1');
      expect(res.body.data[1].id).toBe('notif-2');
      expect(res.body.meta.hasMore).toBe(true);
      expect(res.body.meta.nextCursor).toBe('notif-2');
      expect(mockPrisma.notificationLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 3, // limit + 1
        }),
      );
    });

    it('filters by channel', async () => {
      // Given: mock notifications
      mockPrisma.notificationLog.findMany.mockResolvedValue([
        { id: 'notif-1', userId: 'customer-001', channel: 'SMS', message: 'SMS notification' },
      ]);
      const { request } = buildApp();

      // When: requesting with channel filter
      const res = await request
        .get('/notifications/history?channel=SMS')
        .set(TEST_USERS.customer);

      // Then: filters by channel
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(mockPrisma.notificationLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'customer-001', channel: 'SMS' },
        }),
      );
    });

    it('returns empty array when no notifications', async () => {
      // Given: user has no notifications
      mockPrisma.notificationLog.findMany.mockResolvedValue([]);
      const { request } = buildApp();

      // When: requesting notification history
      const res = await request
        .get('/notifications/history')
        .set(TEST_USERS.customer);

      // Then: returns empty array
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toEqual([]);
      expect(res.body.meta.hasMore).toBe(false);
      expect(res.body.meta.nextCursor).toBeNull();
    });
  });

  // -----------------------------------------------------------------------
  // PUT /notifications/:id/read
  // -----------------------------------------------------------------------
  describe('PUT /notifications/:id/read', () => {
    it('marks notification as read', async () => {
      // Given: notification exists and belongs to user
      const mockNotification = {
        id: 'notif-1',
        userId: 'customer-001',
        message: 'Test notification',
        readAt: null,
      };
      const mockUpdated = {
        id: 'notif-1',
        readAt: new Date('2026-02-14T10:00:00Z'),
      };
      mockPrisma.notificationLog.findUnique.mockResolvedValue(mockNotification);
      mockPrisma.notificationLog.update.mockResolvedValue(mockUpdated);
      const { request } = buildApp();

      // When: marking notification as read
      const res = await request
        .put('/notifications/notif-1/read')
        .set(TEST_USERS.customer);

      // Then: updates readAt timestamp
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe('notif-1');
      expect(res.body.data.readAt).toBeDefined();
      expect(mockPrisma.notificationLog.findUnique).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
      });
      expect(mockPrisma.notificationLog.update).toHaveBeenCalledWith({
        where: { id: 'notif-1' },
        data: { readAt: expect.any(Date) },
        select: { id: true, readAt: true },
      });
    });

    it('returns 404 for non-existent notification', async () => {
      // Given: notification does not exist
      mockPrisma.notificationLog.findUnique.mockResolvedValue(null);
      const { request } = buildApp();

      // When: trying to mark non-existent notification as read
      const res = await request
        .put('/notifications/notif-999/read')
        .set(TEST_USERS.customer);

      // Then: returns 404
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
      expect(res.body.error.message).toBe('Notification not found');
      expect(mockPrisma.notificationLog.update).not.toHaveBeenCalled();
    });

    it('returns 403 when notification belongs to another user', async () => {
      // Given: notification exists but belongs to different user
      const mockNotification = {
        id: 'notif-1',
        userId: 'other-user-999',
        message: 'Test notification',
        readAt: null,
      };
      mockPrisma.notificationLog.findUnique.mockResolvedValue(mockNotification);
      const { request } = buildApp();

      // When: trying to mark another user's notification as read
      const res = await request
        .put('/notifications/notif-1/read')
        .set(TEST_USERS.customer);

      // Then: returns 403
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN');
      expect(res.body.error.message).toBe('Not authorized');
      expect(mockPrisma.notificationLog.update).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // PUT /notifications/read-all
  // -----------------------------------------------------------------------
  describe('PUT /notifications/read-all', () => {
    it('marks all unread notifications as read', async () => {
      // Given: user has unread notifications
      mockPrisma.notificationLog.updateMany.mockResolvedValue({ count: 5 });
      const { request } = buildApp();

      // When: marking all as read
      const res = await request
        .put('/notifications/read-all')
        .set(TEST_USERS.customer);

      // Then: updates all unread notifications
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.updatedCount).toBe(5);
      expect(mockPrisma.notificationLog.updateMany).toHaveBeenCalledWith({
        where: { userId: 'customer-001', readAt: null },
        data: { readAt: expect.any(Date) },
      });
    });
  });

  // -----------------------------------------------------------------------
  // GET /notifications/unread-count
  // -----------------------------------------------------------------------
  describe('GET /notifications/unread-count', () => {
    it('returns correct unread count', async () => {
      // Given: user has 3 unread notifications
      mockPrisma.notificationLog.count.mockResolvedValue(3);
      const { request } = buildApp();

      // When: requesting unread count
      const res = await request
        .get('/notifications/unread-count')
        .set(TEST_USERS.customer);

      // Then: returns count
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(3);
      expect(mockPrisma.notificationLog.count).toHaveBeenCalledWith({
        where: { userId: 'customer-001', readAt: null },
      });
    });

    it('returns 0 when all notifications are read', async () => {
      // Given: user has no unread notifications
      mockPrisma.notificationLog.count.mockResolvedValue(0);
      const { request } = buildApp();

      // When: requesting unread count
      const res = await request
        .get('/notifications/unread-count')
        .set(TEST_USERS.customer);

      // Then: returns 0
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(0);
    });
  });
});
