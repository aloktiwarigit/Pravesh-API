/**
 * Franchise Territory Controller - HTTP endpoints for territory management
 *
 * Story 8.X: Franchise Territory Management
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { TerritoryService } from './territory.service';
import { authorize } from '../../middleware/authorize';

const assignTerritorySchema = z.object({
  cityId: z.string().uuid(),
  isExclusive: z.boolean().optional(),
  revenueShareBps: z.number().int().min(0).max(10000).optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional(),
});

const updateTerritorySchema = z.object({
  isExclusive: z.boolean().optional(),
  revenueShareBps: z.number().int().min(0).max(10000).optional(),
  endDate: z.coerce.date().optional(),
});

export function createTerritoryController(prisma: PrismaClient): Router {
  const router = Router();
  const territoryService = new TerritoryService(prisma);

  /**
   * POST /api/v1/franchise/:franchiseId/territories
   * Assign a territory to a franchise.
   * Roles: super_admin
   */
  router.post(
    '/:franchiseId/territories',
    authorize('super_admin'),
    async (req, res, next) => {
      try {
        const { franchiseId } = req.params;
        const input = assignTerritorySchema.parse(req.body);
        const user = (req as any).user!;

        const territory = await territoryService.assignTerritory({
          franchiseId,
          cityId: input.cityId,
          isExclusive: input.isExclusive,
          revenueShareBps: input.revenueShareBps,
          startDate: input.startDate,
          endDate: input.endDate,
          createdBy: user.id,
        });

        res.status(201).json({ success: true, data: territory });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/franchise/:franchiseId/territories
   * Get all territories for a franchise.
   * Roles: super_admin, franchise
   */
  router.get(
    '/:franchiseId/territories',
    authorize('super_admin', 'franchise'),
    async (req, res, next) => {
      try {
        const { franchiseId } = req.params;
        const user = (req as any).user!;

        // Franchise owners can only see their own territories
        if (user.role === 'franchise') {
          const franchise = await prisma.franchise.findFirst({
            where: { ownerUserId: user.id },
          });

          if (!franchise || franchise.id !== franchiseId) {
            return res.status(403).json({
              success: false,
              error: { code: 'FORBIDDEN', message: 'Not your franchise' },
            });
          }
        }

        const territories = await territoryService.getFranchiseTerritories(franchiseId);

        res.json({ success: true, data: territories });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * PATCH /api/v1/franchise/territories/:territoryId
   * Update a territory's configuration.
   * Roles: super_admin
   */
  router.patch(
    '/territories/:territoryId',
    authorize('super_admin'),
    async (req, res, next) => {
      try {
        const { territoryId } = req.params;
        const input = updateTerritorySchema.parse(req.body);

        const territory = await territoryService.updateTerritory(territoryId, input);

        res.json({ success: true, data: territory });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * DELETE /api/v1/franchise/territories/:territoryId
   * Remove a territory from a franchise.
   * Roles: super_admin
   */
  router.delete(
    '/territories/:territoryId',
    authorize('super_admin'),
    async (req, res, next) => {
      try {
        const { territoryId } = req.params;

        await territoryService.removeTerritory(territoryId);

        res.json({ success: true, data: { deleted: true } });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/franchise/:franchiseId/revenue
   * Get revenue history for a franchise.
   * Roles: super_admin, franchise
   */
  router.get(
    '/:franchiseId/revenue',
    authorize('super_admin', 'franchise'),
    async (req, res, next) => {
      try {
        const { franchiseId } = req.params;
        const year = req.query.year ? parseInt(req.query.year as string) : undefined;
        const limit = req.query.limit ? parseInt(req.query.limit as string) : 12;
        const user = (req as any).user!;

        // Franchise owners can only see their own revenue
        if (user.role === 'franchise') {
          const franchise = await prisma.franchise.findFirst({
            where: { ownerUserId: user.id },
          });

          if (!franchise || franchise.id !== franchiseId) {
            return res.status(403).json({
              success: false,
              error: { code: 'FORBIDDEN', message: 'Not your franchise' },
            });
          }
        }

        const revenueHistory = await territoryService.getRevenueHistory(franchiseId, {
          year,
          limit,
        });

        res.json({ success: true, data: revenueHistory });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/franchise/:franchiseId/revenue/calculate
   * Calculate and record monthly revenue share.
   * Roles: super_admin
   */
  router.post(
    '/:franchiseId/revenue/calculate',
    authorize('super_admin'),
    async (req, res, next) => {
      try {
        const { franchiseId } = req.params;
        const { cityId, month, year } = z.object({
          cityId: z.string().uuid(),
          month: z.number().int().min(1).max(12),
          year: z.number().int().min(2020).max(2100),
        }).parse(req.body);

        const revenue = await territoryService.recordMonthlyRevenue(
          franchiseId,
          cityId,
          month,
          year,
        );

        res.json({
          success: true,
          data: {
            ...revenue,
            serviceFeePaise: revenue.serviceFeePaise.toString(),
            franchiseSharePaise: revenue.franchiseSharePaise.toString(),
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/cities/:cityId/franchise
   * Get the franchise responsible for a city.
   * Roles: any authenticated
   */
  router.get(
    '/cities/:cityId/franchise',
    async (req, res, next) => {
      try {
        const { cityId } = req.params;

        const franchise = await territoryService.getFranchiseForCity(cityId);

        res.json({ success: true, data: franchise });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
