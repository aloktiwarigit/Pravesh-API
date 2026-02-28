/**
 * Notification management endpoints — device tokens, preferences, monitoring.
 * Routes: /notification-templates/*
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authorize } from '../../middleware/authorize';
import { NotificationPreferencesService } from './notification-preferences.service';
import { NotificationMetricsService } from './notification-metrics.service';
import { registerDeviceTokenSchema, updatePreferencesSchema } from './notifications.validation';

export function createNotificationTemplateController(prisma: PrismaClient): Router {
  const router = Router();
  const preferencesService = new NotificationPreferencesService(prisma);
  const metricsService = new NotificationMetricsService(prisma);

  /**
   * POST /device-token
   * Register or update FCM device token.
   */
  router.post('/device-token', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user!;
      const parsed = registerDeviceTokenSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: parsed.error.errors },
        });
        return;
      }

      const { token, platform } = parsed.data;

      const device = await prisma.userDevice.upsert({
        where: { token },
        update: { userId: user.id, platform },
        create: { userId: user.id, token, platform },
        select: { id: true },
      });

      res.json({ success: true, data: device });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /preferences
   * Get notification preferences for the current user.
   */
  router.get('/preferences', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user!;
      const prefs = await preferencesService.getPreferences(user.id);
      res.json({ success: true, data: prefs });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /preferences
   * Update notification preferences.
   */
  router.put('/preferences', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user!;
      const parsed = updatePreferencesSchema.safeParse(req.body);

      if (!parsed.success) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: parsed.error.errors },
        });
        return;
      }

      const updatedPrefs = await preferencesService.updatePreferences(user.id, parsed.data);
      res.json({ success: true, data: updatedPrefs });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /monitoring/metrics
   * Dashboard metrics for ops/admin.
   */
  router.get('/monitoring/metrics', authorize('super_admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const hours = parseInt(req.query.hours as string) || 24;
      const metrics = await metricsService.getDashboardMetrics(hours);
      res.json({ success: true, data: metrics });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /monitoring/failed
   * Recent failed notifications for ops/admin.
   */
  router.get('/monitoring/failed', authorize('super_admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const result = await metricsService.getRecentFailedNotifications(page, limit);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /monitoring/retry/:id
   * Retry a failed notification.
   */
  router.post('/monitoring/retry/:id', authorize('super_admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await metricsService.retryFailedNotification(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
