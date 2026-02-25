/**
 * Customer-facing notification endpoints
 * Routes: /notifications/*
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authorize } from '../../middleware/authorize.js';
import { NotificationDeliveryService } from './notification-delivery.service.js';

export function createNotificationController(prisma: PrismaClient): Router {
  const router = Router();
  const deliveryService = new NotificationDeliveryService(prisma);

  /**
   * GET /history
   * Query NotificationLog by userId with cursor pagination.
   */
  router.get('/history', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user!;
      const limit = parseInt(req.query.limit as string) || 20;
      const channel = req.query.channel as string | undefined;
      const serviceInstanceId = req.query.serviceInstanceId as string | undefined;
      const cursor = req.query.cursor as string | undefined;

      const where: any = { userId: user.id };
      if (channel) where.channel = channel;
      if (serviceInstanceId) where.serviceInstanceId = serviceInstanceId;

      const queryOptions: any = {
        where,
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
      };

      if (cursor) {
        queryOptions.cursor = { id: cursor };
        queryOptions.skip = 1;
      }

      const notifications = await prisma.notificationLog.findMany(queryOptions);

      const hasMore = notifications.length > limit;
      const data = hasMore ? notifications.slice(0, limit) : notifications;
      const nextCursor = hasMore ? data[data.length - 1].id : null;

      res.json({
        success: true,
        data,
        meta: { nextCursor, hasMore },
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /:id/read
   * Mark a single notification as read.
   */
  router.put('/:id/read', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user!;
      const { id } = req.params;

      const notification = await prisma.notificationLog.findUnique({ where: { id } });

      if (!notification) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Notification not found' },
        });
        return;
      }

      if (notification.userId !== user.id) {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Not authorized' },
        });
        return;
      }

      const updated = await prisma.notificationLog.update({
        where: { id },
        data: { readAt: new Date() },
        select: { id: true, readAt: true },
      });

      res.json({ success: true, data: updated });
    } catch (error) {
      next(error);
    }
  });

  /**
   * PUT /read-all
   * Mark all unread notifications as read.
   */
  router.put('/read-all', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user!;

      const result = await prisma.notificationLog.updateMany({
        where: { userId: user.id, readAt: null },
        data: { readAt: new Date() },
      });

      res.json({ success: true, data: { updatedCount: result.count } });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /unread-count
   * Count unread notifications.
   */
  router.get('/unread-count', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user!;

      const count = await prisma.notificationLog.count({
        where: { userId: user.id, readAt: null },
      });

      res.json({ success: true, data: { count } });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /send
   * Trigger notification delivery for a given user (ops/admin only).
   * FR109: Orchestrates FCM → WhatsApp → SMS fallback chain.
   *
   * Body:
   *   userId       — target user's internal ID (required)
   *   templateName — notification template code (required)
   *   channel      — preferred starting channel: 'push' | 'whatsapp' | 'sms' (optional, default 'push')
   *   data         — key/value context data; include _phone for WhatsApp/SMS (optional)
   *
   * Example:
   *   POST /api/v1/notifications/send
   *   { "userId": "abc123", "templateName": "service_status_change_wa_en_v1",
   *     "channel": "whatsapp", "data": { "_phone": "+919876543210", "service_name": "Title Search" } }
   */
  router.post(
    '/send',
    authorize('admin', 'ops'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { userId, templateName, channel, data } = req.body as {
          userId?: string;
          templateName?: string;
          channel?: 'push' | 'whatsapp' | 'sms';
          data?: Record<string, string>;
        };

        const params = {
          userId: userId ?? '',
          templateName: templateName ?? '',
          channel,
          data: data ?? {},
        };

        deliveryService.validateParams(params);

        const result = await deliveryService.deliverNotification(params);

        const httpStatus = result.finalStatus === 'delivered' ? 200 : 422;

        res.status(httpStatus).json({
          success: result.finalStatus === 'delivered',
          data: result,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
