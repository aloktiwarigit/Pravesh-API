/**
 * Cash reconciliation controller.
 *
 * Story 4.8: Cash Reconciliation Dashboard for Ops
 */
import { Request, Response } from 'express';
import { ReconciliationService } from './reconciliation.service.js';

export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  runReconciliation = async (req: Request, res: Response) => {
    const cityId = req.user!.cityId!;
    const date = req.body.date ? new Date(req.body.date) : new Date();

    const result = await this.reconciliationService.runDailyReconciliation(cityId, date);
    res.json({ success: true, data: result });
  };

  getLogs = async (req: Request, res: Response) => {
    const cityId = req.user!.cityId!;
    const startDate = new Date(req.query.startDate as string);
    const endDate = new Date(req.query.endDate as string);

    const logs = await this.reconciliationService.getReconciliationLogs(
      cityId,
      startDate,
      endDate,
    );
    res.json({ success: true, data: logs });
  };
}
