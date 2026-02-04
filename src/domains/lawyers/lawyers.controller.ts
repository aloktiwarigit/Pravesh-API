import { Request, Response, NextFunction } from 'express';
import { LawyerService } from './lawyers.service';
import {
  lawyerRegisterSchema,
  lawyerVerifySchema,
  assignExpertiseSchema,
  requestExpertiseSchema,
  reviewExpertiseRequestSchema,
  createLegalCaseSchema,
  acceptCaseSchema,
  declineCaseSchema,
  submitOpinionSchema,
  reviewOpinionSchema,
  rateOpinionSchema,
  lawyerBankAccountSchema,
  reassignCaseSchema,
  updateCommissionSchema,
  deactivateLawyerSchema,
  toggleDndSchema,
  logDocumentAccessSchema,
  requestDocumentSchema,
} from './lawyers.validation';

export class LawyerController {
  constructor(private readonly lawyerService: LawyerService) {}

  // ============================================================
  // Story 12-1: Registration & Verification
  // ============================================================

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = lawyerRegisterSchema.parse(req.body);
      const userId = (req as any).user.uid;
      const cityId = (req as any).user.cityId;

      const lawyer = await this.lawyerService.register(userId, cityId, {
        barCouncilNumber: input.barCouncilNumber,
        stateBarCouncil: input.stateBarCouncil,
        admissionYear: input.admissionYear,
        practicingCertUrl: input.practicingCertUrl,
        barCouncilIdUrl: input.barCouncilIdUrl,
      });

      res.status(201).json({
        success: true,
        data: { lawyerId: lawyer.id, status: lawyer.lawyerStatus },
      });
    } catch (error) {
      next(error);
    }
  };

  verify = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = lawyerVerifySchema.parse(req.body);
      const verifiedBy = (req as any).user.uid;
      const lawyer = await this.lawyerService.verify(input, verifiedBy);
      res.json({
        success: true,
        data: { lawyerId: (lawyer as any).id, status: (lawyer as any).lawyerStatus },
      });
    } catch (error) {
      next(error);
    }
  };

  getMyProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user.uid;
      const lawyer = await this.lawyerService.getLawyerByUserId(userId);
      res.json({ success: true, data: lawyer });
    } catch (error) {
      next(error);
    }
  };

  getPendingVerifications = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cityId = (req as any).user.cityId;
      const lawyers = await this.lawyerService.getPendingVerifications(cityId);
      res.json({ success: true, data: lawyers });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================
  // Story 12-2: Expertise Tagging
  // ============================================================

  assignExpertise = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { lawyerId, tags } = assignExpertiseSchema.parse(req.body);
      const result = await this.lawyerService.assignExpertise(
        lawyerId,
        tags,
        (req as any).user.uid,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  requestExpertise = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = requestExpertiseSchema.parse(req.body);
      const lawyer = await this.lawyerService.getLawyerByUserId((req as any).user.uid);
      if (!lawyer) {
        res.status(404).json({ success: false, error: { code: 'LAWYER_NOT_FOUND', message: 'Lawyer profile not found' } });
        return;
      }
      const result = await this.lawyerService.requestExpertiseTag(
        lawyer.id,
        input.requestedTag,
        input.supportingDocUrl,
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  reviewExpertiseRequest = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = reviewExpertiseRequestSchema.parse(req.body);
      const result = await this.lawyerService.reviewExpertiseRequest(
        input.requestId,
        input.action,
        (req as any).user.uid,
        input.rejectionReason,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================
  // Story 12-3: Case Routing
  // ============================================================

  getSuggestedLawyers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { expertiseTag } = req.query;
      const cityId = (req as any).user.cityId;
      const lawyers = await this.lawyerService.getSuggestedLawyers(
        expertiseTag as string,
        cityId,
      );
      res.json({ success: true, data: lawyers });
    } catch (error) {
      next(error);
    }
  };

  createLegalCase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = createLegalCaseSchema.parse(req.body);
      const legalCase = await this.lawyerService.createLegalCase(
        input,
        (req as any).user.uid,
        (req as any).user.cityId,
      );
      res.status(201).json({ success: true, data: legalCase });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================
  // Story 12-4: Case Accept/Decline
  // ============================================================

  acceptCase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { caseId } = req.params;
      const lawyer = await this.lawyerService.getLawyerByUserId((req as any).user.uid);
      if (!lawyer) {
        res.status(404).json({ success: false, error: { code: 'LAWYER_NOT_FOUND', message: 'Lawyer profile not found' } });
        return;
      }
      const result = await this.lawyerService.acceptCase(caseId, lawyer.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  declineCase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { caseId } = req.params;
      const input = declineCaseSchema.parse({ caseId, ...req.body });
      const lawyer = await this.lawyerService.getLawyerByUserId((req as any).user.uid);
      if (!lawyer) {
        res.status(404).json({ success: false, error: { code: 'LAWYER_NOT_FOUND', message: 'Lawyer profile not found' } });
        return;
      }
      const result = await this.lawyerService.declineCase(
        caseId,
        lawyer.id,
        input.reason,
        input.reasonText,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getCaseDetails = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { caseId } = req.params;
      const lawyer = await this.lawyerService.getLawyerByUserId((req as any).user.uid);
      if (!lawyer) {
        res.status(404).json({ success: false, error: { code: 'LAWYER_NOT_FOUND', message: 'Lawyer profile not found' } });
        return;
      }
      const result = await this.lawyerService.getCaseDetails(caseId, lawyer.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getMyCases = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lawyer = await this.lawyerService.getLawyerByUserId((req as any).user.uid);
      if (!lawyer) {
        res.status(404).json({ success: false, error: { code: 'LAWYER_NOT_FOUND', message: 'Lawyer profile not found' } });
        return;
      }
      const cases = await this.lawyerService.getLawyerCases(lawyer.id);
      res.json({ success: true, data: cases });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================
  // Story 12-5: Document Access
  // ============================================================

  getCaseDocuments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { caseId } = req.params;
      const lawyer = await this.lawyerService.getLawyerByUserId((req as any).user.uid);
      if (!lawyer) {
        res.status(404).json({ success: false, error: { code: 'LAWYER_NOT_FOUND', message: 'Lawyer profile not found' } });
        return;
      }
      const documents = await this.lawyerService.getCaseDocuments(caseId, lawyer.id);
      res.json({ success: true, data: documents });
    } catch (error) {
      next(error);
    }
  };

  logDocumentAccess = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { caseId, documentId } = req.params;
      const { accessType } = logDocumentAccessSchema.parse(req.body);
      const lawyer = await this.lawyerService.getLawyerByUserId((req as any).user.uid);
      if (!lawyer) {
        res.status(404).json({ success: false, error: { code: 'LAWYER_NOT_FOUND', message: 'Lawyer profile not found' } });
        return;
      }
      await this.lawyerService.logDocumentAccess(caseId, lawyer.id, documentId, accessType);
      res.json({ success: true });
    } catch (error) {
      next(error);
    }
  };

  requestDocument = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { caseId } = req.params;
      const { requestText } = requestDocumentSchema.parse(req.body);
      const lawyer = await this.lawyerService.getLawyerByUserId((req as any).user.uid);
      if (!lawyer) {
        res.status(404).json({ success: false, error: { code: 'LAWYER_NOT_FOUND', message: 'Lawyer profile not found' } });
        return;
      }
      const result = await this.lawyerService.requestAdditionalDocument(
        caseId,
        lawyer.id,
        requestText,
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================
  // Story 12-6: Legal Opinion Upload
  // ============================================================

  submitOpinion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = submitOpinionSchema.parse(req.body);
      const lawyer = await this.lawyerService.getLawyerByUserId((req as any).user.uid);
      if (!lawyer) {
        res.status(404).json({ success: false, error: { code: 'LAWYER_NOT_FOUND', message: 'Lawyer profile not found' } });
        return;
      }
      const result = await this.lawyerService.submitOpinion(
        input.caseId,
        lawyer.id,
        input.opinionDocUrl,
        input.opinionType,
        input.summary,
        input.conditions,
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  reviewOpinion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = reviewOpinionSchema.parse(req.body);
      const result = await this.lawyerService.reviewOpinion(
        input.opinionId,
        input.action,
        (req as any).user.uid,
        input.reviewNotes,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================
  // Story 12-7: Customer Receives Opinion
  // ============================================================

  deliverOpinion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { opinionId } = req.params;
      const result = await this.lawyerService.deliverOpinion(opinionId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getOpinionForCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { serviceRequestId } = req.params;
      const result = await this.lawyerService.getOpinionForCustomer(
        serviceRequestId,
        (req as any).user.uid,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  requestSecondOpinion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { serviceRequestId } = req.params;
      const result = await this.lawyerService.requestSecondOpinion(
        serviceRequestId,
        (req as any).user.uid,
      );
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================
  // Story 12-8: Payments & Bank Account
  // ============================================================

  completeCase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { caseId } = req.params;
      const result = await this.lawyerService.completeCase(caseId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  saveBankAccount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = lawyerBankAccountSchema.parse(req.body);
      const lawyer = await this.lawyerService.getLawyerByUserId((req as any).user.uid);
      if (!lawyer) {
        res.status(404).json({ success: false, error: { code: 'LAWYER_NOT_FOUND', message: 'Lawyer profile not found' } });
        return;
      }
      const result = await this.lawyerService.saveBankAccount(lawyer.id, input);
      res.status(201).json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  getBankAccounts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lawyer = await this.lawyerService.getLawyerByUserId((req as any).user.uid);
      if (!lawyer) {
        res.status(404).json({ success: false, error: { code: 'LAWYER_NOT_FOUND', message: 'Lawyer profile not found' } });
        return;
      }
      const accounts = await this.lawyerService.getBankAccounts(lawyer.id);
      res.json({ success: true, data: accounts });
    } catch (error) {
      next(error);
    }
  };

  getPayoutHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lawyer = await this.lawyerService.getLawyerByUserId((req as any).user.uid);
      if (!lawyer) {
        res.status(404).json({ success: false, error: { code: 'LAWYER_NOT_FOUND', message: 'Lawyer profile not found' } });
        return;
      }
      const payouts = await this.lawyerService.getPayoutHistory(lawyer.id, req.query as any);
      res.json({ success: true, data: payouts });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================
  // Story 12-9: Rating
  // ============================================================

  rateOpinion = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = rateOpinionSchema.parse(req.body);
      const result = await this.lawyerService.rateOpinion(
        input.caseId,
        (req as any).user.uid,
        input.rating,
        input.feedback,
      );
      res.status(201).json({ success: true, data: { ratingId: result.ratingRecord.id } });
    } catch (error) {
      next(error);
    }
  };

  getMyRatingSummary = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lawyer = await this.lawyerService.getLawyerByUserId((req as any).user.uid);
      if (!lawyer) {
        res.status(404).json({ success: false, error: { code: 'LAWYER_NOT_FOUND', message: 'Lawyer profile not found' } });
        return;
      }
      const summary = await this.lawyerService.getLawyerRatingSummary(lawyer.id);
      res.json({ success: true, data: summary });
    } catch (error) {
      next(error);
    }
  };

  getLawyerRatingsOps = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { lawyerId } = req.params;
      const ratings = await this.lawyerService.getLawyerRatingsForOps(lawyerId);
      const summary = await this.lawyerService.getLawyerRatingSummary(lawyerId);
      res.json({ success: true, data: { summary, ratings } });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================
  // Story 12-10: Earnings Dashboard
  // ============================================================

  getEarningsDashboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lawyer = await this.lawyerService.getLawyerByUserId((req as any).user.uid);
      if (!lawyer) {
        res.status(404).json({ success: false, error: { code: 'LAWYER_NOT_FOUND', message: 'Lawyer profile not found' } });
        return;
      }
      const { month, year } = req.query;
      const dashboard = await this.lawyerService.getEarningsDashboard(
        lawyer.id,
        month ? Number(month) : undefined,
        year ? Number(year) : undefined,
      );
      const performance = await this.lawyerService.getPerformanceMetrics(lawyer.id);
      const nextPayout = await this.lawyerService.getNextPayoutInfo(lawyer.id);
      res.json({ success: true, data: { ...dashboard, performance, nextPayout } });
    } catch (error) {
      next(error);
    }
  };

  getCaseHistory = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const lawyer = await this.lawyerService.getLawyerByUserId((req as any).user.uid);
      if (!lawyer) {
        res.status(404).json({ success: false, error: { code: 'LAWYER_NOT_FOUND', message: 'Lawyer profile not found' } });
        return;
      }
      const cases = await this.lawyerService.getCaseHistory(lawyer.id, req.query as any);
      res.json({ success: true, data: cases });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================
  // Story 12-11: Ops Marketplace Management
  // ============================================================

  getMarketplaceDashboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cityId = (req as any).user.cityId;
      const dashboard = await this.lawyerService.getMarketplaceDashboard(cityId);
      res.json({ success: true, data: dashboard });
    } catch (error) {
      next(error);
    }
  };

  getLawyerLeaderboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cityId = (req as any).user.cityId;
      const leaderboard = await this.lawyerService.getLawyerLeaderboard(cityId);
      res.json({ success: true, data: leaderboard });
    } catch (error) {
      next(error);
    }
  };

  getLawyerDetailOps = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { lawyerId } = req.params;
      const detail = await this.lawyerService.getLawyerDetailForOps(lawyerId);
      res.json({ success: true, data: detail });
    } catch (error) {
      next(error);
    }
  };

  reassignCase = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = reassignCaseSchema.parse(req.body);
      const result = await this.lawyerService.reassignCase(
        input.caseId,
        input.newLawyerId,
        (req as any).user.uid,
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  updateCommissionRate = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { lawyerId } = req.params;
      const { commissionRate } = updateCommissionSchema.parse({ lawyerId, ...req.body });
      const result = await this.lawyerService.updateCommissionRate(lawyerId, commissionRate);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  deactivateLawyer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { lawyerId } = req.params;
      const { reason } = deactivateLawyerSchema.parse({ lawyerId, ...req.body });
      const result = await this.lawyerService.deactivateLawyer(lawyerId, reason);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  };

  // ============================================================
  // Story 12-12: DND Toggle
  // ============================================================

  toggleDnd = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { enabled } = toggleDndSchema.parse(req.body);
      const lawyer = await this.lawyerService.getLawyerByUserId((req as any).user.uid);
      if (!lawyer) {
        res.status(404).json({ success: false, error: { code: 'LAWYER_NOT_FOUND', message: 'Lawyer profile not found' } });
        return;
      }
      const result = await this.lawyerService.toggleDnd(lawyer.id, enabled);
      res.json({ success: true, data: { dndEnabled: result.dndEnabled } });
    } catch (error) {
      next(error);
    }
  };
}
