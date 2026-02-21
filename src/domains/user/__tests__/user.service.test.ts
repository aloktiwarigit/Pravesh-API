/**
 * Tests for UserService covering profile retrieval, update, and admin search.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { UserService } from '../user.service';
import { BusinessError } from '../../../shared/errors/business-error';

function createMockPrisma() {
  return {
    user: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  } as any;
}

describe('UserService', () => {
  let service: UserService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new UserService(mockPrisma);
    vi.clearAllMocks();
  });

  // ============================================================
  // getProfile
  // ============================================================

  describe('getProfile', () => {
    test('returns user profile by Firebase UID', async () => {
      // Given
      const user = {
        id: 'user-001',
        firebaseUid: 'fb-001',
        displayName: 'Test User',
        phone: '9876543210',
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      // When
      const result = await service.getProfile('fb-001');

      // Then
      expect(result).toEqual(user);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { firebaseUid: 'fb-001' },
      });
    });

    test('throws USER_NOT_FOUND when user does not exist', async () => {
      // Given
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // When & Then
      await expect(
        service.getProfile('fb-nonexistent')
      ).rejects.toThrow(BusinessError);

      await expect(
        service.getProfile('fb-nonexistent')
      ).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
        statusCode: 404,
      });
    });
  });

  // ============================================================
  // updateProfile
  // ============================================================

  describe('updateProfile', () => {
    const existingUser = {
      id: 'user-001',
      firebaseUid: 'fb-001',
      displayName: 'Old Name',
      email: 'old@test.com',
      languagePref: 'hi',
    };

    test('updates displayName', async () => {
      // Given
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      const updatedUser = { ...existingUser, displayName: 'New Name' };
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      // When
      const result = await service.updateProfile('fb-001', {
        displayName: 'New Name',
      });

      // Then
      expect(result.displayName).toBe('New Name');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { firebaseUid: 'fb-001' },
        data: { displayName: 'New Name' },
      });
    });

    test('updates email', async () => {
      // Given
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.update.mockResolvedValue({ ...existingUser, email: 'new@test.com' });

      // When
      const result = await service.updateProfile('fb-001', {
        email: 'new@test.com',
      });

      // Then
      expect(result.email).toBe('new@test.com');
    });

    test('updates languagePref', async () => {
      // Given
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.update.mockResolvedValue({ ...existingUser, languagePref: 'en' });

      // When
      const result = await service.updateProfile('fb-001', {
        languagePref: 'en',
      });

      // Then
      expect(result.languagePref).toBe('en');
    });

    test('updates profileData', async () => {
      // Given
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      const profileData = { address: '123 Main St', pincode: '226001' };
      mockPrisma.user.update.mockResolvedValue({ ...existingUser, profileData });

      // When
      const result = await service.updateProfile('fb-001', {
        profileData,
      });

      // Then
      expect(result.profileData).toEqual(profileData);
    });

    test('updates multiple fields at once', async () => {
      // Given
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.update.mockResolvedValue({
        ...existingUser,
        displayName: 'Updated',
        email: 'updated@test.com',
        languagePref: 'en',
      });

      // When
      await service.updateProfile('fb-001', {
        displayName: 'Updated',
        email: 'updated@test.com',
        languagePref: 'en',
      });

      // Then
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { firebaseUid: 'fb-001' },
        data: {
          displayName: 'Updated',
          email: 'updated@test.com',
          languagePref: 'en',
        },
      });
    });

    test('throws USER_NOT_FOUND when user does not exist', async () => {
      // Given
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // When & Then
      await expect(
        service.updateProfile('fb-nonexistent', { displayName: 'New' })
      ).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
        statusCode: 404,
      });
    });

    test('does not include undefined fields in update', async () => {
      // Given
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.update.mockResolvedValue(existingUser);

      // When: only updating displayName (email, languagePref, profileData are undefined)
      await service.updateProfile('fb-001', {
        displayName: 'Only Name',
      });

      // Then: only displayName should be in data
      const updateCall = mockPrisma.user.update.mock.calls[0][0];
      expect(updateCall.data).toEqual({ displayName: 'Only Name' });
      expect(updateCall.data).not.toHaveProperty('email');
      expect(updateCall.data).not.toHaveProperty('languagePref');
    });
  });

  // ============================================================
  // getUserById
  // ============================================================

  describe('getUserById', () => {
    test('returns user by platform ID', async () => {
      // Given
      const user = { id: 'user-001', firebaseUid: 'fb-001' };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      // When
      const result = await service.getUserById('user-001');

      // Then
      expect(result).toEqual(user);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-001' },
      });
    });

    test('throws USER_NOT_FOUND when user does not exist', async () => {
      // Given
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // When & Then
      await expect(
        service.getUserById('nonexistent')
      ).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
        statusCode: 404,
      });
    });
  });

  // ============================================================
  // searchUsers
  // ============================================================

  describe('searchUsers', () => {
    test('returns paginated user list with defaults', async () => {
      // Given
      const users = [
        { id: 'u1', displayName: 'User 1' },
        { id: 'u2', displayName: 'User 2' },
      ];
      mockPrisma.user.findMany.mockResolvedValue(users);
      mockPrisma.user.count.mockResolvedValue(2);

      // When
      const result = await service.searchUsers({});

      // Then
      expect(result).toEqual({
        users,
        total: 2,
        page: 1,
        limit: 20,
      });
    });

    test('filters by query (phone or displayName)', async () => {
      // Given
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      // When
      await service.searchUsers({ query: 'test' });

      // Then
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { phone: { contains: 'test', mode: 'insensitive' } },
              { displayName: { contains: 'test', mode: 'insensitive' } },
            ],
          }),
        }),
      );
    });

    test('filters by role', async () => {
      // Given
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      // When
      await service.searchUsers({ role: 'agent' });

      // Then
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            roles: { has: 'agent' },
          }),
        }),
      );
    });

    test('filters by status', async () => {
      // Given
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      // When
      await service.searchUsers({ status: 'ACTIVE' });

      // Then
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        }),
      );
    });

    test('filters by cityId', async () => {
      // Given
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      // When
      await service.searchUsers({ cityId: 'city-001' });

      // Then
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            cityId: 'city-001',
          }),
        }),
      );
    });

    test('respects custom page and limit', async () => {
      // Given
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(50);

      // When
      const result = await service.searchUsers({ page: 3, limit: 10 });

      // Then
      expect(result.page).toBe(3);
      expect(result.limit).toBe(10);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3 - 1) * 10
          take: 10,
        }),
      );
    });

    test('orders by createdAt descending', async () => {
      // Given
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      // When
      await service.searchUsers({});

      // Then
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    test('combines multiple filters', async () => {
      // Given
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      // When
      await service.searchUsers({
        query: 'john',
        role: 'agent',
        status: 'ACTIVE',
        cityId: 'city-001',
      });

      // Then
      const whereClause = mockPrisma.user.findMany.mock.calls[0][0].where;
      expect(whereClause).toHaveProperty('OR');
      expect(whereClause).toHaveProperty('roles', { has: 'agent' });
      expect(whereClause).toHaveProperty('status', 'ACTIVE');
      expect(whereClause).toHaveProperty('cityId', 'city-001');
    });
  });
});
