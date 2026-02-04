// ============================================================
// Auth Domain — Service Layer
// User registration/login, role management, Firebase custom claims
// ============================================================

import { PrismaClient, UserStatus } from '@prisma/client';
import admin from 'firebase-admin';
import { BusinessError } from '../../shared/errors/business-error';
import { NriDetectionService } from './nri-detection.service';

const VALID_ROLES = [
  'customer',
  'agent',
  'dealer',
  'ops',
  'builder',
  'lawyer',
  'franchise_owner',
  'super_admin',
  'support',
];

const ADMIN_ROLES = ['super_admin', 'ops'];

export class AuthService {
  constructor(private readonly prisma: PrismaClient) {}

  // ============================================================
  // Register or Login — upsert by firebaseUid
  // ============================================================

  async registerOrLogin(data: {
    firebaseUid: string;
    phone: string;
    displayName?: string;
    email?: string;
    isNri?: boolean;
    countryCode?: string;
    languagePref?: string;
  }): Promise<{ user: any; isNewUser: boolean }> {
    const existing = await this.prisma.user.findUnique({
      where: { firebaseUid: data.firebaseUid },
    });

    // Auto-detect NRI status from phone if not explicitly provided
    const isNri = data.isNri ?? NriDetectionService.isNriPhone(data.phone);
    const countryInfo = isNri
      ? NriDetectionService.getCountryFromPhone(data.phone)
      : null;
    const countryCode = data.countryCode ?? countryInfo?.code ?? null;

    if (existing) {
      // Existing user — update lastLoginAt and return
      const user = await this.prisma.user.update({
        where: { firebaseUid: data.firebaseUid },
        data: {
          lastLoginAt: new Date(),
          ...(data.displayName ? { displayName: data.displayName } : {}),
          ...(data.email ? { email: data.email } : {}),
        },
      });

      return { user, isNewUser: false };
    }

    // New user — create with PENDING_ROLE status
    const user = await this.prisma.user.create({
      data: {
        firebaseUid: data.firebaseUid,
        phone: data.phone,
        displayName: data.displayName ?? null,
        email: data.email ?? null,
        status: UserStatus.PENDING_ROLE,
        isNri,
        countryCode,
        languagePref: data.languagePref ?? 'hi',
        lastLoginAt: new Date(),
      },
    });

    return { user, isNewUser: true };
  }

  // ============================================================
  // Set User Roles — admin-only, syncs Firebase custom claims
  // ============================================================

  async setUserRoles(
    adminUserId: string,
    targetUserId: string,
    roles: string[],
    cityId?: string,
    primaryRole?: string,
  ) {
    // Validate caller is super_admin or ops
    const adminUser = await this.prisma.user.findUnique({
      where: { id: adminUserId },
    });

    if (!adminUser) {
      throw new BusinessError('USER_NOT_FOUND', 'Admin user not found', 404);
    }

    const hasAdminRole = adminUser.roles.some((r) => ADMIN_ROLES.includes(r));
    if (!hasAdminRole) {
      throw new BusinessError(
        'AUTH_INSUFFICIENT_ROLE',
        'Only super_admin or ops can assign roles',
        403,
      );
    }

    // Validate target user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new BusinessError('USER_NOT_FOUND', 'Target user not found', 404);
    }

    // Validate all roles are valid
    for (const role of roles) {
      if (!VALID_ROLES.includes(role)) {
        throw new BusinessError(
          'INVALID_ROLE',
          `Invalid role: ${role}. Valid roles: ${VALID_ROLES.join(', ')}`,
          400,
        );
      }
    }

    // Determine primary role
    const resolvedPrimaryRole = primaryRole ?? roles[0];

    // Update user in DB
    const updatedUser = await this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        roles,
        primaryRole: resolvedPrimaryRole,
        cityId: cityId ?? targetUser.cityId,
        status: UserStatus.ACTIVE,
      },
    });

    // Set Firebase custom claims
    await admin.auth().setCustomUserClaims(targetUser.firebaseUid, {
      roles,
      cityId: cityId ?? targetUser.cityId,
      primaryRole: resolvedPrimaryRole,
    });

    return updatedUser;
  }

  // ============================================================
  // Get User by Firebase UID
  // ============================================================

  async getUserByFirebaseUid(firebaseUid: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
    });

    if (!user) {
      throw new BusinessError('USER_NOT_FOUND', 'User not found', 404);
    }

    return user;
  }

  // ============================================================
  // Get User by Platform ID
  // ============================================================

  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BusinessError('USER_NOT_FOUND', 'User not found', 404);
    }

    return user;
  }

  // ============================================================
  // Update User Status — admin-only
  // ============================================================

  async updateUserStatus(
    adminUserId: string,
    targetUserId: string,
    status: string,
  ) {
    // Validate caller is super_admin
    const adminUser = await this.prisma.user.findUnique({
      where: { id: adminUserId },
    });

    if (!adminUser) {
      throw new BusinessError('USER_NOT_FOUND', 'Admin user not found', 404);
    }

    if (!adminUser.roles.includes('super_admin')) {
      throw new BusinessError(
        'AUTH_INSUFFICIENT_ROLE',
        'Only super_admin can update user status',
        403,
      );
    }

    // Validate target user exists
    const targetUser = await this.prisma.user.findUnique({
      where: { id: targetUserId },
    });

    if (!targetUser) {
      throw new BusinessError('USER_NOT_FOUND', 'Target user not found', 404);
    }

    // Validate status is a valid UserStatus value
    const validStatuses = Object.values(UserStatus);
    if (!validStatuses.includes(status as UserStatus)) {
      throw new BusinessError(
        'INVALID_STATUS',
        `Invalid status: ${status}. Valid statuses: ${validStatuses.join(', ')}`,
        400,
      );
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: targetUserId },
      data: { status: status as UserStatus },
    });

    return updatedUser;
  }

  // ============================================================
  // Refresh Claims — re-sync from DB to Firebase
  // ============================================================

  async refreshClaims(firebaseUid: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
    });

    if (!user) {
      throw new BusinessError('USER_NOT_FOUND', 'User not found', 404);
    }

    await admin.auth().setCustomUserClaims(firebaseUid, {
      roles: user.roles,
      cityId: user.cityId,
      primaryRole: user.primaryRole,
    });

    return { synced: true, firebaseUid, roles: user.roles };
  }

  // ============================================================
  // List Pending Users — users awaiting role assignment or approval
  // ============================================================

  async listPendingUsers(cityId?: string) {
    const users = await this.prisma.user.findMany({
      where: {
        status: {
          in: [UserStatus.PENDING_ROLE, UserStatus.PENDING_APPROVAL],
        },
        ...(cityId ? { cityId } : {}),
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        firebaseUid: true,
        phone: true,
        displayName: true,
        email: true,
        roles: true,
        primaryRole: true,
        cityId: true,
        status: true,
        isNri: true,
        countryCode: true,
        languagePref: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    return users;
  }
}
