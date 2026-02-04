import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { PgBoss } from 'pg-boss';
import admin from 'firebase-admin';
import { prisma } from './shared/prisma/client';
import { createApiRouter, createServiceContainer } from './routes';
import { registerEpic13Routes } from './domains/epic13-routes';
import { errorHandler } from './middleware/error-handler';
import { authenticate } from './middleware/authenticate';
import { metrics } from './shared/utils/metrics';
import { setupSwagger } from './shared/swagger/swagger';

// NOTE: The following packages must be installed for Swagger UI:
//   npm install swagger-ui-express
//   npm install -D @types/swagger-ui-express

// ============================================================
// Process-Level Exception Handlers
// ============================================================
process.on('unhandledRejection', (reason: unknown) => {
  console.error('[Process] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error: Error) => {
  console.error('[Process] Uncaught Exception:', error);
  process.exit(1);
});

// ============================================================
// Firebase Admin Initialization
// ============================================================
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
  console.log('[Server] Firebase Admin initialized');
} else {
  console.warn(
    '[Server] Firebase credentials not provided. Firebase services will be unavailable.',
  );
}

const app = express();
const PORT = process.env.PORT || 3000;

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
// Rate Limiting
// ============================================================
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});
app.use(globalLimiter);

// Stricter rate limit for auth-related endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many authentication attempts, please try again later.' },
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
// Health Check
// ============================================================
app.get('/health', async (_req, res) => {
  const checks: Record<string, { status: string; message?: string }> = {};

  // Check database connectivity
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'healthy' };
  } catch (err) {
    checks.database = { status: 'unhealthy', message: (err as Error).message };
  }

  const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');

  res.status(allHealthy ? 200 : 503).json({
    success: allHealthy,
    data: {
      status: allHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
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
app.use('/api/v1/auth', createAuthController(prisma));
console.log('[Server] Epic 1: Auth & Onboarding routes registered');

// ============================================================
// API Routes (v1) — all require authentication
// ============================================================
const services = createServiceContainer(prisma);
app.use('/api/v1', createApiRouter(services, prisma));

// ============================================================
// Epic 13: NRI Services, POA & Court Tracking Routes
// All Epic 13 routes require authentication
// ============================================================
const epic13Router = express.Router();
epic13Router.use(authenticate);
const boss = new PgBoss(process.env.DATABASE_URL!);
boss.start().then(() => {
  registerEpic13Routes(epic13Router, prisma, boss);
  app.use(epic13Router);
  console.log('[Server] Epic 13: NRI Services, POA & Court Tracking routes registered');
}).catch((err: unknown) => {
  console.error('[Server] Failed to start PgBoss for Epic 13:', err);
});

// ============================================================
// Feature Usage Tracking Middleware (Story 14-12)
// Tracks API endpoint usage for analytics
// ============================================================
app.use((req, _res, next) => {
  if (req.path.startsWith('/api/v1') && req.user) {
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
// Global Error Handler
// ============================================================
app.use(errorHandler);

// ============================================================
// Start Server
// ============================================================
let server: ReturnType<typeof app.listen> | undefined;

if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`[Server] Property Legal Agent API running on port ${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`[Server] Epic 14: Franchise Management, City Expansion & Analytics`);
  });
}

// ============================================================
// Graceful Shutdown
// ============================================================
async function gracefulShutdown(signal: string) {
  console.log(`[Server] ${signal} received. Starting graceful shutdown...`);

  // Force exit after 10 seconds
  const forceExitTimeout = setTimeout(() => {
    console.error('[Server] Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, 10_000);
  forceExitTimeout.unref();

  try {
    // Close HTTP server (stop accepting new connections)
    if (server) {
      await new Promise<void>((resolve, reject) => {
        server!.close((err) => (err ? reject(err) : resolve()));
      });
      console.log('[Server] HTTP server closed.');
    }

    // Close PgBoss
    try {
      await boss.stop();
      console.log('[Server] PgBoss stopped.');
    } catch {
      // PgBoss may not have started
    }

    // Close Prisma connection
    await prisma.$disconnect();
    console.log('[Server] Prisma disconnected.');

    process.exit(0);
  } catch (err) {
    console.error('[Server] Error during graceful shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app, server, services };
