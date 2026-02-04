/**
 * User Domain Service
 * Handles user profile retrieval, updates, and admin search.
 */

import { Prisma, PrismaClient } from '@prisma/client';
import { BusinessError } from '../../shared/errors/business-error';
import { UpdateProfileInput } from './user.validation';

export class UserService {
  constructor(private readonly prisma: PrismaClient) {}

  // ============================================================
  // Get profile by Firebase UID
  // ============================================================

  async getProfile(firebaseUid: string) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
    });

    if (!user) {
      throw new BusinessError('USER_NOT_FOUND', 'User not found', 404);
    }

    return user;
  }

  // ============================================================
  // Update profile by Firebase UID
  // ============================================================

  async updateProfile(firebaseUid: string, data: UpdateProfileInput) {
    const user = await this.prisma.user.findUnique({
      where: { firebaseUid },
    });

    if (!user) {
      throw new BusinessError('USER_NOT_FOUND', 'User not found', 404);
    }

    return this.prisma.user.update({
      where: { firebaseUid },
      data: {
        ...(data.displayName !== undefined && { displayName: data.displayName }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.languagePref !== undefined && { languagePref: data.languagePref }),
        ...(data.profileData !== undefined && { profileData: data.profileData as Prisma.InputJsonValue }),
      },
    });
  }

  // ============================================================
  // Get user by platform user ID
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
  // Admin: Search / list users with pagination
  // ============================================================

  async searchUsers(filters: {
    query?: string;
    role?: string;
    status?: string;
    cityId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.query) {
      where.OR = [
        { phone: { contains: filters.query, mode: 'insensitive' } },
        { displayName: { contains: filters.query, mode: 'insensitive' } },
      ];
    }

    if (filters.role) {
      where.roles = { has: filters.role };
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.cityId) {
      where.cityId = filters.cityId;
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return { users, total, page, limit };
  }
}
