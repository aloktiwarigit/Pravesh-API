/**
 * Fee variance controller.
 *
 * Story 4.6: Fee Variance Handling
 */
import { Request, Response } from 'express';
import { FeeVarianceService } from './fee-variance.service.js';

export class FeeVarianceController {
  constructor(private readonly feeVarianceService: FeeVarianceService) {}

  reportVariance = async (req: Request, res: Response) => {
    const {
      serviceRequestId,
      estimatedGovtFeePaise,
      actualGovtFeePaise,
      varianceReasonEn,
      varianceReasonHi,
      evidenceUrls,
    } = req.body;

    const result = await this.feeVarianceService.reportVariance({
      serviceRequestId,
      estimatedGovtFeePaise: Number(estimatedGovtFeePaise),
      actualGovtFeePaise: Number(actualGovtFeePaise),
      varianceReasonEn,
      varianceReasonHi,
      reportedByOpsId: req.user!.id,
      cityId: req.user!.cityId!,
      evidenceUrls,
    });

    res.status(201).json({ success: true, data: result });
  };

  resolveVariance = async (req: Request, res: Response) => {
    const { varianceId, resolution, adjustedAmountPaise, resolutionNotes } = req.body;

    const result = await this.feeVarianceService.resolveVariance({
      varianceId,
      resolution,
      adjustedAmountPaise: adjustedAmountPaise ? Number(adjustedAmountPaise) : undefined,
      resolutionNotes,
      resolvedByOpsId: req.user!.id,
    });

    res.json({ success: true, data: result });
  };

  getVariances = async (req: Request, res: Response) => {
    const { serviceRequestId } = req.params;
    const variances = await this.feeVarianceService.getVariances(serviceRequestId);
    res.json({ success: true, data: variances });
  };

  getPendingVariances = async (req: Request, res: Response) => {
    const cityId = req.user!.cityId!;
    const variances = await this.feeVarianceService.getPendingVariances(cityId);

    res.json({
      success: true,
      data: variances.map((v) => ({
        id: v.id,
        serviceRequestId: v.serviceRequestId,
        estimatedGovtFeePaise: v.estimatedGovtFeePaise.toString(),
        actualGovtFeePaise: v.actualGovtFeePaise.toString(),
        variancePaise: v.variancePaise.toString(),
        status: v.status,
        createdAt: v.createdAt.toISOString(),
      })),
    });
  };
}
