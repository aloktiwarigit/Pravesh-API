/**
 * Integration tests for the Dealer Controller (HTTP layer).
 * All database/service calls are mocked. Tests only the HTTP contract:
 * status codes, response shape, validation errors.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestApp } from '../../../__tests__/helpers/test-app';
import { createDealerController } from '../dealers.controller';

// ---------------------------------------------------------------------------
// Mock Prisma factory
// ---------------------------------------------------------------------------
function createMockPrisma() {
  return {
    dealer: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    dealerKyc: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    dealerLinkClick: {
      create: vi.fn(),
    },
    dealerBankAccount: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    dealerLeaderboardSnapshot: {
      findMany: vi.fn(),
    },
    dealerBadge: {
      findMany: vi.fn(),
    },
    dealerCommission: {
      findMany: vi.fn(),
      aggregate: vi.fn(),
    },
    customerAttribution: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  } as any;
}

// Mock DealerService, AttributionService, BadgeService, BankAccountService
vi.mock('../dealers.service', () => ({
  DealerService: vi.fn().mockImplementation(() => ({
    submitKyc: vi.fn(),
    approveKyc: vi.fn(),
    rejectKyc: vi.fn(),
    getDealerReferralData: vi.fn(),
    getDealerPipeline: vi.fn(),
    getTierProgress: vi.fn(),
    getLeaderboard: vi.fn(),
    updateWhiteLabel: vi.fn(),
  })),
}));

vi.mock('../attribution.service', () => ({
  AttributionService: vi.fn().mockImplementation(() => ({
    attributeCustomer: vi.fn(),
  })),
}));

vi.mock('../badges.service', () => ({
  BadgeService: vi.fn().mockImplementation(() => ({
    getDealerBadges: vi.fn(),
    getNextBadgeProgress: vi.fn(),
  })),
}));

vi.mock('../bank-accounts.service', () => ({
  BankAccountService: vi.fn().mockImplementation(() => ({
    getDealerAccounts: vi.fn(),
    addBankAccount: vi.fn(),
    verifyBankAccount: vi.fn(),
    setPrimaryAccount: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Build test app helper
// ---------------------------------------------------------------------------
function buildApp(mockPrisma: any) {
  return createTestApp({
    routes(app) {
      app.use('/api/v1/dealers', createDealerController(mockPrisma));
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('Dealer Controller', () => {
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mockPrisma = createMockPrisma();
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.DEV_AUTH_BYPASS = 'true';
  });

  afterEach(() => {
    delete process.env.DEV_AUTH_BYPASS;
  });

  // ==========================================================================
  // POST /kyc — KYC Submission (Story 9.1)
  // ==========================================================================

  describe('POST /api/v1/dealers/kyc', () => {
    const validKycBody = {
      fullName: 'Rajesh Kumar',
      panNumber: 'ABCDE1234F',
      aadhaarLastFour: '1234',
      ifscCode: 'HDFC0001234',
      accountNumber: '123456789',
      accountHolderName: 'Rajesh Kumar',
      panPhotoUrl: 'https://storage.example.com/pan.jpg',
    };

    test('returns 400 for invalid PAN format', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request
        .post('/api/v1/dealers/kyc')
        .set('x-dev-user-id', 'dealer-001')
        .set('x-dev-role', 'dealer')
        .send({ ...validKycBody, panNumber: 'INVALID' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('returns 400 for invalid aadhaarLastFour', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request
        .post('/api/v1/dealers/kyc')
        .set('x-dev-user-id', 'dealer-001')
        .set('x-dev-role', 'dealer')
        .send({ ...validKycBody, aadhaarLastFour: 'abcd' });

      expect(res.status).toBe(400);
    });

    test('returns 400 for invalid IFSC format', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request
        .post('/api/v1/dealers/kyc')
        .set('x-dev-user-id', 'dealer-001')
        .set('x-dev-role', 'dealer')
        .send({ ...validKycBody, ifscCode: 'INVALID' });

      expect(res.status).toBe(400);
    });

    test('returns 400 for invalid panPhotoUrl', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request
        .post('/api/v1/dealers/kyc')
        .set('x-dev-user-id', 'dealer-001')
        .set('x-dev-role', 'dealer')
        .send({ ...validKycBody, panPhotoUrl: 'not-a-url' });

      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // GET /kyc/status
  // ==========================================================================

  describe('GET /api/v1/dealers/kyc/status', () => {
    test('returns NOT_STARTED when no dealer record exists', async () => {
      const { request } = buildApp(mockPrisma);
      mockPrisma.dealer.findUnique.mockResolvedValue(null);

      const res = await request
        .get('/api/v1/dealers/kyc/status')
        .set('x-dev-user-id', 'dealer-001')
        .set('x-dev-role', 'dealer');

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('NOT_STARTED');
    });

    test('returns dealer status when dealer exists', async () => {
      const { request } = buildApp(mockPrisma);
      mockPrisma.dealer.findUnique.mockResolvedValue({
        id: 'dealer-001',
        dealerStatus: 'PENDING_KYC',
        kyc: { status: 'PENDING', rejectionReason: null, reviewedAt: null },
      });

      const res = await request
        .get('/api/v1/dealers/kyc/status')
        .set('x-dev-user-id', 'dealer-001')
        .set('x-dev-role', 'dealer');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.dealerStatus).toBe('PENDING_KYC');
      expect(res.body.data.kycStatus).toBe('PENDING');
    });
  });

  // ==========================================================================
  // POST /track-click — Public endpoint (Story 9.4)
  // ==========================================================================

  describe('POST /api/v1/dealers/track-click', () => {
    test('returns 400 when dealerCode is missing', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request
        .post('/api/v1/dealers/track-click')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_DEALER_CODE');
    });

    test('returns 404 when dealerCode does not exist', async () => {
      const { request } = buildApp(mockPrisma);
      mockPrisma.dealer.findUnique.mockResolvedValue(null);

      const res = await request
        .post('/api/v1/dealers/track-click')
        .send({ dealerCode: 'INVALID-CODE' });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('DEALER_NOT_FOUND');
    });

    test('tracks click and returns success', async () => {
      const { request } = buildApp(mockPrisma);
      mockPrisma.dealer.findUnique.mockResolvedValue({ id: 'dealer-001' });
      mockPrisma.dealerLinkClick.create.mockResolvedValue({ id: 'click-001' });

      const res = await request
        .post('/api/v1/dealers/track-click')
        .send({ dealerCode: 'DEAL-001' });

      expect(res.status).toBe(200);
      expect(res.body.data.tracked).toBe(true);
    });
  });

  // ==========================================================================
  // POST /attribute — Customer Attribution (Story 9.5)
  // ==========================================================================

  describe('POST /api/v1/dealers/attribute', () => {
    test('returns 400 when customerId and dealerCode are missing', async () => {
      const { request } = buildApp(mockPrisma);

      const res = await request
        .post('/api/v1/dealers/attribute')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('MISSING_FIELDS');
    });

    test('returns success silently even on attribution error (AC2)', async () => {
      // Attribution errors must be silent per story acceptance criteria
      const { request } = buildApp(mockPrisma);

      const res = await request
        .post('/api/v1/dealers/attribute')
        .send({ customerId: 'cust-001', dealerCode: 'DEAL-001' });

      // Even if service throws, should return success
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ==========================================================================
  // GET /referral-data — Story 9.3
  // ==========================================================================

  describe('GET /api/v1/dealers/referral-data', () => {
    test('returns 403 when dealer not found', async () => {
      const { request } = buildApp(mockPrisma);
      mockPrisma.dealer.findUnique.mockResolvedValue(null);

      const res = await request
        .get('/api/v1/dealers/referral-data')
        .set('x-dev-user-id', 'dealer-001')
        .set('x-dev-role', 'dealer');

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('DEALER_NOT_ACTIVE');
    });

    test('returns 403 when dealer is not ACTIVE', async () => {
      const { request } = buildApp(mockPrisma);
      mockPrisma.dealer.findUnique.mockResolvedValue({
        id: 'dealer-001',
        dealerStatus: 'PENDING_KYC',
      });

      const res = await request
        .get('/api/v1/dealers/referral-data')
        .set('x-dev-user-id', 'dealer-001')
        .set('x-dev-role', 'dealer');

      expect(res.status).toBe(403);
    });
  });

  // ==========================================================================
  // GET /profile — Story 9.15
  // ==========================================================================

  describe('GET /api/v1/dealers/profile', () => {
    test('returns 404 when dealer profile not found', async () => {
      const { request } = buildApp(mockPrisma);
      mockPrisma.dealer.findUnique.mockResolvedValue(null);

      const res = await request
        .get('/api/v1/dealers/profile')
        .set('x-dev-user-id', 'dealer-001')
        .set('x-dev-role', 'dealer');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('DEALER_NOT_FOUND');
    });

    test('returns dealer profile when found', async () => {
      const { request } = buildApp(mockPrisma);
      const dealer = {
        id: 'dealer-001',
        dealerCode: 'DEAL-001',
        dealerStatus: 'ACTIVE',
        currentTier: 'SILVER',
        businessName: 'Best Properties',
        whitelabelEnabled: false,
        logoUrl: null,
        cityId: 'city-001',
        createdAt: new Date(),
        kyc: { status: 'APPROVED', aadhaarMasked: '****1234', reviewedAt: new Date() },
      };
      mockPrisma.dealer.findUnique.mockResolvedValue(dealer);

      const res = await request
        .get('/api/v1/dealers/profile')
        .set('x-dev-user-id', 'dealer-001')
        .set('x-dev-role', 'dealer');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.dealerCode).toBe('DEAL-001');
      expect(res.body.data.currentTier).toBe('SILVER');
    });
  });

  // ==========================================================================
  // GET /white-label, PUT /white-label — Story 9.12
  // ==========================================================================

  describe('GET /api/v1/dealers/white-label', () => {
    test('returns white-label settings', async () => {
      const { request } = buildApp(mockPrisma);
      mockPrisma.dealer.findUnique.mockResolvedValue({
        id: 'dealer-001',
        whitelabelEnabled: true,
        logoUrl: 'https://example.com/logo.png',
        brandColor: '#FF5733',
        currentTier: 'GOLD',
      });

      const res = await request
        .get('/api/v1/dealers/white-label')
        .set('x-dev-user-id', 'dealer-001')
        .set('x-dev-role', 'dealer');

      expect(res.status).toBe(200);
      expect(res.body.data.whitelabelEnabled).toBe(true);
      expect(res.body.data.isEligible).toBe(true);
    });

    test('returns 403 when dealer not found', async () => {
      const { request } = buildApp(mockPrisma);
      mockPrisma.dealer.findUnique.mockResolvedValue(null);

      const res = await request
        .get('/api/v1/dealers/white-label')
        .set('x-dev-user-id', 'dealer-001')
        .set('x-dev-role', 'dealer');

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/v1/dealers/white-label', () => {
    test('returns 400 for invalid brandColor format', async () => {
      const { request } = buildApp(mockPrisma);
      mockPrisma.dealer.findUnique.mockResolvedValue({
        id: 'dealer-001',
        currentTier: 'GOLD',
        whitelabelEnabled: false,
      });

      const res = await request
        .put('/api/v1/dealers/white-label')
        .set('x-dev-user-id', 'dealer-001')
        .set('x-dev-role', 'dealer')
        .send({ enabled: true, brandColor: 'red' });

      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // POST /bank-accounts — Story 9.13
  // ==========================================================================

  describe('POST /api/v1/dealers/bank-accounts', () => {
    test('returns 400 for invalid IFSC code', async () => {
      const { request } = buildApp(mockPrisma);
      mockPrisma.dealer.findUnique.mockResolvedValue({ id: 'dealer-001' });

      const res = await request
        .post('/api/v1/dealers/bank-accounts')
        .set('x-dev-user-id', 'dealer-001')
        .set('x-dev-role', 'dealer')
        .send({
          accountHolderName: 'Test User',
          ifscCode: 'INVALID',
          accountNumber: '123456789',
          accountType: 'SAVINGS',
          bankName: 'HDFC',
        });

      expect(res.status).toBe(400);
    });

    test('returns 400 for invalid accountType', async () => {
      const { request } = buildApp(mockPrisma);
      mockPrisma.dealer.findUnique.mockResolvedValue({ id: 'dealer-001' });

      const res = await request
        .post('/api/v1/dealers/bank-accounts')
        .set('x-dev-user-id', 'dealer-001')
        .set('x-dev-role', 'dealer')
        .send({
          accountHolderName: 'Test User',
          ifscCode: 'HDFC0001234',
          accountNumber: '123456789',
          accountType: 'FIXED',
          bankName: 'HDFC',
        });

      expect(res.status).toBe(400);
    });
  });

  // ==========================================================================
  // GET /ops/kyc-queue — Story 9.2
  // ==========================================================================

  describe('GET /api/v1/dealers/ops/kyc-queue', () => {
    test('returns kyc queue', async () => {
      const { request } = buildApp(mockPrisma);
      const queue = [
        { id: 'kyc-001', status: 'PENDING', dealer: { id: 'd-001', dealerCode: 'D001', cityId: 'c1' } },
      ];
      mockPrisma.dealerKyc.findMany.mockResolvedValue(queue);

      const res = await request
        .get('/api/v1/dealers/ops/kyc-queue')
        .set('x-dev-user-id', 'ops-001')
        .set('x-dev-role', 'ops');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
    });

    test('supports cityId filter', async () => {
      const { request } = buildApp(mockPrisma);
      mockPrisma.dealerKyc.findMany.mockResolvedValue([]);

      const res = await request
        .get('/api/v1/dealers/ops/kyc-queue?cityId=city-001')
        .set('x-dev-user-id', 'ops-001')
        .set('x-dev-role', 'ops');

      expect(res.status).toBe(200);
    });
  });

  // ==========================================================================
  // GET /ops/active — Active dealers list
  // ==========================================================================

  describe('GET /api/v1/dealers/ops/active', () => {
    test('returns active dealers list', async () => {
      const { request } = buildApp(mockPrisma);
      const dealers = [
        { id: 'd-001', dealerCode: 'D001', currentTier: 'SILVER', cityId: 'c1', userId: 'u1', createdAt: new Date() },
      ];
      mockPrisma.dealer.findMany.mockResolvedValue(dealers);

      const res = await request
        .get('/api/v1/dealers/ops/active')
        .set('x-dev-user-id', 'ops-001')
        .set('x-dev-role', 'ops');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
    });
  });
});
