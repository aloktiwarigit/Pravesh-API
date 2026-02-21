// Story 6.13: Enhanced Audit Logger — immutable append-only logging for all security-sensitive operations
import { prisma } from '../shared/prisma/client';
import { logger } from '../shared/utils/logger';

export interface AuditLogInput {
  userId: string;
  userRole?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  serviceInstanceId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  deviceInfo?: string;
}

/**
 * Creates an immutable audit log entry.
 * The audit_logs table has database-level triggers preventing UPDATE and DELETE.
 */
export async function auditLog(input: AuditLogInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId,
        userRole: input.userRole || 'unknown',
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        serviceInstanceId: input.serviceInstanceId || null,
        metadata: input.metadata || {},
        ipAddress: input.ipAddress || null,
        userAgent: input.userAgent || null,
        deviceInfo: input.deviceInfo || null,
      },
    });
  } catch (error) {
    // Audit logging should never break the main flow
    logger.error({ err: error }, 'Failed to create audit log entry');
  }
}
