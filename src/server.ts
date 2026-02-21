// BigInt JSON serialization — must be set before any Express response
// Converts BigInt to string in all JSON.stringify calls (e.g. res.json)
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

// Application Insights MUST be initialized before all other imports
// so it can monkey-patch HTTP modules for dependency tracking.
import { initializeAppInsights } from './shared/monitoring/app-insights';
initializeAppInsights();

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import pinoHttp from 'pino-http';
import { PgBoss } from 'pg-boss';
import admin from 'firebase-admin';
import { prisma } from './shared/prisma/client';
import { createApiRouter, createServiceContainer } from './routes';
import { registerEpic13Routes, registerEpic13Jobs } from './domains/epic13-routes';
import { errorHandler } from './middleware/error-handler';
import { authenticate } from './middleware/authenticate';
import { requestId } from './middleware/request-id';
import { metrics } from './shared/utils/metrics';
import { logger } from './shared/utils/logger';
import { setupSwagger } from './shared/swagger/swagger';

// ============================================================
// Process-Level Exception Handlers
// ============================================================
let serverReady = false;

process.on('unhandledRejection', (reason: unknown) => {
  logger.error({ err: reason }, 'Unhandled promise rejection');
});

process.on('uncaughtException', (error: Error) => {
  logger.fatal({ err: error }, 'Uncaught exception');
  if (serverReady) {
    // Fatal in production after server is running — exit to trigger container restart
    process.exit(1);
  }
  // During startup: log but don't exit — let the specific try/catch handle it
  // This prevents container restart loops when a non-essential service fails to init
});

// ============================================================
// Firebase Admin Initialization
// ============================================================
try {
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    logger.info('Firebase Admin initialized');
  } else {
    logger.warn('Firebase credentials not provided — Firebase services will be unavailable');
  }
} catch (err) {
  logger.error({ err }, 'Firebase Admin init failed — Firebase services unavailable');
}

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Azure App Service front-end)
const PORT = process.env.PORT || 3000;
const boss = new PgBoss(process.env.DATABASE_URL!);

// ============================================================
// Request ID + Structured HTTP Logging
// ============================================================
app.use(requestId);
app.use(pinoHttp({
  logger,
  genReqId: (req) => (req as express.Request).id,
  customLogLevel(_req, res, err) {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  customSuccessMessage(req, res) {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
  customErrorMessage(req, res) {
    return `${req.method} ${req.url} ${res.statusCode}`;
  },
}));

// ============================================================
// Security Middleware Stack
// ============================================================
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================================
// Rate Limiting (Redis-backed if REDIS_URL is set, else in-memory)
// ============================================================
import { RedisStore } from 'rate-limit-redis';
import { Redis } from 'ioredis';

let rateLimitStore: any;
if (process.env.REDIS_URL) {
  const redisClient = new Redis(process.env.REDIS_URL);
  redisClient.on('error', (err) => logger.warn({ err }, 'Redis rate-limit client error — falling back to in-memory'));
  rateLimitStore = new RedisStore({
    sendCommand: (...args: string[]) => redisClient.call(args[0], ...args.slice(1)) as any,
  });
  logger.info('Rate limiting backed by Redis');
} else {
  logger.info('Rate limiting using in-memory store (set REDIS_URL for distributed)');
}

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
  ...(rateLimitStore ? { store: rateLimitStore } : {}),
  keyGenerator: (req) => req.user?.id || req.ip || 'unknown',
});
app.use(globalLimiter);

// Stricter rate limit for auth-related endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many authentication attempts, please try again later.' },
  ...(rateLimitStore ? { store: rateLimitStore } : {}),
});
app.use('/api/v1/auth', authLimiter);
app.use('/auth', authLimiter);

// ============================================================
// Metrics Collection Middleware
// Tracks request count, duration, and error count per route.
// TODO: Replace with prom-client (Prometheus) for production at scale.
// ============================================================
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    metrics.recordRequest(req.method, req.path, res.statusCode, Date.now() - start);
  });
  next();
});

// ============================================================
// Metrics Endpoint (JSON)
// ============================================================
app.get('/metrics', (_req, res) => {
  res.json({ success: true, data: metrics.getSnapshot() });
});

// ============================================================
// Health Checks
// /health       — full health (DB + Firebase + PgBoss)
// /health/live  — liveness probe (always 200 if process is running)
// /health/ready — readiness probe (checks DB connectivity)
// ============================================================

/** Run a check with a timeout (default 5s). */
async function timedCheck(name: string, fn: () => Promise<void>, timeoutMs = 5000): Promise<{ status: string; message?: string; durationMs: number }> {
  const start = Date.now();
  try {
    await Promise.race([
      fn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`${name} check timed out after ${timeoutMs}ms`)), timeoutMs)),
    ]);
    return { status: 'healthy', durationMs: Date.now() - start };
  } catch (err) {
    return { status: 'unhealthy', message: (err as Error).message, durationMs: Date.now() - start };
  }
}

// Liveness probe — if the process responds, it's alive
app.get('/health/live', (_req, res) => {
  res.status(200).json({ status: 'alive', timestamp: new Date().toISOString() });
});

// Readiness probe — checks DB is reachable (for Kubernetes/Azure startup probes)
app.get('/health/ready', async (_req, res) => {
  const db = await timedCheck('database', async () => { await prisma.$queryRaw`SELECT 1`; });
  const ready = db.status === 'healthy';
  res.status(ready ? 200 : 503).json({
    success: ready,
    data: { status: ready ? 'ready' : 'not_ready', checks: { database: db } },
  });
});

// Full health check — all subsystems
app.get('/health', async (_req, res) => {
  const checks: Record<string, { status: string; message?: string; durationMs: number }> = {};

  // Check database connectivity
  checks.database = await timedCheck('database', async () => { await prisma.$queryRaw`SELECT 1`; });

  // Check Firebase Admin is initialized
  checks.firebase = await timedCheck('firebase', async () => {
    const apps = admin.apps;
    if (!apps || apps.length === 0) throw new Error('Firebase Admin not initialized');
  });

  // Check PgBoss queue status
  checks.pgboss = await timedCheck('pgboss', async () => {
    // boss.getQueueSize returns number — if it throws, PgBoss is down
    await boss.getQueues();
  });

  const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');

  res.status(allHealthy ? 200 : 503).json({
    success: allHealthy,
    data: {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: process.uptime(),
      checks,
    },
  });
});

// ============================================================
// Swagger UI — accessible without authentication at /api-docs
// Mounted BEFORE authenticated routes so it is not blocked.
// ============================================================
setupSwagger(app);

// ============================================================
// Auth Routes (Epic 1) — mounted BEFORE authenticated routes
// /register does not require authentication
// ============================================================
import { createAuthController } from './domains/auth/auth.controller';
import { createRoleRequestController } from './domains/auth/role-request.controller';
try {
  app.use('/api/v1/auth', createAuthController(prisma as any));
  app.use('/api/v1/auth/role-requests', createRoleRequestController(prisma as any));
  logger.info('Epic 1: Auth & Onboarding routes registered');
} catch (err) {
  logger.error({ err }, 'Epic 1 auth routes failed to register — auth endpoints unavailable');
}

// ============================================================
// API Routes (v1) — all require authentication
// Routes are mounted synchronously so they register before the
// 404 catch-all. PgBoss starts in background; jobs queue once ready.
// ============================================================
let services: ReturnType<typeof createServiceContainer> | undefined;

try {
  services = createServiceContainer(prisma as any);
  app.use('/api/v1', createApiRouter(services, prisma as any, boss));
  logger.info('API v1 routes registered');
} catch (err) {
  logger.error({ err }, 'API v1 routes failed to register — API endpoints unavailable');
}

// Epic 13: NRI Services, POA & Court Tracking Routes
try {
  const epic13Router = express.Router();
  epic13Router.use(authenticate);
  registerEpic13Routes(epic13Router, prisma as any, boss);
  app.use(epic13Router);
  logger.info('Epic 13: NRI Services, POA & Court Tracking routes registered');
} catch (err) {
  logger.error({ err }, 'Epic 13 routes failed to register — these routes will be unavailable');
}

// ============================================================
// Feature Usage Tracking Middleware (Story 14-12)
// Tracks API endpoint usage for analytics
// ============================================================
app.use((req, _res, next) => {
  if (services && req.path.startsWith('/api/v1') && req.user) {
    // Fire-and-forget event tracking
    services.featureUsageService.trackEvent({
      eventName: `api.${req.method}.${req.path.replace(/\/api\/v1\//, '').split('/')[0]}`,
      userId: req.user.id,
      userRole: req.user.role,
      cityId: req.user.cityId,
      metadata: { method: req.method, path: req.path },
    }).catch(() => {}); // Non-blocking
  }
  next();
});

// ============================================================
// Catch-All 404 Handler (returns JSON, not Express default HTML)
// ============================================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: `${req.method} ${req.originalUrl} is not a valid endpoint`,
    },
  });
});

// ============================================================
// Global Error Handler
// ============================================================
app.use(errorHandler);

// ============================================================
// Start Server — BEFORE PgBoss so Azure health probe passes immediately
// ============================================================
let server: ReturnType<typeof app.listen> | undefined;

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    serverReady = true;
    logger.info({ port: PORT, env: process.env.NODE_ENV || 'development' }, 'Property Legal Agent API started');
  });
}

// Start PgBoss in background AFTER server is listening.
// All boss.work()/boss.schedule() calls are deferred here because
// they require the PgBoss schema (created by boss.start()).
boss.start().then(async () => {
  logger.info('PgBoss started — registering background jobs');
  await registerEpic13Jobs(boss, prisma as any);
  logger.info('PgBoss background jobs now active');
}).catch((err: unknown) => {
  logger.error({ err }, 'Failed to start PgBoss — background jobs will not work');
});

// ============================================================
// Graceful Shutdown
// ============================================================
async function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Graceful shutdown initiated');

  // Force exit after 10 seconds
  const forceExitTimeout = setTimeout(() => {
    logger.fatal('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000);
  forceExitTimeout.unref();

  try {
    // Close HTTP server (stop accepting new connections)
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => (err ? reject(err) : resolve()));
      });
      logger.info('HTTP server closed');
    }

    // Close PgBoss
    try {
      await boss.stop();
      logger.info('PgBoss stopped');
    } catch {
      // PgBoss may not have started
    }

    // Close Prisma connection
    await prisma.$disconnect();
    logger.info('Prisma disconnected');

    process.exit(0);
  } catch (err) {
    logger.error({ err }, 'Error during graceful shutdown');
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app, server, services, serverReady };
