/**
 * Integration tests: Service Request Lifecycle
 *
 * Tests the service request controller endpoints:
 * - GET /api/v1/service-requests (list)
 * - POST /api/v1/service-requests (create)
 * - POST /api/v1/service-requests/:id/add-service (add service)
 *
 * Uses DEV_AUTH_BYPASS mode to test authorization flows without Firebase.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestApp, createMockPrisma, TEST_USERS } from '../helpers/test-app';
import { authenticate } from '../../middleware/authenticate';
import { createServiceRequestController } from '../../domains/services/service-request.controller';

// ---------------------------------------------------------------------------
// Mock firebase-admin globally
// ---------------------------------------------------------------------------
vi.mock('firebase-admin', () => ({
  default: {
    auth: vi.fn(() => ({
      verifyIdToken: vi.fn(),
    })),
  },
}));

// ---------------------------------------------------------------------------
// Mock ServiceRequestSubmitService
// ---------------------------------------------------------------------------
const mockSubmitRequest = vi.fn();

vi.mock('../../domains/services/service-request.service', () => ({
  ServiceRequestSubmitService: vi.fn().mockImplementation(() => ({
    submitRequest: mockSubmitRequest,
  })),
}));

describe('[P1] Service Request Lifecycle Integration', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let mockPrisma: ReturnType<typeof createMockPrisma>;

  // Customer headers with lowercase 'customer' role to match authorize('customer')
  const CUSTOMER_HEADERS = {
    'x-dev-user-id': 'customer-001',
    'x-dev-role': 'customer',
    'x-dev-city-id': 'lucknow',
    'x-dev-email': 'customer@test.local',
  };

  // Agent headers for testing authorization rejection
  const AGENT_HEADERS = {
    'x-dev-user-id': 'agent-001',
    'x-dev-role': 'agent',
    'x-dev-city-id': 'lucknow',
    'x-dev-email': 'agent@test.local',
  };

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.NODE_ENV = 'test';
    process.env.DEV_AUTH_BYPASS = 'true';
    mockPrisma = createMockPrisma();
    // Add missing methods not in the default mock helper
    (mockPrisma as any).serviceRequest.count = vi.fn();
    (mockPrisma as any).serviceRequest.findFirst = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // -----------------------------------------------------------------------
  // Helper: build test app with service request controller
  // -----------------------------------------------------------------------
  function buildApp() {
    return createTestApp({
      routes(app) {
        app.use(
          '/api/v1/service-requests',
          authenticate,
          createServiceRequestController(mockPrisma as any),
        );
      },
    });
  }

  // -----------------------------------------------------------------------
  // GET /api/v1/service-requests
  // -----------------------------------------------------------------------

  it('[P1] GET / - returns paginated service requests', async () => {
    // Given: customer has service requests in the database
    const mockRequests = [
      {
        id: 'req-001',
        requestNumber: 'REQ-2026-001',
        serviceCode: 'TITLE_SEARCH',
        status: 'pending',
        paymentStatus: 'paid',
        customerId: 'customer-001',
        createdAt: new Date('2026-02-01'),
        updatedAt: new Date('2026-02-01'),
        serviceInstance: {
          propertyType: 'residential',
          propertyAddress: '123 Main St, Lucknow',
          serviceDefinition: {
            name: 'Title Search',
            code: 'TITLE_SEARCH',
            category: 'legal',
          },
        },
      },
    ];

    mockPrisma.serviceRequest.findMany.mockResolvedValue(mockRequests);
    mockPrisma.serviceRequest.count.mockResolvedValue(1);

    const { request } = buildApp();

    // When: customer requests their service requests
    const res = await request.get('/api/v1/service-requests').set(CUSTOMER_HEADERS);

    // Then: returns 200 with paginated data
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: 'req-001',
      requestNumber: 'REQ-2026-001',
      serviceCode: 'TITLE_SEARCH',
      status: 'pending',
      paymentStatus: 'paid',
      propertyType: 'residential',
      propertyLocation: '123 Main St, Lucknow',
    });
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });

    expect(mockPrisma.serviceRequest.findMany).toHaveBeenCalledWith({
      where: { customerId: 'customer-001' },
      skip: 0,
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        serviceInstance: {
          include: {
            serviceDefinition: { select: { name: true, code: true, category: true } },
          },
        },
      },
    });
  });

  it('[P1] GET / - handles empty list', async () => {
    // Given: customer has no service requests
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
    mockPrisma.serviceRequest.count.mockResolvedValue(0);

    const { request } = buildApp();

    // When: customer requests their service requests
    const res = await request.get('/api/v1/service-requests').set(CUSTOMER_HEADERS);

    // Then: returns 200 with empty data array
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual([]);
    expect(res.body.meta).toEqual({
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    });
  });

  it('[P1] GET / - respects page and limit params', async () => {
    // Given: customer has multiple requests
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
    mockPrisma.serviceRequest.count.mockResolvedValue(25);

    const { request } = buildApp();

    // When: customer requests page 2 with limit 5
    const res = await request
      .get('/api/v1/service-requests?page=2&limit=5')
      .set(CUSTOMER_HEADERS);

    // Then: returns correct pagination
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({
      page: 2,
      limit: 5,
      total: 25,
      totalPages: 5,
    });

    expect(mockPrisma.serviceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 5, // (page 2 - 1) * 5
        take: 5,
      }),
    );
  });

  it('[P1] GET / - caps limit at 50', async () => {
    // Given: customer requests a very large limit
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
    mockPrisma.serviceRequest.count.mockResolvedValue(100);

    const { request } = buildApp();

    // When: customer requests limit of 1000
    const res = await request
      .get('/api/v1/service-requests?limit=1000')
      .set(CUSTOMER_HEADERS);

    // Then: limit is capped at 50
    expect(res.status).toBe(200);
    expect(res.body.meta.limit).toBe(50);

    expect(mockPrisma.serviceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 50,
      }),
    );
  });

  it('[P1] GET / - returns 403 for non-customer role', async () => {
    // Given: agent tries to access customer endpoint
    const { request } = buildApp();

    // When: agent requests service requests
    const res = await request.get('/api/v1/service-requests').set(AGENT_HEADERS);

    // Then: returns 403 forbidden
    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_INSUFFICIENT_ROLE');
    expect(res.body.error.message).toContain('customer');
  });

  it('[P1] GET / - returns 401 without auth', async () => {
    // Given: unauthenticated request
    process.env.DEV_AUTH_BYPASS = 'false';
    const { request } = buildApp();

    // When: request without headers
    const res = await request.get('/api/v1/service-requests');

    // Then: returns 401 unauthorized
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('AUTH_TOKEN_INVALID');
  });

  // -----------------------------------------------------------------------
  // POST /api/v1/service-requests
  // -----------------------------------------------------------------------

  it('[P1] POST / - creates a new service request', async () => {
    // Given: valid service request input
    const mockResult = {
      requestId: 'req-002',
      requestNumber: 'REQ-2026-002',
      serviceInstanceId: 'si-002',
    };

    mockSubmitRequest.mockResolvedValue(mockResult);

    const { request } = buildApp();

    // When: customer submits a new service request
    const res = await request
      .post('/api/v1/service-requests')
      .set(CUSTOMER_HEADERS)
      .send({
        serviceId: 'svc-001',
        propertyType: 'residential',
        propertyLocation: '456 Oak Ave, Lucknow',
        ownershipStatus: 'self',
        ownerName: 'Test Owner',
        estimatedValuePaise: 5000000,
      });

    // Then: returns 201 with created request data
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(mockResult);

    expect(mockSubmitRequest).toHaveBeenCalledWith(
      {
        serviceId: 'svc-001',
        propertyType: 'residential',
        propertyLocation: '456 Oak Ave, Lucknow',
        ownershipStatus: 'self',
        ownerName: 'Test Owner',
        estimatedValuePaise: 5000000,
      },
      expect.objectContaining({
        id: 'customer-001',
        email: 'customer@test.local',
      }),
    );
  });

  it('[P1] POST / - returns 400 for missing required fields', async () => {
    // Given: invalid request body (missing required fields)
    const { request } = buildApp();

    // When: customer submits incomplete request
    const res = await request
      .post('/api/v1/service-requests')
      .set(CUSTOMER_HEADERS)
      .send({
        serviceId: 'svc-001',
        // Missing: propertyType, propertyLocation, ownershipStatus
      });

    // Then: returns 400 validation error
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(mockSubmitRequest).not.toHaveBeenCalled();
  });

  it('[P1] POST / - returns 400 for empty serviceId', async () => {
    // Given: request with empty serviceId
    const { request } = buildApp();

    // When: customer submits request with empty serviceId
    const res = await request
      .post('/api/v1/service-requests')
      .set(CUSTOMER_HEADERS)
      .send({
        serviceId: '',
        propertyType: 'residential',
        propertyLocation: '789 Elm St',
        ownershipStatus: 'self',
      });

    // Then: returns 400 validation error
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(mockSubmitRequest).not.toHaveBeenCalled();
  });

  // -----------------------------------------------------------------------
  // POST /api/v1/service-requests/:id/add-service
  // -----------------------------------------------------------------------

  it('[P1] POST /:id/add-service - adds service to existing request', async () => {
    // Given: existing service request belongs to customer
    const existingRequest = {
      id: 'req-003',
      customerId: 'customer-001',
      serviceInstance: {
        propertyType: 'commercial',
        propertyAddress: '100 Business Park, Lucknow',
      },
    };

    const mockAddResult = {
      requestId: 'req-004',
      requestNumber: 'REQ-2026-004',
      serviceInstanceId: 'si-004',
    };

    mockPrisma.serviceRequest.findFirst.mockResolvedValue(existingRequest);
    mockSubmitRequest.mockResolvedValue(mockAddResult);

    const { request } = buildApp();

    // When: customer adds a service to their existing request
    const res = await request
      .post('/api/v1/service-requests/req-003/add-service')
      .set(CUSTOMER_HEADERS)
      .send({
        serviceId: 'svc-002',
      });

    // Then: returns 201 with new request data
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(mockAddResult);

    expect(mockPrisma.serviceRequest.findFirst).toHaveBeenCalledWith({
      where: { id: 'req-003', customerId: 'customer-001' },
      include: { serviceInstance: true },
    });

    expect(mockSubmitRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        serviceId: 'svc-002',
        propertyType: 'commercial',
        propertyLocation: '100 Business Park, Lucknow',
        ownershipStatus: 'self',
      }),
      expect.objectContaining({
        id: 'customer-001',
      }),
    );
  });

  it('[P1] POST /:id/add-service - returns 404 for non-existent request', async () => {
    // Given: request does not exist
    mockPrisma.serviceRequest.findFirst.mockResolvedValue(null);

    const { request } = buildApp();

    // When: customer tries to add service to non-existent request
    const res = await request
      .post('/api/v1/service-requests/nonexistent-id/add-service')
      .set(CUSTOMER_HEADERS)
      .send({
        serviceId: 'svc-002',
      });

    // Then: returns 404 not found
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('REQUEST_NOT_FOUND');
    expect(mockSubmitRequest).not.toHaveBeenCalled();
  });

  it('[P1] POST /:id/add-service - returns 404 when request belongs to different user', async () => {
    // Given: request exists but belongs to different customer
    mockPrisma.serviceRequest.findFirst.mockResolvedValue(null); // findFirst with customerId check returns null

    const { request } = buildApp();

    // When: customer tries to add service to another customer's request
    const res = await request
      .post('/api/v1/service-requests/req-999/add-service')
      .set(CUSTOMER_HEADERS)
      .send({
        serviceId: 'svc-002',
      });

    // Then: returns 404 not found (doesn't leak existence)
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('REQUEST_NOT_FOUND');

    expect(mockPrisma.serviceRequest.findFirst).toHaveBeenCalledWith({
      where: { id: 'req-999', customerId: 'customer-001' },
      include: { serviceInstance: true },
    });

    expect(mockSubmitRequest).not.toHaveBeenCalled();
  });
});
