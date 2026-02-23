import { PrismaClient, LawyerStatus, Prisma } from '@prisma/client';
import { BusinessError } from '../../shared/errors/business-error';
import { encrypt } from '../../shared/utils/encryption';

export class LawyerService {
  constructor(private readonly prisma: PrismaClient) {}

  // ============================================================
  // Story 12-1: Registration & Verification
  // ============================================================

  async register(
    userId: string,
    cityId: string,
    input: {
      barCouncilNumber: string;
      stateBarCouncil: string;
      admissionYear: number;
      practicingCertUrl: string;
      barCouncilIdUrl?: string;
    },
  ) {
    const existing = await this.prisma.lawyer.findUnique({ where: { userId } });
    if (existing?.lawyerStatus === LawyerStatus.VERIFIED) {
      throw new BusinessError('LAWYER_ALREADY_VERIFIED', 'Lawyer is already verified');
    }

    return this.prisma.lawyer.upsert({
      where: { userId },
      update: {
        barCouncilNumber: input.barCouncilNumber,
        stateBarCouncil: input.stateBarCouncil,
        admissionYear: input.admissionYear,
        practicingCertUrl: input.practicingCertUrl,
        barCouncilIdUrl: input.barCouncilIdUrl,
        lawyerStatus: LawyerStatus.PENDING_VERIFICATION,
        rejectionReason: null,
      },
      create: {
        userId,
        cityId,
        barCouncilNumber: input.barCouncilNumber,
        stateBarCouncil: input.stateBarCouncil,
        admissionYear: input.admissionYear,
        practicingCertUrl: input.practicingCertUrl,
        barCouncilIdUrl: input.barCouncilIdUrl,
      },
    });
  }

  async verify(
    input: { lawyerId: string; action: 'approve' | 'reject'; rejectionReason?: string },
    verifiedByUserId: string,
  ) {
    const lawyer = await this.prisma.lawyer.findUniqueOrThrow({
      where: { id: input.lawyerId },
    });

    if (lawyer.lawyerStatus === LawyerStatus.VERIFIED) {
      throw new BusinessError('LAWYER_ALREADY_VERIFIED', 'Lawyer is already verified');
    }

    if (input.action === 'approve') {
      return this.prisma.lawyer.update({
        where: { id: input.lawyerId },
        data: {
          lawyerStatus: LawyerStatus.VERIFIED,
          verifiedBy: verifiedByUserId,
          verifiedAt: new Date(),
        },
      });
    } else {
      return this.prisma.lawyer.update({
        where: { id: input.lawyerId },
        data: {
          lawyerStatus: LawyerStatus.REJECTED,
          rejectionReason: input.rejectionReason,
        },
      });
    }
  }

  async getLawyerByUserId(userId: string) {
    return this.prisma.lawyer.findUnique({
      where: { userId },
      include: { expertise: true },
    });
  }

  async getLawyerById(lawyerId: string) {
    return this.prisma.lawyer.findUniqueOrThrow({
      where: { id: lawyerId },
      include: { expertise: true },
    });
  }

  async getPendingVerifications(cityId: string) {
    return this.prisma.lawyer.findMany({
      where: { cityId, lawyerStatus: LawyerStatus.PENDING_VERIFICATION },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ============================================================
  // Story 12-2: Expertise Tagging
  // ============================================================

  async assignExpertise(lawyerId: string, tags: string[], assignedBy: string) {
    const lawyer = await this.prisma.lawyer.findUniqueOrThrow({
      where: { id: lawyerId },
    });
    if (lawyer.lawyerStatus !== LawyerStatus.VERIFIED) {
      throw new BusinessError('LAWYER_NOT_VERIFIED', 'Cannot assign expertise to unverified lawyer');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.lawyerExpertise.deleteMany({ where: { lawyerId } });
      await tx.lawyerExpertise.createMany({
        data: tags.map((tag) => ({
          lawyerId,
          expertiseTag: tag as any,
          assignedBy,
        })),
      });
      return tx.lawyerExpertise.findMany({ where: { lawyerId } });
    });
  }

  async requestExpertiseTag(lawyerId: string, requestedTag: string, supportingDocUrl?: string) {
    return this.prisma.lawyerExpertiseRequest.create({
      data: { lawyerId, requestedTag: requestedTag as any, supportingDocUrl },
    });
  }

  async reviewExpertiseRequest(
    requestId: string,
    action: string,
    reviewedBy: string,
    rejectionReason?: string,
  ) {
    const request = await this.prisma.lawyerExpertiseRequest.findUniqueOrThrow({
      where: { id: requestId },
    });

    if (action === 'approve') {
      return this.prisma.$transaction(async (tx) => {
        await tx.lawyerExpertiseRequest.update({
          where: { id: requestId },
          data: { status: 'APPROVED', reviewedBy, reviewedAt: new Date() },
        });
        await tx.lawyerExpertise.upsert({
          where: {
            lawyerId_expertiseTag: {
              lawyerId: request.lawyerId,
              expertiseTag: request.requestedTag,
            },
          },
          update: {},
          create: {
            lawyerId: request.lawyerId,
            expertiseTag: request.requestedTag,
            assignedBy: reviewedBy,
          },
        });
        return { status: 'APPROVED' };
      });
    } else {
      return this.prisma.lawyerExpertiseRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED', reviewedBy, reviewedAt: new Date(), rejectionReason },
      });
    }
  }

  async getPendingExpertiseRequests() {
    return this.prisma.lawyerExpertiseRequest.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ============================================================
  // Story 12-3: Case Routing
  // ============================================================

  async getSuggestedLawyers(expertiseTag: string, cityId: string) {
    const lawyers = await this.prisma.lawyer.findMany({
      where: {
        lawyerStatus: 'VERIFIED',
        dndEnabled: false,
        cityId,
        expertise: { some: { expertiseTag: expertiseTag as any } },
      },
      include: {
        expertise: true,
        _count: {
          select: {
            legalCases: {
              where: {
                caseStatus: {
                  in: ['ASSIGNED', 'PENDING_ACCEPTANCE', 'IN_PROGRESS'],
                },
              },
            },
          },
        },
      },
      orderBy: [{ avgRating: 'desc' }, { totalCasesCompleted: 'desc' }],
    });

    return lawyers.map((l) => ({
      id: l.id,
      userId: l.userId,
      barCouncilNumber: l.barCouncilNumber,
      stateBarCouncil: l.stateBarCouncil,
      totalCasesCompleted: l.totalCasesCompleted,
      avgRating: l.avgRating,
      commissionRate: l.commissionRate,
      lawyerTier: l.lawyerTier,
      expertiseTags: l.expertise.map((e) => e.expertiseTag),
      activeCaseCount: l._count.legalCases,
    }));
  }

  async createLegalCase(
    input: {
      serviceRequestId: string;
      requiredExpertise: string;
      lawyerId: string;
      issueSummary: string;
      caseFeeInPaise: number;
      casePriority?: string;
    },
    assignedBy: string,
    cityId: string,
  ) {
    const caseNumber = `LC-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const lawyer = await this.prisma.lawyer.findUniqueOrThrow({
      where: { id: input.lawyerId },
    });

    const priority = input.casePriority || 'NORMAL';
    const deadlineAt = new Date();
    deadlineAt.setDate(deadlineAt.getDate() + (priority === 'URGENT' ? 3 : 5));

    return this.prisma.legalCase.create({
      data: {
        caseNumber,
        serviceRequestId: input.serviceRequestId,
        lawyerId: input.lawyerId,
        requiredExpertise: input.requiredExpertise as any,
        casePriority: priority as any,
        caseStatus: 'ASSIGNED',
        issueSummary: input.issueSummary,
        caseFeeInPaise: input.caseFeeInPaise,
        platformCommission: lawyer.commissionRate,
        deadlineAt,
        assignedBy,
        cityId,
      },
      include: { lawyer: true },
    });
  }

  // ============================================================
  // Story 12-4: Case Accept/Decline
  // ============================================================

  async acceptCase(caseId: string, lawyerId: string) {
    const legalCase = await this.prisma.legalCase.findUniqueOrThrow({
      where: { id: caseId },
    });

    if (legalCase.lawyerId !== lawyerId) {
      throw new BusinessError('NOT_ASSIGNED', 'This case is not assigned to you');
    }
    if (legalCase.caseStatus !== 'ASSIGNED') {
      throw new BusinessError('INVALID_STATUS', 'Case is not in assignable status');
    }

    return this.prisma.legalCase.update({
      where: { id: caseId },
      data: {
        caseStatus: 'IN_PROGRESS',
        acceptedAt: new Date(),
      },
    });
  }

  async declineCase(caseId: string, lawyerId: string, reason: string, reasonText?: string) {
    const legalCase = await this.prisma.legalCase.findUniqueOrThrow({
      where: { id: caseId },
    });

    if (legalCase.lawyerId !== lawyerId) {
      throw new BusinessError('NOT_ASSIGNED', 'This case is not assigned to you');
    }
    if (legalCase.caseStatus !== 'ASSIGNED') {
      throw new BusinessError('INVALID_STATUS', 'Case is not in assignable status');
    }

    const declineReasonFull = reasonText ? `${reason}: ${reasonText}` : reason;

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.legalCase.update({
        where: { id: caseId },
        data: {
          caseStatus: 'REASSIGNED',
          declinedAt: new Date(),
          declineReason: declineReasonFull,
        },
      });

      const lawyer = await tx.lawyer.update({
        where: { id: lawyerId },
        data: { declineCount: { increment: 1 } },
      });

      const totalAssigned = await tx.legalCase.count({
        where: { lawyerId },
      });
      const declineRate = lawyer.declineCount / Math.max(totalAssigned, 1);

      return { legalCase: updated, declineRate, flagged: declineRate > 0.3 };
    });
  }

  async getCaseDetails(caseId: string, lawyerId: string) {
    const legalCase = await this.prisma.legalCase.findUniqueOrThrow({
      where: { id: caseId },
      include: { lawyer: true },
    });

    if (legalCase.lawyerId !== lawyerId) {
      throw new BusinessError('NOT_ASSIGNED', 'This case is not assigned to you');
    }

    const grossFee = legalCase.caseFeeInPaise;
    const commissionAmount = Math.round(grossFee * legalCase.platformCommission / 100);
    const netPayout = grossFee - commissionAmount;

    return {
      ...legalCase,
      feeBreakdown: {
        grossFeeInPaise: grossFee,
        commissionPercentage: legalCase.platformCommission,
        commissionAmountInPaise: commissionAmount,
        netPayoutInPaise: netPayout,
      },
    };
  }

  async getLawyerCases(lawyerId: string) {
    return this.prisma.legalCase.findMany({
      where: { lawyerId },
      include: {
        opinion: { select: { opinionType: true, submittedAt: true, approvalStatus: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================================
  // Story 12-5: Document Access (Scoped)
  // ============================================================

  async getCaseDocuments(caseId: string, lawyerId: string) {
    const legalCase = await this.prisma.legalCase.findUniqueOrThrow({
      where: { id: caseId },
    });

    if (legalCase.lawyerId !== lawyerId) {
      throw new BusinessError('NOT_ASSIGNED', 'You are not assigned to this case');
    }
    if (!['IN_PROGRESS', 'OPINION_SUBMITTED', 'OPINION_APPROVED'].includes(legalCase.caseStatus)) {
      throw new BusinessError('CASE_NOT_ACCEPTED', 'Case must be accepted to access documents');
    }

    // In a full implementation, this would query the documents table
    // scoped to the service request
    return {
      caseId,
      serviceRequestId: legalCase.serviceRequestId,
      message: 'Documents scoped to this case service request',
    };
  }

  async logDocumentAccess(caseId: string, lawyerId: string, documentId: string, accessType: string) {
    return this.prisma.legalCaseDocAccess.create({
      data: {
        legalCaseId: caseId,
        lawyerId,
        documentId,
        accessType,
      },
    });
  }

  async requestAdditionalDocument(caseId: string, lawyerId: string, requestText: string) {
    const legalCase = await this.prisma.legalCase.findUniqueOrThrow({
      where: { id: caseId },
    });

    if (legalCase.lawyerId !== lawyerId) {
      throw new BusinessError('NOT_ASSIGNED', 'You are not assigned to this case');
    }

    return this.prisma.legalCaseDocRequest.create({
      data: { legalCaseId: caseId, lawyerId, requestText },
    });
  }

  // ============================================================
  // Story 12-6: Legal Opinion Upload
  // ============================================================

  async submitOpinion(
    caseId: string,
    lawyerId: string,
    opinionDocUrl: string,
    opinionType: string,
    summary?: string,
    conditions?: string,
  ) {
    const legalCase = await this.prisma.legalCase.findUniqueOrThrow({
      where: { id: caseId },
    });

    if (legalCase.lawyerId !== lawyerId) {
      throw new BusinessError('NOT_ASSIGNED', 'You are not assigned to this case');
    }
    if (legalCase.caseStatus !== 'IN_PROGRESS') {
      throw new BusinessError('INVALID_STATUS', 'Case must be in progress to submit opinion');
    }

    const existing = await this.prisma.legalOpinion.findUnique({
      where: { legalCaseId: caseId },
    });
    if (existing) {
      throw new BusinessError('OPINION_EXISTS', 'Opinion already submitted for this case');
    }

    return this.prisma.$transaction(async (tx) => {
      const opinion = await tx.legalOpinion.create({
        data: {
          legalCaseId: caseId,
          lawyerId,
          opinionDocUrl,
          opinionType: opinionType as any,
          summary,
          conditions,
        },
      });

      await tx.legalCase.update({
        where: { id: caseId },
        data: { caseStatus: 'OPINION_SUBMITTED' },
      });

      return opinion;
    });
  }

  async reviewOpinion(
    opinionId: string,
    action: string,
    reviewedBy: string,
    reviewNotes?: string,
  ) {
    const opinion = await this.prisma.legalOpinion.findUniqueOrThrow({
      where: { id: opinionId },
      include: { legalCase: true },
    });

    if (opinion.approvalStatus !== 'PENDING_REVIEW') {
      throw new BusinessError('ALREADY_REVIEWED', 'Opinion has already been reviewed');
    }

    if (action === 'approve') {
      return this.prisma.$transaction(async (tx) => {
        const updated = await tx.legalOpinion.update({
          where: { id: opinionId },
          data: {
            approvalStatus: 'APPROVED',
            reviewedBy,
            reviewedAt: new Date(),
            reviewNotes,
          },
        });

        await tx.legalCase.update({
          where: { id: opinion.legalCaseId },
          data: { caseStatus: 'OPINION_APPROVED' },
        });

        return updated;
      });
    } else {
      return this.prisma.$transaction(async (tx) => {
        await tx.legalOpinion.delete({ where: { id: opinionId } });

        await tx.legalCase.update({
          where: { id: opinion.legalCaseId },
          data: { caseStatus: 'IN_PROGRESS' },
        });

        return { status: 'REJECTED', reviewNotes };
      });
    }
  }

  // ============================================================
  // Story 12-7: Customer Receives Legal Opinion
  // ============================================================

  async deliverOpinion(opinionId: string) {
    const opinion = await this.prisma.legalOpinion.findUniqueOrThrow({
      where: { id: opinionId },
      include: { legalCase: true },
    });

    if (opinion.approvalStatus !== 'APPROVED') {
      throw new BusinessError('NOT_APPROVED', 'Opinion must be approved before delivery');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.legalOpinion.update({
        where: { id: opinionId },
        data: { deliveredAt: new Date() },
      });

      await tx.legalCase.update({
        where: { id: opinion.legalCaseId },
        data: { caseStatus: 'OPINION_DELIVERED' },
      });

      return opinion;
    });
  }

  async getOpinionForCustomer(serviceRequestId: string, customerId: string) {
    // In a full implementation, we would verify the customer owns this service request
    const legalCase = await this.prisma.legalCase.findFirst({
      where: { serviceRequestId },
      include: { opinion: true },
    });

    if (!legalCase?.opinion || legalCase.opinion.approvalStatus !== 'APPROVED') {
      return null;
    }

    return {
      opinionType: legalCase.opinion.opinionType,
      summary: legalCase.opinion.summary,
      conditions: legalCase.opinion.conditions,
      opinionDocUrl: legalCase.opinion.opinionDocUrl,
      deliveredAt: legalCase.opinion.deliveredAt,
    };
  }

  async requestSecondOpinion(serviceRequestId: string, customerId: string) {
    return { message: 'Second opinion request submitted. Ops will assign a new lawyer.' };
  }

  // ============================================================
  // Story 12-8: Lawyer Payment & Marketplace Commission
  // ============================================================

  async completeCase(caseId: string) {
    const legalCase = await this.prisma.legalCase.findUniqueOrThrow({
      where: { id: caseId },
      include: { lawyer: true, opinion: true },
    });

    if (legalCase.caseStatus !== 'OPINION_DELIVERED') {
      throw new BusinessError('INVALID_STATUS', 'Case must have delivered opinion');
    }

    const grossFee = legalCase.caseFeeInPaise;
    const commissionRate = legalCase.platformCommission;
    const commissionAmount = Math.round(grossFee * commissionRate / 100);
    const netPayout = grossFee - commissionAmount;

    return this.prisma.$transaction(async (tx) => {
      await tx.legalCase.update({
        where: { id: caseId },
        data: { caseStatus: 'COMPLETED', completedAt: new Date() },
      });

      await tx.lawyer.update({
        where: { id: legalCase.lawyerId },
        data: { totalCasesCompleted: { increment: 1 } },
      });

      const payout = await tx.lawyerPayout.create({
        data: {
          lawyerId: legalCase.lawyerId,
          legalCaseId: caseId,
          grossFeeInPaise: grossFee,
          commissionRate,
          commissionInPaise: commissionAmount,
          netPayoutInPaise: netPayout,
        },
      });

      return payout;
    });
  }

  async autoConfirmPayouts() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    return this.prisma.lawyerPayout.updateMany({
      where: {
        payoutStatus: 'PENDING',
        createdAt: { lte: sevenDaysAgo },
      },
      data: { payoutStatus: 'CONFIRMED', confirmedAt: new Date() },
    });
  }

  async processPayoutBatch() {
    const confirmedPayouts = await this.prisma.lawyerPayout.findMany({
      where: { payoutStatus: 'CONFIRMED' },
      include: { lawyer: { include: { bankAccounts: { where: { isDefault: true } } } } },
    });

    const batchId = `BATCH-${Date.now()}`;

    for (const payout of confirmedPayouts) {
      await this.prisma.lawyerPayout.update({
        where: { id: payout.id },
        data: { payoutStatus: 'PROCESSING', payoutBatchId: batchId },
      });
    }

    return { batchId, count: confirmedPayouts.length };
  }

  async saveBankAccount(lawyerId: string, input: {
    accountHolderName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    upiId?: string;
  }) {
    const accountNumberMasked = `XXXX-${input.accountNumber.slice(-4)}`;
    const accountNumberEncrypted = encrypt(input.accountNumber);

    return this.prisma.lawyerBankAccount.create({
      data: {
        lawyerId,
        accountHolderName: input.accountHolderName,
        accountNumber: accountNumberMasked, // store masked in legacy field
        accountNumberEncrypted,
        accountNumberMasked,
        ifscCode: input.ifscCode,
        bankName: input.bankName,
        upiId: input.upiId,
      },
    });
  }

  async getBankAccounts(lawyerId: string) {
    return this.prisma.lawyerBankAccount.findMany({
      where: { lawyerId },
      select: {
        id: true,
        accountHolderName: true,
        bankName: true,
        ifscCode: true,
        accountNumberMasked: true,
        upiId: true,
        isDefault: true,
        isVerified: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPayoutHistory(
    lawyerId: string,
    filters?: { status?: string; fromDate?: Date; toDate?: Date },
  ) {
    return this.prisma.lawyerPayout.findMany({
      where: {
        lawyerId,
        ...(filters?.status && { payoutStatus: filters.status as any }),
        ...(filters?.fromDate && { createdAt: { gte: filters.fromDate } }),
        ...(filters?.toDate && { createdAt: { lte: filters.toDate } }),
      },
      include: {
        legalCase: {
          select: { caseNumber: true, requiredExpertise: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================================
  // Story 12-9: Customer Rates Legal Opinion Quality
  // ============================================================

  async rateOpinion(caseId: string, customerId: string, rating: number, feedback?: string) {
    const legalCase = await this.prisma.legalCase.findUniqueOrThrow({
      where: { id: caseId },
    });

    if (!['OPINION_DELIVERED', 'COMPLETED'].includes(legalCase.caseStatus)) {
      throw new BusinessError('NOT_DELIVERED', 'Opinion must be delivered before rating');
    }

    const existing = await this.prisma.legalOpinionRating.findUnique({
      where: { legalCaseId: caseId },
    });
    if (existing) {
      throw new BusinessError('ALREADY_RATED', 'You have already rated this opinion');
    }

    const ratingRecord = await this.prisma.legalOpinionRating.create({
      data: {
        legalCaseId: caseId,
        lawyerId: legalCase.lawyerId,
        customerId,
        rating,
        feedback,
      },
    });

    // Update lawyer's average rating
    const avgResult = await this.prisma.legalOpinionRating.aggregate({
      where: { lawyerId: legalCase.lawyerId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    await this.prisma.lawyer.update({
      where: { id: legalCase.lawyerId },
      data: { avgRating: avgResult._avg.rating },
    });

    const flagged = (avgResult._count.rating >= 10 && (avgResult._avg.rating ?? 0) < 3.5);

    return { ratingRecord, flagged };
  }

  async getLawyerRatingSummary(lawyerId: string) {
    const aggregate = await this.prisma.legalOpinionRating.aggregate({
      where: { lawyerId },
      _avg: { rating: true },
      _count: { rating: true },
    });

    const distribution = await this.prisma.legalOpinionRating.groupBy({
      by: ['rating'],
      where: { lawyerId },
      _count: { rating: true },
    });

    const opinionTypes = await this.prisma.legalOpinion.groupBy({
      by: ['opinionType'],
      where: { lawyerId },
      _count: { opinionType: true },
    });

    return {
      avgRating: aggregate._avg.rating,
      totalRatings: aggregate._count.rating,
      distribution: distribution.reduce((acc, d) => ({ ...acc, [d.rating]: d._count.rating }), {} as Record<number, number>),
      opinionTypeDistribution: opinionTypes.reduce((acc, o) => ({ ...acc, [o.opinionType]: o._count.opinionType }), {} as Record<string, number>),
    };
  }

  async getLawyerRatingsForOps(lawyerId: string) {
    return this.prisma.legalOpinionRating.findMany({
      where: { lawyerId },
      include: {
        legalCase: { select: { caseNumber: true, requiredExpertise: true } },
      },
      orderBy: { ratedAt: 'desc' },
    });
  }

  // ============================================================
  // Story 12-10: Earnings Dashboard & Analytics
  // ============================================================

  async getEarningsDashboard(lawyerId: string, month?: number, year?: number) {
    const now = new Date();
    const targetMonth = month ?? now.getMonth() + 1;
    const targetYear = year ?? now.getFullYear();
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    const monthlyPayouts = await this.prisma.lawyerPayout.findMany({
      where: {
        lawyerId,
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const completed = monthlyPayouts.filter((p) => p.payoutStatus === 'COMPLETED');
    const pending = monthlyPayouts.filter((p) =>
      ['PENDING', 'CONFIRMED', 'PROCESSING'].includes(p.payoutStatus),
    );

    const inProgressCases = await this.prisma.legalCase.findMany({
      where: { lawyerId, caseStatus: 'IN_PROGRESS' },
    });

    const completedTotal = completed.reduce((sum, p) => sum + p.netPayoutInPaise, 0);
    const pendingTotal = pending.reduce((sum, p) => sum + p.netPayoutInPaise, 0);
    const estimatedTotal = inProgressCases.reduce((sum, c) => {
      const net = c.caseFeeInPaise - Math.round(c.caseFeeInPaise * c.platformCommission / 100);
      return sum + net;
    }, 0);

    return {
      month: targetMonth,
      year: targetYear,
      summary: {
        completedPaidInPaise: completedTotal,
        pendingPayoutInPaise: pendingTotal,
        estimatedInProgressInPaise: estimatedTotal,
        totalCasesCompleted: completed.length,
      },
    };
  }

  async getPerformanceMetrics(lawyerId: string) {
    const totalCompleted = await this.prisma.legalCase.count({
      where: { lawyerId, caseStatus: 'COMPLETED' },
    });

    const completedCases = await this.prisma.legalCase.findMany({
      where: { lawyerId, caseStatus: 'COMPLETED', completedAt: { not: null } },
      select: { assignedAt: true, completedAt: true },
    });

    const avgDurationDays = completedCases.length > 0
      ? completedCases.reduce((sum, c) => {
          const days = (c.completedAt!.getTime() - c.assignedAt.getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / completedCases.length
      : 0;

    const opinionTypes = await this.prisma.legalOpinion.groupBy({
      by: ['opinionType'],
      where: { lawyerId },
      _count: { opinionType: true },
    });

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    const ratings = await this.prisma.legalOpinionRating.findMany({
      where: { lawyerId, ratedAt: { gte: sixMonthsAgo } },
      select: { rating: true, ratedAt: true },
      orderBy: { ratedAt: 'asc' },
    });

    const ratingTrend = ratings.reduce((acc, r) => {
      const key = `${r.ratedAt.getFullYear()}-${String(r.ratedAt.getMonth() + 1).padStart(2, '0')}`;
      if (!acc[key]) acc[key] = { total: 0, count: 0 };
      acc[key].total += r.rating;
      acc[key].count += 1;
      return acc;
    }, {} as Record<string, { total: number; count: number }>);

    return {
      totalCasesCompleted: totalCompleted,
      avgCaseDurationDays: Math.round(avgDurationDays * 10) / 10,
      opinionTypeDistribution: opinionTypes.reduce((acc, o) => ({ ...acc, [o.opinionType]: o._count.opinionType }), {} as Record<string, number>),
      ratingTrend: Object.entries(ratingTrend).map(([month, data]) => ({
        month,
        avgRating: Math.round((data.total / data.count) * 10) / 10,
        count: data.count,
      })),
    };
  }

  async getCaseHistory(
    lawyerId: string,
    filters?: { status?: string; fromDate?: Date; toDate?: Date; expertise?: string },
  ) {
    return this.prisma.legalCase.findMany({
      where: {
        lawyerId,
        ...(filters?.status && { caseStatus: filters.status as any }),
        ...(filters?.fromDate && { createdAt: { gte: filters.fromDate } }),
        ...(filters?.toDate && { createdAt: { lte: filters.toDate } }),
        ...(filters?.expertise && { requiredExpertise: filters.expertise as any }),
      },
      include: {
        opinion: { select: { opinionType: true, submittedAt: true } },
        payouts: { select: { netPayoutInPaise: true, payoutStatus: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getNextPayoutInfo(lawyerId: string) {
    const pendingAmount = await this.prisma.lawyerPayout.aggregate({
      where: { lawyerId, payoutStatus: { in: ['PENDING', 'CONFIRMED'] } },
      _sum: { netPayoutInPaise: true },
    });

    const now = new Date();
    const nextPayoutDate = now.getDate() <= 15
      ? new Date(now.getFullYear(), now.getMonth(), 15)
      : new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return {
      pendingAmountInPaise: pendingAmount._sum.netPayoutInPaise || 0,
      nextPayoutDate,
    };
  }

  // ============================================================
  // Story 12-11: Ops Marketplace Management
  // ============================================================

  async getMarketplaceDashboard(cityId: string) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [assigned, inProgress, pendingReview, completedThisMonth] = await Promise.all([
      this.prisma.legalCase.count({ where: { cityId, caseStatus: 'ASSIGNED' } }),
      this.prisma.legalCase.count({ where: { cityId, caseStatus: 'IN_PROGRESS' } }),
      this.prisma.legalCase.count({ where: { cityId, caseStatus: 'OPINION_SUBMITTED' } }),
      this.prisma.legalCase.count({
        where: { cityId, caseStatus: 'COMPLETED', completedAt: { gte: monthStart } },
      }),
    ]);

    return { assigned, inProgress, pendingReview, completedThisMonth };
  }

  async getLawyerLeaderboard(cityId: string) {
    const lawyers = await this.prisma.lawyer.findMany({
      where: { cityId, lawyerStatus: 'VERIFIED' },
      include: {
        expertise: true,
        _count: {
          select: { legalCases: { where: { caseStatus: 'COMPLETED' } } },
        },
      },
      orderBy: [{ totalCasesCompleted: 'desc' }],
    });

    return lawyers.map((l) => ({
      id: l.id,
      userId: l.userId,
      barCouncilNumber: l.barCouncilNumber,
      stateBarCouncil: l.stateBarCouncil,
      totalCasesCompleted: l.totalCasesCompleted,
      avgRating: l.avgRating,
      commissionRate: l.commissionRate,
      lawyerTier: l.lawyerTier,
      declineCount: l.declineCount,
      expertiseTags: l.expertise.map((e) => e.expertiseTag),
      activeCases: l._count.legalCases,
    }));
  }

  async getLawyerDetailForOps(lawyerId: string) {
    const lawyer = await this.prisma.lawyer.findUniqueOrThrow({
      where: { id: lawyerId },
      include: {
        expertise: true,
        legalCases: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: { opinion: { select: { opinionType: true } } },
        },
      },
    });

    const totalAssigned = await this.prisma.legalCase.count({
      where: { lawyerId },
    });
    const declined = await this.prisma.legalCase.count({
      where: { lawyerId, caseStatus: 'REASSIGNED' },
    });
    const acceptanceRate = totalAssigned > 0 ? ((totalAssigned - declined) / totalAssigned) * 100 : 100;

    const declineReasons = await this.prisma.legalCase.groupBy({
      by: ['declineReason'],
      where: { lawyerId, caseStatus: 'REASSIGNED', declineReason: { not: null } },
      _count: true,
    });

    const ratingSummary = await this.getLawyerRatingSummary(lawyerId);

    return {
      ...lawyer,
      acceptanceRate: Math.round(acceptanceRate),
      declineReasons,
      ratingSummary,
    };
  }

  async reassignCase(caseId: string, newLawyerId: string, reassignedBy: string) {
    const legalCase = await this.prisma.legalCase.findUniqueOrThrow({
      where: { id: caseId },
    });

    if (!['ASSIGNED', 'IN_PROGRESS'].includes(legalCase.caseStatus)) {
      throw new BusinessError('CANNOT_REASSIGN', 'Case cannot be reassigned in current status');
    }

    return this.prisma.legalCase.update({
      where: { id: caseId },
      data: {
        lawyerId: newLawyerId,
        caseStatus: 'ASSIGNED',
        assignedAt: new Date(),
        assignedBy: reassignedBy,
        acceptedAt: null,
        declinedAt: null,
        declineReason: null,
      },
    });
  }

  async updateCommissionRate(lawyerId: string, commissionRate: number) {
    if (commissionRate < 10 || commissionRate > 30) {
      throw new BusinessError('INVALID_RATE', 'Commission rate must be between 10% and 30%');
    }

    return this.prisma.lawyer.update({
      where: { id: lawyerId },
      data: {
        commissionRate,
        lawyerTier: commissionRate <= 15 ? 'PREFERRED' : 'STANDARD',
      },
    });
  }

  async deactivateLawyer(lawyerId: string, reason: string) {
    const activeCases = await this.prisma.legalCase.count({
      where: { lawyerId, caseStatus: { in: ['ASSIGNED', 'IN_PROGRESS'] } },
    });

    if (activeCases > 0) {
      throw new BusinessError(
        'HAS_ACTIVE_CASES',
        `Lawyer has ${activeCases} active cases. Reassign before deactivation.`,
      );
    }

    return this.prisma.lawyer.update({
      where: { id: lawyerId },
      data: { lawyerStatus: 'SUSPENDED', rejectionReason: reason },
    });
  }

  // ============================================================
  // Story 12-12: DND Toggle & Deadline Reminders
  // ============================================================

  async toggleDnd(lawyerId: string, enabled: boolean) {
    return this.prisma.lawyer.update({
      where: { id: lawyerId },
      data: { dndEnabled: enabled },
    });
  }
}
