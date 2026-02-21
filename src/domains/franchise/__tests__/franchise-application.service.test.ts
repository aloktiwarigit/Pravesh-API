/**
 * Tests for FranchiseApplicationService
 * Story 14-5: Franchise Application & Vetting Workflow
 * Lifecycle: pending_review -> info_requested -> interview_scheduled -> approved -> agreement_sent -> onboarded
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FranchiseApplicationService } from '../franchise-application.service';
import { PrismaClient } from '@prisma/client';

// ---------------------------------------------------------------------------
// Mock firebase-admin
// ---------------------------------------------------------------------------
vi.mock('firebase-admin', () => ({
  default: {
    auth: () => ({
      getUser: vi.fn().mockResolvedValue({ customClaims: {} }),
      setCustomUserClaims: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

// ---------------------------------------------------------------------------
// Mock Prisma factory
// ---------------------------------------------------------------------------
function createMockPrisma() {
  return {
    city: {
      findUnique: vi.fn(),
    },
    franchise: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    franchiseApplication: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    user: {
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  } as unknown as PrismaClient;
}

const VALID_CITY_ID = '550e8400-e29b-41d4-a716-446655440000';

const validApplicationParams = {
  applicantName: 'Ravi Kumar',
  applicantEmail: 'ravi@example.com',
  applicantPhone: '+919876543210',
  cityId: VALID_CITY_ID,
  businessExperience: 'I have 10 years of experience in real estate and property management.',
  financialCapacity: 'I have Rs. 50 Lakh in liquid capital.',
  references: [
    { name: 'Amit Shah', phone: '9898989898', relationship: 'colleague' },
  ],
};

describe('FranchiseApplicationService', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let service: FranchiseApplicationService;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    service = new FranchiseApplicationService(mockPrisma);
    vi.clearAllMocks();
  });

  // ===========================================================================
  // submitApplication
  // ===========================================================================

  describe('submitApplication', () => {
    it('creates a franchise application with pending_review status', async () => {
      const city = { id: VALID_CITY_ID, cityName: 'Lucknow' };
      const createdApp = {
        id: 'app-001',
        ...validApplicationParams,
        status: 'pending_review',
      };
      (mockPrisma.city.findUnique as any).mockResolvedValue(city);
      (mockPrisma.franchise.findUnique as any).mockResolvedValue(null);
      (mockPrisma.franchiseApplication.create as any).mockResolvedValue(createdApp);

      const result = await service.submitApplication(validApplicationParams);

      expect(result.status).toBe('pending_review');
      expect(mockPrisma.franchiseApplication.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'pending_review',
            applicantName: 'Ravi Kumar',
          }),
        }),
      );
    });

    it('throws BUSINESS_CITY_NOT_FOUND when city does not exist', async () => {
      (mockPrisma.city.findUnique as any).mockResolvedValue(null);

      await expect(service.submitApplication(validApplicationParams)).rejects.toMatchObject({
        code: 'BUSINESS_CITY_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('throws BUSINESS_FRANCHISE_APPLICATION_INVALID_STATUS when franchise already exists for city', async () => {
      const city = { id: VALID_CITY_ID, cityName: 'Lucknow' };
      const existingFranchise = { id: 'franchise-001', cityId: VALID_CITY_ID };
      (mockPrisma.city.findUnique as any).mockResolvedValue(city);
      (mockPrisma.franchise.findUnique as any).mockResolvedValue(existingFranchise);

      await expect(service.submitApplication(validApplicationParams)).rejects.toMatchObject({
        code: 'BUSINESS_FRANCHISE_APPLICATION_INVALID_STATUS',
        statusCode: 409,
      });
    });
  });

  // ===========================================================================
  // updateStatus — transition validation
  // ===========================================================================

  describe('updateStatus', () => {
    it('transitions from pending_review to info_requested', async () => {
      const application = { id: 'app-001', status: 'pending_review' };
      const updated = { ...application, status: 'info_requested' };
      (mockPrisma.franchiseApplication.findUnique as any).mockResolvedValue(application);
      (mockPrisma.franchiseApplication.update as any).mockResolvedValue(updated);

      const result = await service.updateStatus('app-001', 'info_requested', 'ops-001');

      expect(result.status).toBe('info_requested');
      expect(mockPrisma.franchiseApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'app-001' },
          data: expect.objectContaining({
            status: 'info_requested',
            reviewedBy: 'ops-001',
          }),
        }),
      );
    });

    it('transitions from pending_review to approved', async () => {
      const application = { id: 'app-001', status: 'pending_review' };
      (mockPrisma.franchiseApplication.findUnique as any).mockResolvedValue(application);
      (mockPrisma.franchiseApplication.update as any).mockResolvedValue({
        ...application,
        status: 'approved',
      });

      const result = await service.updateStatus('app-001', 'approved', 'admin-001', 'All criteria met');

      expect(result.status).toBe('approved');
    });

    it('transitions from pending_review to rejected', async () => {
      const application = { id: 'app-001', status: 'pending_review' };
      (mockPrisma.franchiseApplication.findUnique as any).mockResolvedValue(application);
      (mockPrisma.franchiseApplication.update as any).mockResolvedValue({
        ...application,
        status: 'rejected',
      });

      const result = await service.updateStatus('app-001', 'rejected', 'admin-001', 'Insufficient capital');

      expect(result.status).toBe('rejected');
    });

    it('throws BUSINESS_FRANCHISE_APPLICATION_INVALID_STATUS for invalid transition', async () => {
      // rejected -> approved is not a valid transition
      const application = { id: 'app-001', status: 'rejected' };
      (mockPrisma.franchiseApplication.findUnique as any).mockResolvedValue(application);

      await expect(
        service.updateStatus('app-001', 'approved', 'admin-001'),
      ).rejects.toMatchObject({
        code: 'BUSINESS_FRANCHISE_APPLICATION_INVALID_STATUS',
        statusCode: 422,
      });
    });

    it('throws BUSINESS_FRANCHISE_APPLICATION_INVALID_STATUS for onboarded -> any transition', async () => {
      const application = { id: 'app-001', status: 'onboarded' };
      (mockPrisma.franchiseApplication.findUnique as any).mockResolvedValue(application);

      await expect(
        service.updateStatus('app-001', 'approved', 'admin-001'),
      ).rejects.toMatchObject({
        code: 'BUSINESS_FRANCHISE_APPLICATION_INVALID_STATUS',
      });
    });

    it('throws BUSINESS_FRANCHISE_NOT_FOUND when application does not exist', async () => {
      (mockPrisma.franchiseApplication.findUnique as any).mockResolvedValue(null);

      await expect(
        service.updateStatus('nonexistent', 'approved', 'admin-001'),
      ).rejects.toMatchObject({
        code: 'BUSINESS_FRANCHISE_NOT_FOUND',
        statusCode: 404,
      });
    });

    it('validates all VALID_TRANSITIONS: approved -> agreement_sent', async () => {
      const application = { id: 'app-001', status: 'approved' };
      (mockPrisma.franchiseApplication.findUnique as any).mockResolvedValue(application);
      (mockPrisma.franchiseApplication.update as any).mockResolvedValue({
        ...application,
        status: 'agreement_sent',
      });

      const result = await service.updateStatus('app-001', 'agreement_sent', 'admin-001');

      expect(result.status).toBe('agreement_sent');
    });

    it('rejects transition approved -> onboarded (must go through agreement_sent)', async () => {
      const application = { id: 'app-001', status: 'approved' };
      (mockPrisma.franchiseApplication.findUnique as any).mockResolvedValue(application);

      await expect(
        service.updateStatus('app-001', 'onboarded', 'admin-001'),
      ).rejects.toMatchObject({
        code: 'BUSINESS_FRANCHISE_APPLICATION_INVALID_STATUS',
      });
    });
  });

  // ===========================================================================
  // approveAndSendAgreement
  // ===========================================================================

  describe('approveAndSendAgreement', () => {
    it('sends agreement for an approved application', async () => {
      const application = { id: 'app-001', status: 'approved' };
      const updated = { ...application, status: 'agreement_sent', agreementDocUrl: 'https://example.com/agreement.pdf' };
      (mockPrisma.franchiseApplication.findUnique as any).mockResolvedValue(application);
      (mockPrisma.franchiseApplication.update as any).mockResolvedValue(updated);

      const result = await service.approveAndSendAgreement(
        'app-001',
        'https://example.com/agreement.pdf',
        'admin-001',
      );

      expect(result.status).toBe('agreement_sent');
      expect(mockPrisma.franchiseApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'agreement_sent',
            agreementDocUrl: 'https://example.com/agreement.pdf',
          }),
        }),
      );
    });

    it('throws when application is not in approved status', async () => {
      const application = { id: 'app-001', status: 'pending_review' };
      (mockPrisma.franchiseApplication.findUnique as any).mockResolvedValue(application);

      await expect(
        service.approveAndSendAgreement('app-001', 'https://example.com/agreement.pdf', 'admin-001'),
      ).rejects.toMatchObject({
        code: 'BUSINESS_FRANCHISE_APPLICATION_INVALID_STATUS',
        statusCode: 422,
      });
    });

    it('throws when application does not exist', async () => {
      (mockPrisma.franchiseApplication.findUnique as any).mockResolvedValue(null);

      await expect(
        service.approveAndSendAgreement('nonexistent', 'https://example.com/agreement.pdf', 'admin-001'),
      ).rejects.toMatchObject({
        code: 'BUSINESS_FRANCHISE_APPLICATION_INVALID_STATUS',
        statusCode: 422,
      });
    });
  });

  // ===========================================================================
  // completeOnboarding
  // ===========================================================================

  describe('completeOnboarding', () => {
    const contractTerms = {
      franchisePercentage: 70,
      platformPercentage: 30,
      contractStartDate: '2026-01-01',
    };

    it('creates franchise and updates application to onboarded', async () => {
      const application = {
        id: 'app-001',
        status: 'agreement_sent',
        cityId: VALID_CITY_ID,
        applicantName: 'Ravi Kumar',
        applicantEmail: 'ravi@example.com',
        applicantPhone: '+919876543210',
      };
      const updatedApp = { ...application, status: 'onboarded' };
      const franchise = { id: 'franchise-001', cityId: VALID_CITY_ID };
      (mockPrisma.franchiseApplication.findUnique as any).mockResolvedValue(application);
      (mockPrisma.$transaction as any).mockResolvedValue([updatedApp, franchise]);

      const result = await service.completeOnboarding(
        'app-001',
        'https://example.com/signed-agreement.pdf',
        'user-001',
        contractTerms,
      );

      expect(result.application.status).toBe('onboarded');
      expect(result.franchise.id).toBe('franchise-001');
    });

    it('throws when application is not in agreement_sent status', async () => {
      const application = { id: 'app-001', status: 'approved' };
      (mockPrisma.franchiseApplication.findUnique as any).mockResolvedValue(application);

      await expect(
        service.completeOnboarding('app-001', 'https://example.com/signed.pdf', 'user-001', contractTerms),
      ).rejects.toMatchObject({
        code: 'BUSINESS_FRANCHISE_APPLICATION_INVALID_STATUS',
        statusCode: 422,
      });
    });

    it('throws when application does not exist', async () => {
      (mockPrisma.franchiseApplication.findUnique as any).mockResolvedValue(null);

      await expect(
        service.completeOnboarding('nonexistent', 'https://example.com/signed.pdf', 'user-001', contractTerms),
      ).rejects.toMatchObject({
        code: 'BUSINESS_FRANCHISE_APPLICATION_INVALID_STATUS',
        statusCode: 422,
      });
    });
  });

  // ===========================================================================
  // listApplications
  // ===========================================================================

  describe('listApplications', () => {
    it('returns all applications without filters', async () => {
      const applications = [
        { id: 'app-001', status: 'pending_review' },
        { id: 'app-002', status: 'approved' },
      ];
      (mockPrisma.franchiseApplication.findMany as any).mockResolvedValue(applications);

      const result = await service.listApplications();

      expect(result).toHaveLength(2);
      expect(mockPrisma.franchiseApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      );
    });

    it('filters by status when provided', async () => {
      (mockPrisma.franchiseApplication.findMany as any).mockResolvedValue([]);

      await service.listApplications({ status: 'pending_review' });

      expect(mockPrisma.franchiseApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'pending_review' },
        }),
      );
    });

    it('filters by cityId when provided', async () => {
      (mockPrisma.franchiseApplication.findMany as any).mockResolvedValue([]);

      await service.listApplications({ cityId: VALID_CITY_ID });

      expect(mockPrisma.franchiseApplication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { cityId: VALID_CITY_ID },
        }),
      );
    });
  });

  // ===========================================================================
  // getApplication
  // ===========================================================================

  describe('getApplication', () => {
    it('returns application with city details', async () => {
      const application = {
        id: 'app-001',
        status: 'pending_review',
        city: { cityName: 'Lucknow', state: 'Uttar Pradesh' },
      };
      (mockPrisma.franchiseApplication.findUnique as any).mockResolvedValue(application);

      const result = await service.getApplication('app-001');

      expect(result.id).toBe('app-001');
      expect(result.city).toBeDefined();
    });

    it('throws BUSINESS_FRANCHISE_NOT_FOUND when not found', async () => {
      (mockPrisma.franchiseApplication.findUnique as any).mockResolvedValue(null);

      await expect(service.getApplication('nonexistent')).rejects.toMatchObject({
        code: 'BUSINESS_FRANCHISE_NOT_FOUND',
        statusCode: 404,
      });
    });
  });
});
