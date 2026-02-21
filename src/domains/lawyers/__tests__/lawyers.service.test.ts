// ============================================================
// Epic 12: Legal Opinion Marketplace — Service Layer Tests
// Stories 12-1 through 12-12
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LawyerService } from '../lawyers.service';
import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Mock Prisma factory
// ---------------------------------------------------------------------------
function createMockPrisma() {
  return {
    lawyer: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      upsert: vi.fn(),
    },
    lawyerExpertise: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      upsert: vi.fn(),
    },
    lawyerExpertiseRequest: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    legalCase: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    legalOpinion: {
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      groupBy: vi.fn(),
    },
    legalOpinionRating: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
    },
    lawyerPayout: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      aggregate: vi.fn(),
    },
    lawyerBankAccount: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    legalCaseDocAccess: {
      create: vi.fn(),
    },
    legalCaseDocRequest: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  } as unknown as PrismaClient;
}

describe('LawyerService', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let service: LawyerService;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new LawyerService(mockPrisma);
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Story 12-1: Registration & Verification
  // ===========================================================================

  describe('register', () => {
    const validInput = {
      barCouncilNumber: 'UP/1234/2015',
      stateBarCouncil: 'Uttar Pradesh',
      admissionYear: 2015,
      practicingCertUrl: 'https://docs.example.com/cert.pdf',
    };

    it('creates a new lawyer with PENDING_VERIFICATION status', async () => {
      (mockPrisma.lawyer.findUnique as any).mockResolvedValue(null);
      (mockPrisma.lawyer.upsert as any).mockResolvedValue({
        id: 'lawyer-1',
        userId: 'user-1',
        lawyerStatus: 'PENDING_VERIFICATION',
      });

      const result = await service.register('user-1', 'city-1', validInput);

      expect(result.lawyerStatus).toBe('PENDING_VERIFICATION');
      expect(mockPrisma.lawyer.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({ userId: 'user-1', cityId: 'city-1' }),
          update: expect.objectContaining({ lawyerStatus: 'PENDING_VERIFICATION' }),
        }),
      );
    });

    it('allows re-submission if previously rejected', async () => {
      (mockPrisma.lawyer.findUnique as any).mockResolvedValue({
        id: 'lawyer-1',
        lawyerStatus: 'REJECTED',
      });
      (mockPrisma.lawyer.upsert as any).mockResolvedValue({
        id: 'lawyer-1',
        lawyerStatus: 'PENDING_VERIFICATION',
        rejectionReason: null,
      });

      const result = await service.register('user-1', 'city-1', validInput);

      expect(result.lawyerStatus).toBe('PENDING_VERIFICATION');
      // rejectionReason cleared on re-submit
      expect(mockPrisma.lawyer.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({ rejectionReason: null }),
        }),
      );
    });

    it('throws LAWYER_ALREADY_VERIFIED if lawyer is already verified', async () => {
      (mockPrisma.lawyer.findUnique as any).mockResolvedValue({
        id: 'lawyer-1',
        lawyerStatus: 'VERIFIED',
      });

      await expect(service.register('user-1', 'city-1', validInput)).rejects.toThrow(
        'Lawyer is already verified',
      );
    });
  });

  describe('verify', () => {
    it('approves a lawyer and sets VERIFIED status', async () => {
      (mockPrisma.lawyer.findUniqueOrThrow as any).mockResolvedValue({
        id: 'lawyer-1',
        lawyerStatus: 'PENDING_VERIFICATION',
      });
      (mockPrisma.lawyer.update as any).mockResolvedValue({
        id: 'lawyer-1',
        lawyerStatus: 'VERIFIED',
        verifiedAt: new Date(),
      });

      const result = await service.verify(
        { lawyerId: 'lawyer-1', action: 'approve' },
        'ops-user-1',
      );

      expect(result.lawyerStatus).toBe('VERIFIED');
      expect(mockPrisma.lawyer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lawyerStatus: 'VERIFIED',
            verifiedBy: 'ops-user-1',
          }),
        }),
      );
    });

    it('rejects a lawyer with reason', async () => {
      (mockPrisma.lawyer.findUniqueOrThrow as any).mockResolvedValue({
        id: 'lawyer-1',
        lawyerStatus: 'PENDING_VERIFICATION',
      });
      (mockPrisma.lawyer.update as any).mockResolvedValue({
        id: 'lawyer-1',
        lawyerStatus: 'REJECTED',
        rejectionReason: 'Invalid bar council number',
      });

      const result = await service.verify(
        { lawyerId: 'lawyer-1', action: 'reject', rejectionReason: 'Invalid bar council number' },
        'ops-user-1',
      );

      expect(result.lawyerStatus).toBe('REJECTED');
      expect(mockPrisma.lawyer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lawyerStatus: 'REJECTED',
            rejectionReason: 'Invalid bar council number',
          }),
        }),
      );
    });

    it('throws LAWYER_ALREADY_VERIFIED when lawyer is already verified', async () => {
      (mockPrisma.lawyer.findUniqueOrThrow as any).mockResolvedValue({
        id: 'lawyer-1',
        lawyerStatus: 'VERIFIED',
      });

      await expect(
        service.verify({ lawyerId: 'lawyer-1', action: 'approve' }, 'ops-1'),
      ).rejects.toThrow('Lawyer is already verified');
    });
  });

  // ===========================================================================
  // Story 12-2: Expertise Tagging
  // ===========================================================================

  describe('assignExpertise', () => {
    it('assigns expertise tags to a verified lawyer', async () => {
      (mockPrisma.lawyer.findUniqueOrThrow as any).mockResolvedValue({
        id: 'lawyer-1',
        lawyerStatus: 'VERIFIED',
      });
      const expertiseTags = [
        { lawyerId: 'lawyer-1', expertiseTag: 'TITLE_OPINIONS' },
        { lawyerId: 'lawyer-1', expertiseTag: 'LDA_DISPUTES' },
      ];
      // Mock the $transaction to run the callback
      (mockPrisma.$transaction as any).mockImplementation(async (cb: any) => {
        const tx = {
          lawyerExpertise: {
            deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
            createMany: vi.fn().mockResolvedValue({ count: 2 }),
            findMany: vi.fn().mockResolvedValue(expertiseTags),
          },
        };
        return cb(tx);
      });

      const result = await service.assignExpertise(
        'lawyer-1',
        ['TITLE_OPINIONS', 'LDA_DISPUTES'],
        'ops-1',
      );

      expect(result).toHaveLength(2);
    });

    it('throws LAWYER_NOT_VERIFIED when assigning to unverified lawyer', async () => {
      (mockPrisma.lawyer.findUniqueOrThrow as any).mockResolvedValue({
        id: 'lawyer-1',
        lawyerStatus: 'PENDING_VERIFICATION',
      });

      await expect(
        service.assignExpertise('lawyer-1', ['TITLE_OPINIONS'], 'ops-1'),
      ).rejects.toThrow('Cannot assign expertise to unverified lawyer');
    });
  });

  // ===========================================================================
  // Story 12-3: Case Routing
  // ===========================================================================

  describe('getSuggestedLawyers', () => {
    it('returns lawyers matching expertise tag scoped to city', async () => {
      const lawyers = [
        {
          id: 'l-1',
          userId: 'u-1',
          cityId: 'city-1',
          lawyerStatus: 'VERIFIED',
          dndEnabled: false,
          barCouncilNumber: 'UP/001/2015',
          stateBarCouncil: 'UP',
          avgRating: 4.5,
          totalCasesCompleted: 10,
          commissionRate: 20,
          lawyerTier: 'STANDARD',
          expertise: [{ expertiseTag: 'TITLE_OPINIONS' }],
          _count: { legalCases: 2 },
        },
      ];
      (mockPrisma.lawyer.findMany as any).mockResolvedValue(lawyers);

      const result = await service.getSuggestedLawyers('TITLE_OPINIONS', 'city-1');

      expect(result).toHaveLength(1);
      expect(result[0].expertiseTags).toContain('TITLE_OPINIONS');
      expect(result[0].activeCaseCount).toBe(2);
    });

    it('excludes DND-enabled lawyers via Prisma where clause', async () => {
      (mockPrisma.lawyer.findMany as any).mockResolvedValue([]);

      await service.getSuggestedLawyers('TITLE_OPINIONS', 'city-1');

      expect(mockPrisma.lawyer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            dndEnabled: false,
            cityId: 'city-1',
          }),
        }),
      );
    });
  });

  describe('createLegalCase', () => {
    it('creates a case with unique case number', async () => {
      (mockPrisma.lawyer.findUniqueOrThrow as any).mockResolvedValue({
        id: 'lawyer-1',
        commissionRate: 20,
      });
      (mockPrisma.legalCase.create as any).mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'case-1', ...data }),
      );

      const result = await service.createLegalCase(
        {
          serviceRequestId: 'sr-001',
          requiredExpertise: 'TITLE_OPINIONS',
          lawyerId: 'lawyer-1',
          issueSummary: 'Title dispute on property',
          caseFeeInPaise: 500000,
          casePriority: 'NORMAL',
        },
        'ops-1',
        'city-1',
      );

      expect(result.caseNumber).toMatch(/^LC-\d+-[A-Z0-9]{4}$/);
      expect(result.platformCommission).toBe(20);
    });

    it('sets deadline to 3 days for URGENT priority', async () => {
      (mockPrisma.lawyer.findUniqueOrThrow as any).mockResolvedValue({
        id: 'lawyer-1',
        commissionRate: 20,
      });

      const beforeCreate = new Date();
      (mockPrisma.legalCase.create as any).mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'case-1', ...data }),
      );

      const result = await service.createLegalCase(
        {
          serviceRequestId: 'sr-002',
          requiredExpertise: 'TITLE_OPINIONS',
          lawyerId: 'lawyer-1',
          issueSummary: 'Urgent title dispute',
          caseFeeInPaise: 500000,
          casePriority: 'URGENT',
        },
        'ops-1',
        'city-1',
      );

      const deadline = new Date(result.deadlineAt);
      const expectedDeadline = new Date(beforeCreate);
      expectedDeadline.setDate(expectedDeadline.getDate() + 3);

      // Allow 5 second tolerance
      expect(deadline.getTime()).toBeGreaterThan(beforeCreate.getTime());
      expect(deadline.getDate()).toBe(expectedDeadline.getDate());
    });

    it('sets deadline to 5 days for NORMAL priority', async () => {
      (mockPrisma.lawyer.findUniqueOrThrow as any).mockResolvedValue({
        id: 'lawyer-1',
        commissionRate: 20,
      });

      const beforeCreate = new Date();
      (mockPrisma.legalCase.create as any).mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'case-1', ...data }),
      );

      const result = await service.createLegalCase(
        {
          serviceRequestId: 'sr-003',
          requiredExpertise: 'TITLE_OPINIONS',
          lawyerId: 'lawyer-1',
          issueSummary: 'Normal title dispute',
          caseFeeInPaise: 500000,
          casePriority: 'NORMAL',
        },
        'ops-1',
        'city-1',
      );

      const deadline = new Date(result.deadlineAt);
      const expectedDeadline = new Date(beforeCreate);
      expectedDeadline.setDate(expectedDeadline.getDate() + 5);
      expect(deadline.getDate()).toBe(expectedDeadline.getDate());
    });
  });

  // ===========================================================================
  // Story 12-4: Case Accept / Decline
  // ===========================================================================

  describe('acceptCase', () => {
    it('changes status to IN_PROGRESS and sets acceptedAt', async () => {
      (mockPrisma.legalCase.findUniqueOrThrow as any).mockResolvedValue({
        id: 'case-1',
        lawyerId: 'lawyer-1',
        caseStatus: 'ASSIGNED',
      });
      (mockPrisma.legalCase.update as any).mockResolvedValue({
        id: 'case-1',
        caseStatus: 'IN_PROGRESS',
        acceptedAt: new Date(),
      });

      const result = await service.acceptCase('case-1', 'lawyer-1');

      expect(result.caseStatus).toBe('IN_PROGRESS');
      expect(mockPrisma.legalCase.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ caseStatus: 'IN_PROGRESS' }),
        }),
      );
    });

    it('throws NOT_ASSIGNED when case is not assigned to this lawyer', async () => {
      (mockPrisma.legalCase.findUniqueOrThrow as any).mockResolvedValue({
        id: 'case-1',
        lawyerId: 'other-lawyer',
        caseStatus: 'ASSIGNED',
      });

      await expect(service.acceptCase('case-1', 'lawyer-1')).rejects.toThrow(
        'This case is not assigned to you',
      );
    });

    it('throws INVALID_STATUS when case is not in ASSIGNED status', async () => {
      (mockPrisma.legalCase.findUniqueOrThrow as any).mockResolvedValue({
        id: 'case-1',
        lawyerId: 'lawyer-1',
        caseStatus: 'IN_PROGRESS',
      });

      await expect(service.acceptCase('case-1', 'lawyer-1')).rejects.toThrow(
        'Case is not in assignable status',
      );
    });
  });

  describe('declineCase', () => {
    it('changes status to REASSIGNED and increments decline count', async () => {
      (mockPrisma.legalCase.findUniqueOrThrow as any).mockResolvedValue({
        id: 'case-1',
        lawyerId: 'lawyer-1',
        caseStatus: 'ASSIGNED',
      });

      // Mock transaction
      (mockPrisma.$transaction as any).mockImplementation(async (cb: any) => {
        const tx = {
          legalCase: {
            update: vi.fn().mockResolvedValue({ id: 'case-1', caseStatus: 'REASSIGNED' }),
            count: vi.fn().mockResolvedValue(5),
          },
          lawyer: {
            update: vi.fn().mockResolvedValue({ id: 'lawyer-1', declineCount: 2 }),
          },
        };
        return cb(tx);
      });

      const result = await service.declineCase('case-1', 'lawyer-1', 'Workload full');

      expect(result.legalCase.caseStatus).toBe('REASSIGNED');
    });

    it('throws NOT_ASSIGNED when case is not assigned to this lawyer', async () => {
      (mockPrisma.legalCase.findUniqueOrThrow as any).mockResolvedValue({
        id: 'case-1',
        lawyerId: 'other-lawyer',
        caseStatus: 'ASSIGNED',
      });

      await expect(service.declineCase('case-1', 'lawyer-1', 'Other')).rejects.toThrow(
        'This case is not assigned to you',
      );
    });

    it('flags high decline rate when decline rate exceeds 30%', async () => {
      (mockPrisma.legalCase.findUniqueOrThrow as any).mockResolvedValue({
        id: 'case-1',
        lawyerId: 'lawyer-1',
        caseStatus: 'ASSIGNED',
      });

      (mockPrisma.$transaction as any).mockImplementation(async (cb: any) => {
        const tx = {
          legalCase: {
            update: vi.fn().mockResolvedValue({ id: 'case-1', caseStatus: 'REASSIGNED' }),
            count: vi.fn().mockResolvedValue(10), // 10 total
          },
          lawyer: {
            update: vi.fn().mockResolvedValue({ id: 'lawyer-1', declineCount: 4 }), // 4 declines = 40%
          },
        };
        return cb(tx);
      });

      const result = await service.declineCase('case-1', 'lawyer-1', 'Workload full');

      expect(result.flagged).toBe(true);
      expect(result.declineRate).toBeGreaterThan(0.3);
    });
  });

  describe('getCaseDetails', () => {
    it('returns fee breakdown with commission calculation', async () => {
      (mockPrisma.legalCase.findUniqueOrThrow as any).mockResolvedValue({
        id: 'case-1',
        lawyerId: 'lawyer-1',
        caseFeeInPaise: 500000, // Rs. 5000
        platformCommission: 20, // 20%
        caseStatus: 'IN_PROGRESS',
        lawyer: { id: 'lawyer-1' },
      });

      const result = await service.getCaseDetails('case-1', 'lawyer-1');

      // 20% of 500000 = 100000 commission
      expect(result.feeBreakdown.commissionAmountInPaise).toBe(100000);
      // net = 500000 - 100000 = 400000
      expect(result.feeBreakdown.netPayoutInPaise).toBe(400000);
      expect(result.feeBreakdown.commissionPercentage).toBe(20);
    });
  });

  // ===========================================================================
  // Story 12-5: Document Access
  // ===========================================================================

  describe('getCaseDocuments', () => {
    it('returns documents for assigned lawyer with in-progress case', async () => {
      (mockPrisma.legalCase.findUniqueOrThrow as any).mockResolvedValue({
        id: 'case-1',
        lawyerId: 'lawyer-1',
        caseStatus: 'IN_PROGRESS',
        serviceRequestId: 'sr-001',
      });

      const result = await service.getCaseDocuments('case-1', 'lawyer-1');

      expect(result.caseId).toBe('case-1');
      expect(result.serviceRequestId).toBe('sr-001');
    });

    it('throws NOT_ASSIGNED when lawyer is not assigned', async () => {
      (mockPrisma.legalCase.findUniqueOrThrow as any).mockResolvedValue({
        id: 'case-1',
        lawyerId: 'other-lawyer',
        caseStatus: 'IN_PROGRESS',
      });

      await expect(service.getCaseDocuments('case-1', 'lawyer-1')).rejects.toThrow(
        'You are not assigned to this case',
      );
    });

    it('throws CASE_NOT_ACCEPTED when case is still ASSIGNED (not accepted)', async () => {
      (mockPrisma.legalCase.findUniqueOrThrow as any).mockResolvedValue({
        id: 'case-1',
        lawyerId: 'lawyer-1',
        caseStatus: 'ASSIGNED',
      });

      await expect(service.getCaseDocuments('case-1', 'lawyer-1')).rejects.toThrow(
        'Case must be accepted to access documents',
      );
    });
  });

  // ===========================================================================
  // Story 12-6: Legal Opinion Upload
  // ===========================================================================

  describe('submitOpinion', () => {
    it('creates opinion and changes case status to OPINION_SUBMITTED', async () => {
      (mockPrisma.legalCase.findUniqueOrThrow as any).mockResolvedValue({
        id: 'case-1',
        lawyerId: 'lawyer-1',
        caseStatus: 'IN_PROGRESS',
      });
      (mockPrisma.legalOpinion.findUnique as any).mockResolvedValue(null);

      const opinion = {
        id: 'opinion-1',
        legalCaseId: 'case-1',
        opinionType: 'FAVORABLE',
        opinionDocUrl: 'https://docs.example.com/opinion.pdf',
      };

      (mockPrisma.$transaction as any).mockImplementation(async (cb: any) => {
        const tx = {
          legalOpinion: {
            create: vi.fn().mockResolvedValue(opinion),
          },
          legalCase: {
            update: vi.fn().mockResolvedValue({ id: 'case-1', caseStatus: 'OPINION_SUBMITTED' }),
          },
        };
        return cb(tx);
      });

      const result = await service.submitOpinion(
        'case-1',
        'lawyer-1',
        'https://docs.example.com/opinion.pdf',
        'FAVORABLE',
      );

      expect(result.opinionType).toBe('FAVORABLE');
    });

    it('throws INVALID_STATUS when case is not IN_PROGRESS', async () => {
      (mockPrisma.legalCase.findUniqueOrThrow as any).mockResolvedValue({
        id: 'case-1',
        lawyerId: 'lawyer-1',
        caseStatus: 'ASSIGNED',
      });

      await expect(
        service.submitOpinion('case-1', 'lawyer-1', 'https://docs.com/op.pdf', 'FAVORABLE'),
      ).rejects.toThrow('Case must be in progress to submit opinion');
    });

    it('prevents duplicate opinion submission', async () => {
      (mockPrisma.legalCase.findUniqueOrThrow as any).mockResolvedValue({
        id: 'case-1',
        lawyerId: 'lawyer-1',
        caseStatus: 'IN_PROGRESS',
      });
      (mockPrisma.legalOpinion.findUnique as any).mockResolvedValue({
        id: 'existing-opinion',
      });

      await expect(
        service.submitOpinion('case-1', 'lawyer-1', 'https://docs.com/op.pdf', 'FAVORABLE'),
      ).rejects.toThrow('Opinion already submitted for this case');
    });
  });

  describe('reviewOpinion', () => {
    it('approves and changes case to OPINION_APPROVED', async () => {
      (mockPrisma.legalOpinion.findUniqueOrThrow as any).mockResolvedValue({
        id: 'opinion-1',
        legalCaseId: 'case-1',
        approvalStatus: 'PENDING_REVIEW',
      });

      (mockPrisma.$transaction as any).mockImplementation(async (cb: any) => {
        const tx = {
          legalOpinion: {
            update: vi.fn().mockResolvedValue({ id: 'opinion-1', approvalStatus: 'APPROVED' }),
          },
          legalCase: {
            update: vi.fn().mockResolvedValue({ id: 'case-1', caseStatus: 'OPINION_APPROVED' }),
          },
        };
        return cb(tx);
      });

      const result = await service.reviewOpinion('opinion-1', 'approve', 'ops-1');

      expect(result.approvalStatus).toBe('APPROVED');
    });

    it('rejects, deletes opinion, and returns case to IN_PROGRESS', async () => {
      (mockPrisma.legalOpinion.findUniqueOrThrow as any).mockResolvedValue({
        id: 'opinion-1',
        legalCaseId: 'case-1',
        approvalStatus: 'PENDING_REVIEW',
      });

      (mockPrisma.$transaction as any).mockImplementation(async (cb: any) => {
        const tx = {
          legalOpinion: {
            delete: vi.fn().mockResolvedValue(undefined),
          },
          legalCase: {
            update: vi.fn().mockResolvedValue({ id: 'case-1', caseStatus: 'IN_PROGRESS' }),
          },
        };
        return cb(tx);
      });

      const result = await service.reviewOpinion('opinion-1', 'reject', 'ops-1', 'Not acceptable');

      expect(result).toMatchObject({ status: 'REJECTED', reviewNotes: 'Not acceptable' });
    });
  });

  // ===========================================================================
  // Story 12-7: Customer Receives Opinion
  // ===========================================================================

  describe('deliverOpinion', () => {
    it('sets deliveredAt and changes case to OPINION_DELIVERED', async () => {
      (mockPrisma.legalOpinion.findUniqueOrThrow as any).mockResolvedValue({
        id: 'opinion-1',
        legalCaseId: 'case-1',
        approvalStatus: 'APPROVED',
      });

      (mockPrisma.$transaction as any).mockImplementation(async (cb: any) => {
        const tx = {
          legalOpinion: {
            update: vi.fn().mockResolvedValue({ id: 'opinion-1', deliveredAt: new Date() }),
          },
          legalCase: {
            update: vi.fn().mockResolvedValue({ id: 'case-1', caseStatus: 'OPINION_DELIVERED' }),
          },
        };
        return cb(tx);
      });

      await service.deliverOpinion('opinion-1');

      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('throws NOT_APPROVED when opinion is not yet approved', async () => {
      (mockPrisma.legalOpinion.findUniqueOrThrow as any).mockResolvedValue({
        id: 'opinion-1',
        legalCaseId: 'case-1',
        approvalStatus: 'PENDING_REVIEW',
      });

      await expect(service.deliverOpinion('opinion-1')).rejects.toThrow(
        'Opinion must be approved before delivery',
      );
    });
  });

  // ===========================================================================
  // Story 12-8: Case Completion & Payout
  // ===========================================================================

  describe('completeCase', () => {
    it('creates payout with correct 20% commission calculation', async () => {
      (mockPrisma.legalCase.findUniqueOrThrow as any).mockResolvedValue({
        id: 'case-1',
        lawyerId: 'lawyer-1',
        caseStatus: 'OPINION_DELIVERED',
        caseFeeInPaise: 500000, // Rs. 5000
        platformCommission: 20,
        lawyer: { id: 'lawyer-1' },
        opinion: { id: 'opinion-1' },
      });

      const payout = {
        id: 'payout-1',
        grossFeeInPaise: 500000,
        commissionRate: 20,
        commissionInPaise: 100000,
        netPayoutInPaise: 400000,
      };

      (mockPrisma.$transaction as any).mockImplementation(async (cb: any) => {
        const tx = {
          legalCase: {
            update: vi.fn().mockResolvedValue({ id: 'case-1', caseStatus: 'COMPLETED' }),
          },
          lawyer: {
            update: vi.fn().mockResolvedValue({ id: 'lawyer-1', totalCasesCompleted: 5 }),
          },
          lawyerPayout: {
            create: vi.fn().mockResolvedValue(payout),
          },
        };
        return cb(tx);
      });

      const result = await service.completeCase('case-1');

      expect(result.netPayoutInPaise).toBe(400000); // 500000 - 20% = 400000
      expect(result.commissionInPaise).toBe(100000);
    });

    it('throws INVALID_STATUS when case does not have delivered opinion', async () => {
      (mockPrisma.legalCase.findUniqueOrThrow as any).mockResolvedValue({
        id: 'case-1',
        lawyerId: 'lawyer-1',
        caseStatus: 'IN_PROGRESS',
        caseFeeInPaise: 500000,
        platformCommission: 20,
        lawyer: { id: 'lawyer-1' },
        opinion: null,
      });

      await expect(service.completeCase('case-1')).rejects.toThrow(
        'Case must have delivered opinion',
      );
    });
  });

  describe('autoConfirmPayouts', () => {
    it('confirms payouts older than 7 days', async () => {
      (mockPrisma.lawyerPayout.updateMany as any).mockResolvedValue({ count: 3 });

      const result = await service.autoConfirmPayouts();

      expect(mockPrisma.lawyerPayout.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ payoutStatus: 'PENDING' }),
          data: expect.objectContaining({
            payoutStatus: 'CONFIRMED',
          }),
        }),
      );
    });
  });

  // ===========================================================================
  // Story 12-9: Rating
  // ===========================================================================

  describe('rateOpinion', () => {
    it('creates rating and updates lawyer avg rating', async () => {
      (mockPrisma.legalCase.findUniqueOrThrow as any).mockResolvedValue({
        id: 'case-1',
        lawyerId: 'lawyer-1',
        caseStatus: 'OPINION_DELIVERED',
      });
      (mockPrisma.legalOpinionRating.findUnique as any).mockResolvedValue(null);
      (mockPrisma.legalOpinionRating.create as any).mockResolvedValue({
        id: 'rating-1',
        rating: 4,
      });
      (mockPrisma.legalOpinionRating.aggregate as any).mockResolvedValue({
        _avg: { rating: 4.2 },
        _count: { rating: 5 },
      });
      (mockPrisma.lawyer.update as any).mockResolvedValue({ id: 'lawyer-1', avgRating: 4.2 });

      const result = await service.rateOpinion('case-1', 'customer-1', 4);

      expect(result.ratingRecord.rating).toBe(4);
      expect(mockPrisma.lawyer.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ avgRating: 4.2 }),
        }),
      );
    });

    it('prevents duplicate ratings (immutable)', async () => {
      (mockPrisma.legalCase.findUniqueOrThrow as any).mockResolvedValue({
        id: 'case-1',
        lawyerId: 'lawyer-1',
        caseStatus: 'COMPLETED',
      });
      (mockPrisma.legalOpinionRating.findUnique as any).mockResolvedValue({
        id: 'existing-rating',
        rating: 3,
      });

      await expect(service.rateOpinion('case-1', 'customer-1', 5)).rejects.toThrow(
        'You have already rated this opinion',
      );
    });

    it('flags lawyer when avg rating is below 3.5 with 10+ cases', async () => {
      (mockPrisma.legalCase.findUniqueOrThrow as any).mockResolvedValue({
        id: 'case-1',
        lawyerId: 'lawyer-1',
        caseStatus: 'COMPLETED',
      });
      (mockPrisma.legalOpinionRating.findUnique as any).mockResolvedValue(null);
      (mockPrisma.legalOpinionRating.create as any).mockResolvedValue({ id: 'r-1', rating: 2 });
      (mockPrisma.legalOpinionRating.aggregate as any).mockResolvedValue({
        _avg: { rating: 3.2 }, // below 3.5
        _count: { rating: 12 }, // >= 10
      });
      (mockPrisma.lawyer.update as any).mockResolvedValue({ id: 'lawyer-1', avgRating: 3.2 });

      const result = await service.rateOpinion('case-1', 'customer-1', 2);

      expect(result.flagged).toBe(true);
    });
  });

  // ===========================================================================
  // Story 12-11: Ops Management
  // ===========================================================================

  describe('reassignCase', () => {
    it('reassigns case to a new lawyer', async () => {
      (mockPrisma.legalCase.findUniqueOrThrow as any).mockResolvedValue({
        id: 'case-1',
        lawyerId: 'lawyer-old',
        caseStatus: 'ASSIGNED',
      });
      (mockPrisma.legalCase.update as any).mockResolvedValue({
        id: 'case-1',
        lawyerId: 'lawyer-new',
        caseStatus: 'ASSIGNED',
      });

      const result = await service.reassignCase('case-1', 'lawyer-new', 'ops-1');

      expect(result.lawyerId).toBe('lawyer-new');
    });

    it('throws CANNOT_REASSIGN when case is in completed status', async () => {
      (mockPrisma.legalCase.findUniqueOrThrow as any).mockResolvedValue({
        id: 'case-1',
        lawyerId: 'lawyer-1',
        caseStatus: 'COMPLETED',
      });

      await expect(service.reassignCase('case-1', 'lawyer-new', 'ops-1')).rejects.toThrow(
        'Case cannot be reassigned in current status',
      );
    });
  });

  describe('updateCommissionRate', () => {
    it('sets PREFERRED tier when commission rate <= 15%', async () => {
      (mockPrisma.lawyer.update as any).mockResolvedValue({
        id: 'lawyer-1',
        commissionRate: 15,
        lawyerTier: 'PREFERRED',
      });

      const result = await service.updateCommissionRate('lawyer-1', 15);

      expect(result.lawyerTier).toBe('PREFERRED');
    });

    it('sets STANDARD tier when commission rate > 15%', async () => {
      (mockPrisma.lawyer.update as any).mockResolvedValue({
        id: 'lawyer-1',
        commissionRate: 20,
        lawyerTier: 'STANDARD',
      });

      const result = await service.updateCommissionRate('lawyer-1', 20);

      expect(result.lawyerTier).toBe('STANDARD');
    });

    it('rejects commission rate below 10%', async () => {
      await expect(service.updateCommissionRate('lawyer-1', 9)).rejects.toThrow(
        'Commission rate must be between 10% and 30%',
      );
    });

    it('rejects commission rate above 30%', async () => {
      await expect(service.updateCommissionRate('lawyer-1', 31)).rejects.toThrow(
        'Commission rate must be between 10% and 30%',
      );
    });
  });

  describe('deactivateLawyer', () => {
    it('suspends lawyer with reason when no active cases', async () => {
      (mockPrisma.legalCase.count as any).mockResolvedValue(0);
      (mockPrisma.lawyer.update as any).mockResolvedValue({
        id: 'lawyer-1',
        lawyerStatus: 'SUSPENDED',
        rejectionReason: 'Misconduct',
      });

      const result = await service.deactivateLawyer('lawyer-1', 'Misconduct');

      expect(result.lawyerStatus).toBe('SUSPENDED');
    });

    it('throws HAS_ACTIVE_CASES when lawyer has active cases', async () => {
      (mockPrisma.legalCase.count as any).mockResolvedValue(3);

      await expect(service.deactivateLawyer('lawyer-1', 'Testing')).rejects.toThrow(
        'Lawyer has 3 active cases',
      );
    });
  });

  // ===========================================================================
  // Story 12-12: DND Toggle
  // ===========================================================================

  describe('toggleDnd', () => {
    it('enables DND', async () => {
      (mockPrisma.lawyer.update as any).mockResolvedValue({ id: 'lawyer-1', dndEnabled: true });

      const result = await service.toggleDnd('lawyer-1', true);

      expect(result.dndEnabled).toBe(true);
      expect(mockPrisma.lawyer.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { dndEnabled: true } }),
      );
    });

    it('disables DND', async () => {
      (mockPrisma.lawyer.update as any).mockResolvedValue({ id: 'lawyer-1', dndEnabled: false });

      const result = await service.toggleDnd('lawyer-1', false);

      expect(result.dndEnabled).toBe(false);
    });
  });
});
