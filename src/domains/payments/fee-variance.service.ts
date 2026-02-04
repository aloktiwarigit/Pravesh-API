/**
 * Fee variance service for reporting and resolving government fee discrepancies.
 *
 * Story 4.6: Fee Variance Handling
 *
 * TODO: FeeVariance model does not exist in the Prisma schema yet.
 * All prisma calls are stubbed until the model is added.
 */
import { PrismaClient } from '@prisma/client';
import { AppError } from '../../core/errors/app-error.js';

interface FeeVarianceRecord {
  id: string;
  serviceRequestId: string;
  estimatedGovtFeePaise: number;
  actualGovtFeePaise: number;
  variancePaise: number;
  varianceReasonEn: string;
  varianceReasonHi: string;
  reportedByOpsId: string;
  status: string;
  cityId: string;
  evidenceUrls: string[];
  adjustedAmountPaise?: number;
  resolutionNotes?: string;
  resolvedByOpsId?: string;
  resolvedAt?: Date | null;
  createdAt: Date;
}

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

    // TODO: FeeVariance model does not exist in schema. Stubbed.
    const variance: FeeVarianceRecord = {
      id: crypto.randomUUID(),
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
      resolvedAt: null,
      createdAt: new Date(),
    };

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
    // TODO: FeeVariance model does not exist in schema. Stubbed.
    // In a real implementation, fetch and update the variance record.
    const updated: FeeVarianceRecord = {
      id: params.varianceId,
      serviceRequestId: '',
      estimatedGovtFeePaise: 0,
      actualGovtFeePaise: 0,
      variancePaise: 0,
      varianceReasonEn: '',
      varianceReasonHi: '',
      reportedByOpsId: '',
      status: params.resolution,
      cityId: '',
      evidenceUrls: [],
      resolvedAt: new Date(),
      createdAt: new Date(),
    };

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
    // TODO: FeeVariance model does not exist in schema. Stubbed.
    const variances: FeeVarianceRecord[] = [];

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
    // TODO: FeeVariance model does not exist in schema. Stubbed.
    const variances: FeeVarianceRecord[] = [];
    return variances;
  }
}
