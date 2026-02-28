/**
 * Campaign management endpoints
 * Routes: /campaigns/*
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authorize } from '../../middleware/authorize';

export function createCampaignController(prisma: PrismaClient): Router {
  const router = Router();

  /**
   * GET /
   * List campaigns.
   */
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const campaigns = await prisma.campaign.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
      });

      res.json({ success: true, data: campaigns });
    } catch (error) {
      next(error);
    }
  });

  /**
   * GET /:id
   * Campaign detail.
   */
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: req.params.id },
      });

      if (!campaign) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Campaign not found' },
        });
        return;
      }

      res.json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  });

  /**
   * POST /
   * Create a campaign. Admin/ops only.
   */
  router.post('/', authorize('super_admin'), async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as any).user!;
      const { name, templateCode, audienceFilter, parameters, scheduledAt } = req.body;

      if (!name || !templateCode) {
        res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Missing required fields: name, templateCode' },
        });
        return;
      }

      const campaign = await prisma.campaign.create({
        data: {
          name,
          templateCode,
          audienceFilter: audienceFilter || {},
          parameters: parameters || {},
          scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
          createdBy: user.id,
          cityId: user.cityId || 'default',
        },
      });

      res.status(201).json({ success: true, data: campaign });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
