import { PrismaClient, RoleRequestStatus, UserStatus } from '@prisma/client';
import admin from 'firebase-admin';
import { BusinessError } from '../../shared/errors/business-error';
import { logger } from '../../shared/utils/logger';

const REQUESTABLE_ROLES = ['agent', 'dealer', 'lawyer', 'builder'];
const ADMIN_ROLES = ['super_admin', 'ops', 'franchise_owner'];

export class RoleRequestService {
  constructor(private readonly prisma: PrismaClient) {}

  async createRequest(userId: string, requestedRole: string, notes?: string) {
    if (!REQUESTABLE_ROLES.includes(requestedRole)) {
      throw new BusinessError(
        'INVALID_ROLE',
        `Role '${requestedRole}' is not requestable. Valid: ${REQUESTABLE_ROLES.join(', ')}`,
        400,
      );
    }

    // Check user exists
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BusinessError('USER_NOT_FOUND', 'User not found', 404);
    }

    // Check if user already has this role
    if (user.roles.includes(requestedRole)) {
      throw new BusinessError(
        'ROLE_ALREADY_ASSIGNED',
        `You already have the '${requestedRole}' role`,
        409,
      );
    }

    // Check for existing pending request for same role
    const existing = await this.prisma.roleRequest.findFirst({
      where: {
        userId,
        requestedRole,
        status: RoleRequestStatus.PENDING,
      },
    });

    if (existing) {
      throw new BusinessError(
        'DUPLICATE_REQUEST',
        `You already have a pending request for '${requestedRole}'`,
        409,
      );
    }

    return this.prisma.roleRequest.create({
      data: {
        userId,
        requestedRole,
        notes,
      },
    });
  }

  async getMyRequests(userId: string) {
    return this.prisma.roleRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listPendingRequests(reviewerUserId: string) {
    // Verify reviewer has admin privileges
    const reviewer = await this.prisma.user.findUnique({
      where: { id: reviewerUserId },
    });

    if (!reviewer || !reviewer.roles.some((r) => ADMIN_ROLES.includes(r))) {
      throw new BusinessError(
        'AUTH_INSUFFICIENT_ROLE',
        'Only admin/ops/franchise_owner can list role requests',
        403,
      );
    }

    return this.prisma.roleRequest.findMany({
      where: { status: RoleRequestStatus.PENDING },
      orderBy: { createdAt: 'asc' },
    });
  }

  async reviewRequest(
    requestId: string,
    reviewerUserId: string,
    approved: boolean,
    reviewNotes?: string,
  ) {
    // Verify reviewer has admin privileges
    const reviewer = await this.prisma.user.findUnique({
      where: { id: reviewerUserId },
    });

    if (!reviewer || !reviewer.roles.some((r) => ADMIN_ROLES.includes(r))) {
      throw new BusinessError(
        'AUTH_INSUFFICIENT_ROLE',
        'Only admin/ops/franchise_owner can review role requests',
        403,
      );
    }

    const request = await this.prisma.roleRequest.findUnique({
      where: { id: requestId },
    });

    if (!request) {
      throw new BusinessError('REQUEST_NOT_FOUND', 'Role request not found', 404);
    }

    if (request.status !== RoleRequestStatus.PENDING) {
      throw new BusinessError(
        'REQUEST_ALREADY_REVIEWED',
        `Request has already been ${request.status.toLowerCase()}`,
        409,
      );
    }

    const newStatus = approved
      ? RoleRequestStatus.APPROVED
      : RoleRequestStatus.REJECTED;

    const updatedRequest = await this.prisma.roleRequest.update({
      where: { id: requestId },
      data: {
        status: newStatus,
        reviewedBy: reviewerUserId,
        reviewedAt: new Date(),
        reviewNotes,
      },
    });

    // If approved, add the role to the user
    if (approved) {
      const targetUser = await this.prisma.user.findUnique({
        where: { id: request.userId },
      });

      if (targetUser && !targetUser.roles.includes(request.requestedRole)) {
        const updatedRoles = [...targetUser.roles, request.requestedRole];

        await this.prisma.user.update({
          where: { id: request.userId },
          data: {
            roles: updatedRoles,
            status: UserStatus.ACTIVE,
          },
        });

        // Sync Firebase custom claims
        try {
          await admin.auth().setCustomUserClaims(targetUser.firebaseUid, {
            roles: updatedRoles,
            cityId: targetUser.cityId,
            primaryRole: targetUser.primaryRole,
          });
        } catch (claimsError) {
          logger.warn({ err: claimsError }, 'Failed to sync Firebase claims');
        }
      }
    }

    return updatedRequest;
  }
}
