/**
 * Fee variance service for reporting and resolving government fee discrepancies.
 *
 * Story 4.6: Fee Variance Handling
 */
import { PrismaClient } from '@prisma/client';
import { AppError } from '../../core/errors/app-error.js';

export class FeeVarianceService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Reports a fee variance when actual govt fee differs from estimate.
   * Story 4.6 AC1
   */
  async reportVariance(params: {
    serviceRequestId: string;
    estimatedGovtFeePaise: number;
    actualGovtFeePaise: number;
    varianceReasonEn: string;
    varianceReasonHi: string;
    reportedByOpsId: string;
    cityId: string;
    evidenceUrls?: string[];
  }) {
    const variancePaise = params.actualGovtFeePaise - params.estimatedGovtFeePaise;

    const variance = await this.prisma.feeVariance.create({
      data: {
        serviceRequestId: params.serviceRequestId,
        estimatedGovtFeePaise: params.estimatedGovtFeePaise,
        actualGovtFeePaise: params.actualGovtFeePaise,
        variancePaise,
        varianceReasonEn: params.varianceReasonEn,
        varianceReasonHi: params.varianceReasonHi,
        reportedByOpsId: params.reportedByOpsId,
        status: 'PENDING',
        cityId: params.cityId,
        evidenceUrls: params.evidenceUrls || [],
      },
    });

    return {
      id: variance.id,
      variancePaise: variance.variancePaise.toString(),
      status: variance.status,
    };
  }

  /**
   * Resolves a fee variance.
   * Story 4.6 AC2
   */
  async resolveVariance(params: {
    varianceId: string;
    resolution: 'APPROVED' | 'REJECTED' | 'ADJUSTED';
    adjustedAmountPaise?: number;
    resolutionNotes: string;
    resolvedByOpsId: string;
  }) {
    const existing = await this.prisma.feeVariance.findUnique({
      where: { id: params.varianceId },
    });

    if (!existing) {
      throw new AppError('VARIANCE_NOT_FOUND', 'Fee variance not found', 404);
    }

    if (existing.status !== 'PENDING') {
      throw new AppError('VARIANCE_ALREADY_RESOLVED', 'Fee variance has already been resolved', 422);
    }

    const updated = await this.prisma.feeVariance.update({
      where: { id: params.varianceId },
      data: {
        status: params.resolution,
        adjustedAmountPaise: params.adjustedAmountPaise,
        resolutionNotes: params.resolutionNotes,
        resolvedByOpsId: params.resolvedByOpsId,
        resolvedAt: new Date(),
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      resolvedAt: updated.resolvedAt?.toISOString(),
    };
  }

  /**
   * Gets variances for a service request.
   */
  async getVariances(serviceRequestId: string) {
    const variances = await this.prisma.feeVariance.findMany({
      where: { serviceRequestId },
      orderBy: { createdAt: 'desc' },
    });

    return variances.map((v) => ({
      id: v.id,
      estimatedGovtFeePaise: v.estimatedGovtFeePaise.toString(),
      actualGovtFeePaise: v.actualGovtFeePaise.toString(),
      variancePaise: v.variancePaise.toString(),
      varianceReasonEn: v.varianceReasonEn,
      varianceReasonHi: v.varianceReasonHi,
      status: v.status,
      resolvedAt: v.resolvedAt?.toISOString() ?? null,
      createdAt: v.createdAt.toISOString(),
    }));
  }

  /**
   * Gets pending variances for ops dashboard.
   */
  async getPendingVariances(cityId: string) {
    return this.prisma.feeVariance.findMany({
      where: { cityId, status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
  }
}
