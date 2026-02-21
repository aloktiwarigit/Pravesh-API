/**
 * Integration tests for server-level endpoints:
 * - GET /health
 * - GET /metrics
 * - Error handler integration
 * - 404 handling
 * - Request body size limit
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestApp } from '../helpers/test-app';
import { Request, Response, NextFunction } from 'express';
import { BusinessError } from '../../shared/errors/business-error';
import { ZodError, z } from 'zod';

describe('[P0] Server Endpoints', () => {
  // -----------------------------------------------------------------------
  // Build a minimal app that mirrors health/metrics from server.ts
  // -----------------------------------------------------------------------
  function buildServerApp(options?: { dbHealthy?: boolean }) {
    const dbHealthy = options?.dbHealthy ?? true;

    return createTestApp({
      routes(app) {
        // Health check
        app.get('/health', async (_req: Request, res: Response) => {
          const checks: Record<string, { status: string; message?: string }> = {};

          if (dbHealthy) {
            checks.database = { status: 'healthy' };
          } else {
            checks.database = { status: 'unhealthy', message: 'Connection refused' };
          }

          const allHealthy = Object.values(checks).every((c) => c.status === 'healthy');

          res.status(allHealthy ? 200 : 503).json({
            success: allHealthy,
            data: {
              status: allHealthy ? 'healthy' : 'unhealthy',
              timestamp: new Date().toISOString(),
              version: '1.0.0',
              checks,
            },
          });
        });

        // Metrics endpoint
        app.get('/metrics', (_req: Request, res: Response) => {
          res.json({
            success: true,
            data: {
              requests: 0,
              errors: 0,
              avgResponseTime: 0,
            },
          });
        });

        // Test route that throws BusinessError
        app.get('/test/business-error', (_req: Request, _res: Response, next: NextFunction) => {
          next(new BusinessError('TEST_ERROR', 'Test business error', 422));
        });

        // Test route that throws ZodError
        app.get('/test/zod-error', (_req: Request, _res: Response, next: NextFunction) => {
          const schema = z.object({ name: z.string().min(1) });
          try {
            schema.parse({});
          } catch (e) {
            next(e);
          }
        });

        // Test route that throws generic error
        app.get('/test/generic-error', (_req: Request, _res: Response, next: NextFunction) => {
          next(new Error('Something went wrong'));
        });

        // Test route for body parsing
        app.post('/test/body', (req: Request, res: Response) => {
          res.json({ success: true, data: req.body });
        });
      },
    });
  }

  // -----------------------------------------------------------------------
  // GET /health
  // -----------------------------------------------------------------------
  describe('GET /health', () => {
    it('returns 200 with healthy status when all checks pass', async () => {
      const { request } = buildServerApp({ dbHealthy: true });

      const res = await request.get('/health');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
      expect(res.body.data.checks.database.status).toBe('healthy');
    });

    it('returns 503 when database is unhealthy', async () => {
      const { request } = buildServerApp({ dbHealthy: false });

      const res = await request.get('/health');

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.data.status).toBe('unhealthy');
      expect(res.body.data.checks.database.status).toBe('unhealthy');
    });

    it('includes timestamp in response', async () => {
      const { request } = buildServerApp();

      const res = await request.get('/health');

      expect(res.body.data.timestamp).toBeDefined();
      expect(new Date(res.body.data.timestamp).toISOString()).toBe(
        res.body.data.timestamp,
      );
    });

    it('includes version in response', async () => {
      const { request } = buildServerApp();

      const res = await request.get('/health');

      expect(res.body.data.version).toBeDefined();
      expect(typeof res.body.data.version).toBe('string');
    });

    it('returns proper Content-Type: application/json', async () => {
      const { request } = buildServerApp();

      const res = await request.get('/health');

      expect(res.headers['content-type']).toMatch(/application\/json/);
    });
  });

  // -----------------------------------------------------------------------
  // GET /metrics
  // -----------------------------------------------------------------------
  describe('GET /metrics', () => {
    it('returns 200 with metrics data', async () => {
      const { request } = buildServerApp();

      const res = await request.get('/metrics');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it('does not require authentication', async () => {
      const { request } = buildServerApp();

      const res = await request.get('/metrics');

      expect(res.status).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // Error handler integration
  // -----------------------------------------------------------------------
  describe('Error Handler Integration', () => {
    it('handles BusinessError correctly via next()', async () => {
      const { request } = buildServerApp();

      const res = await request.get('/test/business-error');

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('TEST_ERROR');
      expect(res.body.error.message).toBe('Test business error');
    });

    it('handles ZodError correctly via next()', async () => {
      const { request } = buildServerApp();

      const res = await request.get('/test/zod-error');

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_INVALID_INPUT');
    });

    it('handles generic Error with 500', async () => {
      const { request } = buildServerApp();

      const res = await request.get('/test/generic-error');

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SYSTEM_INTERNAL_ERROR');
    });

    it('does not expose internal error message for generic errors', async () => {
      const { request } = buildServerApp();

      const res = await request.get('/test/generic-error');

      expect(res.body.error.message).toBe('An unexpected error occurred');
      expect(res.body.error.message).not.toContain('Something went wrong');
    });
  });

  // -----------------------------------------------------------------------
  // JSON body parsing
  // -----------------------------------------------------------------------
  describe('Body Parsing', () => {
    it('parses JSON request body correctly', async () => {
      const { request } = buildServerApp();

      const body = { name: 'Test', value: 42, nested: { key: 'val' } };
      const res = await request
        .post('/test/body')
        .set('Content-Type', 'application/json')
        .send(body);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual(body);
    });

    it('handles empty request body', async () => {
      const { request } = buildServerApp();

      const res = await request
        .post('/test/body')
        .set('Content-Type', 'application/json')
        .send({});

      expect(res.status).toBe(200);
    });
  });

  // -----------------------------------------------------------------------
  // Security headers (helmet)
  // -----------------------------------------------------------------------
  describe('Security Headers', () => {
    it('sets X-Content-Type-Options header', async () => {
      const { request } = buildServerApp();

      const res = await request.get('/health');

      expect(res.headers['x-content-type-options']).toBe('nosniff');
    });

    it('sets X-Frame-Options header', async () => {
      const { request } = buildServerApp();

      const res = await request.get('/health');

      expect(res.headers['x-frame-options']).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // Response format consistency
  // -----------------------------------------------------------------------
  describe('Response Format Consistency', () => {
    it('all successful responses have { success: true, data } shape', async () => {
      const { request } = buildServerApp();

      const res = await request.get('/health');

      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('data');
    });

    it('all error responses have { success: false, error } shape', async () => {
      const { request } = buildServerApp();

      const res = await request.get('/test/business-error');

      expect(res.body).toHaveProperty('success', false);
      expect(res.body).toHaveProperty('error');
      expect(res.body.error).toHaveProperty('code');
      expect(res.body.error).toHaveProperty('message');
    });
  });
});
