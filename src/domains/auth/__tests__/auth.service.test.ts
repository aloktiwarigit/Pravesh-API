/**
 * Tests for AuthService covering registration, login, role management,
 * status updates, claims refresh, and pending user listing.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../auth.service';
import { BusinessError } from '../../../shared/errors/business-error';

// Mock firebase-admin
vi.mock('firebase-admin', () => ({
  default: {
    auth: vi.fn(() => ({
      setCustomUserClaims: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

// Mock NriDetectionService
vi.mock('../nri-detection.service', () => ({
  NriDetectionService: {
    isNriPhone: vi.fn((phone: string) => !phone.startsWith('+91') && !phone.startsWith('91') && !phone.startsWith('0')),
    getCountryFromPhone: vi.fn(() => null),
  },
}));

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

describe('AuthService', () => {
  let service: AuthService;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new AuthService(mockPrisma);
    vi.clearAllMocks();
  });

  // ============================================================
  // registerOrLogin
  // ============================================================

  describe('registerOrLogin', () => {
    test('creates a new user when firebaseUid does not exist', async () => {
      // Given: no existing user
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const newUser = {
        id: 'user-001',
        firebaseUid: 'fb-uid-001',
        phone: '+919876543210',
        displayName: 'Test User',
        status: 'PENDING_ROLE',
        isNri: false,
      };
      mockPrisma.user.create.mockResolvedValue(newUser);

      // When
      const result = await service.registerOrLogin({
        firebaseUid: 'fb-uid-001',
        phone: '+919876543210',
        displayName: 'Test User',
      });

      // Then
      expect(result.isNewUser).toBe(true);
      expect(result.user).toEqual(newUser);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firebaseUid: 'fb-uid-001',
          phone: '+919876543210',
          displayName: 'Test User',
          status: 'PENDING_ROLE',
          isNri: false,
        }),
      });
    });

    test('returns existing user on re-login and updates lastLoginAt', async () => {
      // Given: existing user found
      const existingUser = {
        id: 'user-002',
        firebaseUid: 'fb-uid-002',
        phone: '9876543211',
        displayName: 'Existing User',
        status: 'ACTIVE',
      };
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.update.mockResolvedValue({
        ...existingUser,
        lastLoginAt: new Date(),
      });

      // When
      const result = await service.registerOrLogin({
        firebaseUid: 'fb-uid-002',
        phone: '9876543211',
      });

      // Then
      expect(result.isNewUser).toBe(false);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { firebaseUid: 'fb-uid-002' },
        data: expect.objectContaining({
          lastLoginAt: expect.any(Date),
        }),
      });
      expect(mockPrisma.user.create).not.toHaveBeenCalled();
    });

    test('updates displayName and email on re-login when provided', async () => {
      // Given
      const existingUser = {
        id: 'user-003',
        firebaseUid: 'fb-uid-003',
        phone: '9876543212',
      };
      mockPrisma.user.findUnique.mockResolvedValue(existingUser);
      mockPrisma.user.update.mockResolvedValue(existingUser);

      // When
      await service.registerOrLogin({
        firebaseUid: 'fb-uid-003',
        phone: '9876543212',
        displayName: 'Updated Name',
        email: 'updated@test.com',
      });

      // Then
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { firebaseUid: 'fb-uid-003' },
        data: expect.objectContaining({
          displayName: 'Updated Name',
          email: 'updated@test.com',
        }),
      });
    });

    test('sets default languagePref to "hi" for new users', async () => {
      // Given
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'user-new' });

      // When
      await service.registerOrLogin({
        firebaseUid: 'fb-uid-new',
        phone: '9876543213',
      });

      // Then
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          languagePref: 'hi',
        }),
      });
    });

    test('respects provided languagePref for new users', async () => {
      // Given
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'user-en' });

      // When
      await service.registerOrLogin({
        firebaseUid: 'fb-uid-en',
        phone: '9876543214',
        languagePref: 'en',
      });

      // Then
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          languagePref: 'en',
        }),
      });
    });

    test('sets isNri to false for Indian phone numbers with +91 prefix', async () => {
      // Given
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'user-in' });

      // When
      await service.registerOrLogin({
        firebaseUid: 'fb-uid-in',
        phone: '+919876543210', // Indian number with +91 prefix
      });

      // Then
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isNri: false,
        }),
      });
    });

    test('sets isNri to true for international phone numbers', async () => {
      // Given
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ id: 'user-nri' });

      // When
      await service.registerOrLogin({
        firebaseUid: 'fb-uid-nri',
        phone: '+14155551234', // US number
      });

      // Then
      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isNri: true,
        }),
      });
    });
  });

  // ============================================================
  // getUserByFirebaseUid
  // ============================================================

  describe('getUserByFirebaseUid', () => {
    test('returns user when found', async () => {
      // Given
      const user = { id: 'user-001', firebaseUid: 'fb-001', phone: '1234567890' };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      // When
      const result = await service.getUserByFirebaseUid('fb-001');

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
        service.getUserByFirebaseUid('fb-nonexistent')
      ).rejects.toThrow(BusinessError);

      await expect(
        service.getUserByFirebaseUid('fb-nonexistent')
      ).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
        statusCode: 404,
      });
    });
  });

  // ============================================================
  // getUserById
  // ============================================================

  describe('getUserById', () => {
    test('returns user when found', async () => {
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
      ).rejects.toThrow(BusinessError);

      await expect(
        service.getUserById('nonexistent')
      ).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
        statusCode: 404,
      });
    });
  });

  // ============================================================
  // setUserRoles
  // ============================================================

  describe('setUserRoles', () => {
    const adminUser = {
      id: 'admin-001',
      firebaseUid: 'fb-admin',
      roles: ['super_admin'],
      primaryRole: 'super_admin',
    };

    const targetUser = {
      id: 'target-001',
      firebaseUid: 'fb-target',
      roles: [],
      cityId: null,
      status: 'PENDING_ROLE',
    };

    test('sets roles on target user and updates status to ACTIVE', async () => {
      // Given
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(adminUser) // admin lookup
        .mockResolvedValueOnce(targetUser); // target lookup
      const updatedUser = {
        ...targetUser,
        roles: ['agent'],
        primaryRole: 'agent',
        status: 'ACTIVE',
        cityId: 'city-001',
      };
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      // When
      const result = await service.setUserRoles(
        'admin-001',
        'target-001',
        ['agent'],
        'city-001',
      );

      // Then
      expect(result).toEqual(updatedUser);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'target-001' },
        data: expect.objectContaining({
          roles: ['agent'],
          primaryRole: 'agent',
          status: 'ACTIVE',
          cityId: 'city-001',
        }),
      });
    });

    test('throws USER_NOT_FOUND when admin user not found', async () => {
      // Given
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      // When & Then
      await expect(
        service.setUserRoles('nonexistent', 'target-001', ['agent'])
      ).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
        message: 'Admin user not found',
        statusCode: 404,
      });
    });

    test('throws AUTH_INSUFFICIENT_ROLE when caller is not admin', async () => {
      // Given: non-admin user
      const nonAdmin = {
        id: 'user-002',
        roles: ['customer'],
      };
      mockPrisma.user.findUnique.mockResolvedValueOnce(nonAdmin);

      // When & Then
      await expect(
        service.setUserRoles('user-002', 'target-001', ['agent'])
      ).rejects.toMatchObject({
        code: 'AUTH_INSUFFICIENT_ROLE',
        statusCode: 403,
      });
    });

    test('throws USER_NOT_FOUND when target user not found', async () => {
      // Given
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(null); // target not found

      // When & Then
      await expect(
        service.setUserRoles('admin-001', 'nonexistent', ['agent'])
      ).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
        message: 'Target user not found',
        statusCode: 404,
      });
    });

    test('throws INVALID_ROLE for invalid role names', async () => {
      // Given
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(targetUser);

      // When & Then
      await expect(
        service.setUserRoles('admin-001', 'target-001', ['invalid_role'])
      ).rejects.toMatchObject({
        code: 'INVALID_ROLE',
        statusCode: 400,
      });
    });

    test('uses first role as primary when primaryRole not specified', async () => {
      // Given
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(targetUser);
      mockPrisma.user.update.mockResolvedValue({ ...targetUser, roles: ['agent', 'dealer'] });

      // When
      await service.setUserRoles('admin-001', 'target-001', ['agent', 'dealer']);

      // Then
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'target-001' },
        data: expect.objectContaining({
          primaryRole: 'agent', // first role
        }),
      });
    });

    test('uses explicit primaryRole when specified', async () => {
      // Given
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(targetUser);
      mockPrisma.user.update.mockResolvedValue({ ...targetUser });

      // When
      await service.setUserRoles('admin-001', 'target-001', ['agent', 'dealer'], undefined, 'dealer');

      // Then
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'target-001' },
        data: expect.objectContaining({
          primaryRole: 'dealer',
        }),
      });
    });

    test('ops user can also assign roles', async () => {
      // Given: ops admin
      const opsUser = { id: 'ops-001', roles: ['ops'] };
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(opsUser)
        .mockResolvedValueOnce(targetUser);
      mockPrisma.user.update.mockResolvedValue({ ...targetUser, roles: ['customer'] });

      // When
      const result = await service.setUserRoles('ops-001', 'target-001', ['customer']);

      // Then: should not throw
      expect(result).toBeDefined();
    });

    test('validates all roles in array', async () => {
      // Given: one valid and one invalid role
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(targetUser);

      // When & Then
      await expect(
        service.setUserRoles('admin-001', 'target-001', ['agent', 'hacker_role'])
      ).rejects.toMatchObject({
        code: 'INVALID_ROLE',
        statusCode: 400,
      });
    });
  });

  // ============================================================
  // updateUserStatus
  // ============================================================

  describe('updateUserStatus', () => {
    const superAdmin = {
      id: 'admin-001',
      roles: ['super_admin'],
    };

    const targetUser = {
      id: 'target-001',
      firebaseUid: 'fb-target',
      status: 'ACTIVE',
    };

    test('updates user status successfully', async () => {
      // Given
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(superAdmin)
        .mockResolvedValueOnce(targetUser);
      const updatedUser = { ...targetUser, status: 'SUSPENDED' };
      mockPrisma.user.update.mockResolvedValue(updatedUser);

      // When
      const result = await service.updateUserStatus('admin-001', 'target-001', 'SUSPENDED');

      // Then
      expect(result.status).toBe('SUSPENDED');
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'target-001' },
        data: { status: 'SUSPENDED' },
      });
    });

    test('throws when admin user not found', async () => {
      // Given
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);

      // When & Then
      await expect(
        service.updateUserStatus('nonexistent', 'target-001', 'SUSPENDED')
      ).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
        statusCode: 404,
      });
    });

    test('throws when caller is not super_admin', async () => {
      // Given: ops user (not super_admin)
      const opsUser = { id: 'ops-001', roles: ['ops'] };
      mockPrisma.user.findUnique.mockResolvedValueOnce(opsUser);

      // When & Then
      await expect(
        service.updateUserStatus('ops-001', 'target-001', 'SUSPENDED')
      ).rejects.toMatchObject({
        code: 'AUTH_INSUFFICIENT_ROLE',
        statusCode: 403,
      });
    });

    test('throws when target user not found', async () => {
      // Given
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(superAdmin)
        .mockResolvedValueOnce(null);

      // When & Then
      await expect(
        service.updateUserStatus('admin-001', 'nonexistent', 'SUSPENDED')
      ).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
        statusCode: 404,
      });
    });

    test('throws for invalid status value', async () => {
      // Given
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(superAdmin)
        .mockResolvedValueOnce(targetUser);

      // When & Then
      await expect(
        service.updateUserStatus('admin-001', 'target-001', 'INVALID_STATUS')
      ).rejects.toMatchObject({
        code: 'INVALID_STATUS',
        statusCode: 400,
      });
    });
  });

  // ============================================================
  // refreshClaims
  // ============================================================

  describe('refreshClaims', () => {
    test('syncs claims from DB to Firebase', async () => {
      // Given
      const user = {
        id: 'user-001',
        firebaseUid: 'fb-001',
        roles: ['agent', 'dealer'],
        cityId: 'city-001',
        primaryRole: 'agent',
      };
      mockPrisma.user.findUnique.mockResolvedValue(user);

      // When
      const result = await service.refreshClaims('fb-001');

      // Then
      expect(result).toEqual({
        synced: true,
        firebaseUid: 'fb-001',
        roles: ['agent', 'dealer'],
      });
    });

    test('throws USER_NOT_FOUND when user does not exist', async () => {
      // Given
      mockPrisma.user.findUnique.mockResolvedValue(null);

      // When & Then
      await expect(
        service.refreshClaims('fb-nonexistent')
      ).rejects.toMatchObject({
        code: 'USER_NOT_FOUND',
        statusCode: 404,
      });
    });
  });

  // ============================================================
  // listPendingUsers
  // ============================================================

  describe('listPendingUsers', () => {
    test('returns users with PENDING_ROLE or PENDING_APPROVAL status', async () => {
      // Given
      const pendingUsers = [
        { id: 'u1', status: 'PENDING_ROLE', phone: '1111111111' },
        { id: 'u2', status: 'PENDING_APPROVAL', phone: '2222222222' },
      ];
      mockPrisma.user.findMany.mockResolvedValue(pendingUsers);

      // When
      const result = await service.listPendingUsers();

      // Then
      expect(result).toEqual(pendingUsers);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: {
          status: { in: ['PENDING_ROLE', 'PENDING_APPROVAL'] },
        },
        orderBy: { createdAt: 'asc' },
        select: expect.objectContaining({
          id: true,
          firebaseUid: true,
          phone: true,
          status: true,
        }),
      });
    });

    test('filters by cityId when provided', async () => {
      // Given
      mockPrisma.user.findMany.mockResolvedValue([]);

      // When
      await service.listPendingUsers('city-001');

      // Then
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          cityId: 'city-001',
        }),
        orderBy: { createdAt: 'asc' },
        select: expect.any(Object),
      });
    });

    test('returns empty array when no pending users exist', async () => {
      // Given
      mockPrisma.user.findMany.mockResolvedValue([]);

      // When
      const result = await service.listPendingUsers();

      // Then
      expect(result).toEqual([]);
    });
  });
});
