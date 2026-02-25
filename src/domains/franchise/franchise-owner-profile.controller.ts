/**
 * Franchise Owner Profile Controller
 * Route: GET /franchise-owners/me — returns authenticated franchise owner's profile
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { authorize } from '../../middleware/authorize';

export function createFranchiseOwnerProfileController(prisma: PrismaClient): Router {
  const router = Router();

  /**
   * GET /
   * Mounted at /franchise-owners/me
   * Returns the authenticated franchise owner's profile.
   * Includes cityName (from City table) and joinedAt (from createdAt).
   * In dev mode (DEV_AUTH_BYPASS=true), auto-creates the user if not found.
   */
  router.get(
    '/',
    authorize('franchise_owner'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = req.user!.id;

        let user = await prisma.user.findUnique({
          where: { firebaseUid: userId },
          select: {
            id: true,
            firebaseUid: true,
            phone: true,
            displayName: true,
            email: true,
            roles: true,
            primaryRole: true,
            cityId: true,
            status: true,
            languagePref: true,
            createdAt: true,
          },
        });

        if (!user && process.env.DEV_AUTH_BYPASS === 'true') {
          user = await prisma.user.create({
            data: {
              firebaseUid: userId,
              phone: `DEV${userId.substring(0, 8)}`,
              displayName: userId.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
              roles: ['franchise_owner'],
              primaryRole: 'franchise_owner',
              status: 'ACTIVE',
              languagePref: 'en',
              lastLoginAt: new Date(),
            },
          });
        }

        if (!user) {
          res.status(404).json({
            success: false,
            error: {
              code: 'NOT_FOUND',
              message: 'Franchise owner profile not found',
            },
          });
          return;
        }

        // Resolve city name and franchise ID when cityId is present
        let cityName = '';
        let franchiseId = '';
        if (user.cityId) {
          const city = await prisma.city.findUnique({
            where: { id: user.cityId },
            select: { cityName: true },
          });
          cityName = city?.cityName ?? '';

          // Look up the franchise record for this city (needed for revenue queries)
          const franchise = await prisma.franchise.findUnique({
            where: { cityId: user.cityId },
            select: { id: true },
          });
          franchiseId = franchise?.id ?? '';
        }

        res.json({
          success: true,
          data: {
            id: user.id,
            firebaseUid: user.firebaseUid,
            phone: user.phone,
            name: user.displayName ?? 'Franchise Owner',
            email: user.email,
            roles: user.roles,
            primaryRole: user.primaryRole,
            cityId: user.cityId ?? '',
            cityName,
            franchiseId,
            status: user.status,
            preferredLanguage: user.languagePref,
            joinedAt: user.createdAt.toISOString(),
          },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
