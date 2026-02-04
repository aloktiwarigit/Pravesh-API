/**
 * Test helper: sets up a test Express app with all middleware layers.
 * Provides a mock Prisma client, mock Firebase admin, and a supertest
 * request function so integration tests can exercise full HTTP flows
 * without a running database or Firebase project.
 */
import { vi } from 'vitest';
import express, { Request, Response, NextFunction, Router } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import supertest from 'supertest';
import { errorHandler } from '../../middleware/error-handler';

// ---------------------------------------------------------------------------
// Mock Prisma Client
// ---------------------------------------------------------------------------
export function createMockPrisma() {
  return {
    $use: vi.fn(),
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
    $disconnect: vi.fn(),
    serviceInstance: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    serviceStateHistory: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    serviceRequest: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    payment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    paymentStateChange: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    cashReceipt: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    refund: {
      create: vi.fn(),
    },
    customerReferralCredit: {
      aggregate: vi.fn(),
      update: vi.fn(),
    },
    creditUsageLog: {
      create: vi.fn(),
    },
    agent: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    dealer: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    city: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    slaBreach: {
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
    slaWarning: {
      findFirst: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
  } as any;
}

// ---------------------------------------------------------------------------
// Mock Firebase Admin Auth
// ---------------------------------------------------------------------------
export function createMockFirebaseAuth() {
  const mockVerifyIdToken = vi.fn();
  return {
    verifyIdToken: mockVerifyIdToken,
    /** Shortcut to make the next verifyIdToken call succeed with the given claims. */
    succeedWith(claims: {
      uid: string;
      email?: string;
      role: string;
      cityId?: string;
      permissions?: string[];
    }) {
      mockVerifyIdToken.mockResolvedValueOnce(claims);
    },
    /** Shortcut to make the next verifyIdToken call fail. */
    failWith(message = 'Token verification failed') {
      mockVerifyIdToken.mockRejectedValueOnce(new Error(message));
    },
  };
}

// ---------------------------------------------------------------------------
// Test Express App Builder
// ---------------------------------------------------------------------------
export interface TestAppOptions {
  /** Extra routers to mount before the error handler. */
  routes?: (app: express.Express) => void;
}

/**
 * Builds a self-contained Express application with the same middleware stack
 * used in production (helmet, cors, compression, JSON body parsing, error
 * handler). Returns a supertest-compatible `request` function.
 */
export function createTestApp(options: TestAppOptions = {}) {
  const app = express();

  // Security & parsing middleware (mirrors server.ts)
  app.use(helmet());
  app.use(cors());
  app.use(compression());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Allow callers to mount routes
  if (options.routes) {
    options.routes(app);
  }

  // Global error handler (must be last)
  app.use(errorHandler);

  return {
    app,
    request: supertest(app),
  };
}

// ---------------------------------------------------------------------------
// Pre-configured user tokens for DEV_AUTH_BYPASS mode
// ---------------------------------------------------------------------------
export const TEST_USERS = {
  customer: {
    'x-dev-user-id': 'customer-001',
    'x-dev-role': 'CUSTOMER',
    'x-dev-city-id': 'lucknow',
    'x-dev-email': 'customer@test.local',
  },
  agent: {
    'x-dev-user-id': 'agent-001',
    'x-dev-role': 'AGENT',
    'x-dev-city-id': 'lucknow',
    'x-dev-email': 'agent@test.local',
  },
  dealer: {
    'x-dev-user-id': 'dealer-001',
    'x-dev-role': 'DEALER',
    'x-dev-city-id': 'delhi',
    'x-dev-email': 'dealer@test.local',
  },
  superAdmin: {
    'x-dev-user-id': 'admin-001',
    'x-dev-role': 'SUPER_ADMIN',
    'x-dev-email': 'admin@test.local',
  },
  opsManager: {
    'x-dev-user-id': 'ops-001',
    'x-dev-role': 'OPS_MANAGER',
    'x-dev-city-id': 'lucknow',
    'x-dev-email': 'ops@test.local',
  },
} as const;
