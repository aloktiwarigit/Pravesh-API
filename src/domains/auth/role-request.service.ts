import { Prisma, PrismaClient, RoleRequestStatus, UserStatus } from '@prisma/client';
import admin from 'firebase-admin';
import { BusinessError } from '../../shared/errors/business-error';
import { logger } from '../../shared/utils/logger';

const REQUESTABLE_ROLES = ['agent', 'dealer', 'lawyer', 'builder'];
const ADMIN_ROLES = ['super_admin', 'ops', 'franchise_owner'];

export class RoleRequestService {
  constructor(private readonly prisma: PrismaClient) {}

  async createRequest(
    userId: string,
    requestedRole: string,
    notes?: string,
    roleMetadata?: Record<string, unknown>,
  ) {
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

    // Validate that cityId exists if provided in metadata
    if (roleMetadata?.cityId) {
      const city = await this.prisma.city.findUnique({
        where: { id: roleMetadata.cityId as string },
      });
      if (!city) {
        throw new BusinessError('INVALID_CITY', 'City not found', 400);
      }
    }

    return this.prisma.roleRequest.create({
      data: {
        userId,
        requestedRole,
        notes,
        roleMetadata: roleMetadata
          ? (roleMetadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
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

    // If approved, add the role to the user and create entity record
    if (approved) {
      const targetUser = await this.prisma.user.findUnique({
        where: { id: request.userId },
      });

      if (targetUser && !targetUser.roles.includes(request.requestedRole)) {
        const updatedRoles = [...targetUser.roles, request.requestedRole];
        const metadata = (request.roleMetadata as Record<string, unknown>) ?? {};

        // Update user roles and cityId if not already set
        const userUpdate: Record<string, unknown> = {
          roles: updatedRoles,
          status: UserStatus.ACTIVE,
        };
        if (!targetUser.cityId && metadata.cityId) {
          userUpdate.cityId = metadata.cityId;
        }

        await this.prisma.user.update({
          where: { id: request.userId },
          data: userUpdate,
        });

        // Create the role-specific entity record
        await this.createEntityRecord(
          request.requestedRole,
          request.userId,
          targetUser,
          metadata,
        );

        // Sync Firebase custom claims
        try {
          const claimsCityId = (targetUser.cityId ?? metadata.cityId) as string | undefined;
          await admin.auth().setCustomUserClaims(targetUser.firebaseUid, {
            roles: updatedRoles,
            cityId: claimsCityId,
            primaryRole: targetUser.primaryRole,
          });
        } catch (claimsError) {
          logger.warn({ err: claimsError }, 'Failed to sync Firebase claims');
        }
      }
    }

    return updatedRequest;
  }

  private async createEntityRecord(
    role: string,
    userId: string,
    user: { displayName: string | null; phone: string | null },
    metadata: Record<string, unknown>,
  ) {
    try {
      switch (role) {
        case 'agent':
          await this.prisma.agent.create({
            data: {
              userId,
              cityId: metadata.cityId as string,
              name: user.displayName ?? '',
              phone: user.phone ?? '',
            },
          });
          break;

        case 'dealer':
          await this.prisma.dealer.create({
            data: {
              userId,
              cityId: metadata.cityId as string,
              businessName: metadata.businessName as string,
              dealerStatus: 'PENDING_KYC',
            },
          });
          break;

        case 'lawyer':
          await this.prisma.lawyer.create({
            data: {
              userId,
              cityId: metadata.cityId as string,
              barCouncilNumber: metadata.barCouncilNumber as string,
              stateBarCouncil: metadata.stateBarCouncil as string,
              admissionYear: metadata.admissionYear as number,
              practicingCertUrl: metadata.practicingCertUrl as string,
              lawyerStatus: 'PENDING_VERIFICATION',
            },
          });
          break;

        case 'builder':
          await this.prisma.builder.create({
            data: {
              userId,
              cityId: metadata.cityId as string,
              companyName: metadata.companyName as string,
              reraNumber: metadata.reraNumber as string,
              gstNumber: metadata.gstNumber as string,
              contactPhone: metadata.contactPhone as string,
              status: 'PENDING_VERIFICATION',
            },
          });
          break;
      }
      logger.info({ role, userId }, 'Entity record created on role approval');
    } catch (err) {
      // P2002 = unique constraint violation — entity already exists
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        logger.warn({ role, userId }, 'Entity record already exists, skipping creation');
        return;
      }
      throw err;
    }
  }
}
