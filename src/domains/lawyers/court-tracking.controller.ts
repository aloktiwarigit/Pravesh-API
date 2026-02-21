/**
 * Court Tracking Controller - HTTP endpoints for court hearing management
 *
 * Story 4.1X: Court Hearing Tracking
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { CourtTrackingService } from './court-tracking.service';
import { authorize } from '../../middleware/authorize';

const scheduleHearingSchema = z.object({
  serviceRequestId: z.string().uuid(),
  caseNumber: z.string().min(1).max(100),
  courtName: z.string().min(1).max(200),
  courtAddress: z.string().max(500).optional(),
  hearingDate: z.coerce.date(),
  hearingType: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
  cityId: z.string().uuid(),
});

const recordAppearanceSchema = z.object({
  outcome: z.string().min(1).max(2000),
  nextHearingDate: z.coerce.date().optional(),
  notes: z.string().max(2000).optional(),
});

const adjournHearingSchema = z.object({
  reason: z.string().min(1).max(500),
  newDate: z.coerce.date().optional(),
});

const cancelHearingSchema = z.object({
  reason: z.string().min(1).max(500),
});

/**
 * Valid hearing status values (plain strings, not a Prisma enum).
 */
const hearingStatusValues = ['scheduled', 'completed', 'adjourned', 'cancelled'] as const;

const listHearingsSchema = z.object({
  status: z.enum(hearingStatusValues).optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export function createCourtTrackingController(prisma: PrismaClient): Router {
  const router = Router();
  const courtService = new CourtTrackingService(prisma);

  /**
   * POST /api/v1/hearings
   * Schedule a new hearing.
   * Roles: lawyer, ops_manager
   */
  router.post(
    '/',
    authorize('lawyer', 'ops_manager'),
    async (req, res, next) => {
      try {
        const input = scheduleHearingSchema.parse(req.body);
        const user = (req as any).user!;

        const hearing = await courtService.scheduleHearing({
          serviceRequestId: input.serviceRequestId,
          caseNumber: input.caseNumber,
          courtName: input.courtName,
          courtAddress: input.courtAddress,
          hearingDate: input.hearingDate,
          hearingType: input.hearingType,
          notes: input.notes,
          createdByUserId: user.id,
          cityId: input.cityId,
        });

        res.status(201).json({ success: true, data: hearing });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/hearings
   * List hearings with filters.
   * Roles: lawyer, ops_manager, customer
   */
  router.get(
    '/',
    authorize('lawyer', 'ops_manager', 'customer'),
    async (req, res, next) => {
      try {
        const filters = listHearingsSchema.parse(req.query);
        const serviceRequestId = req.query.serviceRequestId as string | undefined;

        const result = await courtService.listHearings({
          serviceRequestId,
          status: filters.status,
          fromDate: filters.fromDate,
          toDate: filters.toDate,
          limit: filters.limit,
          offset: filters.offset,
        });

        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/hearings/upcoming
   * Get upcoming hearings for the current lawyer's city.
   * Roles: lawyer
   */
  router.get(
    '/upcoming',
    authorize('lawyer'),
    async (req, res, next) => {
      try {
        const user = (req as any).user!;
        const days = parseInt(req.query.days as string) || 7;

        const lawyer = await prisma.lawyer.findFirst({
          where: { userId: user.id },
          select: { id: true, cityId: true },
        });

        if (!lawyer) {
          return res.status(404).json({
            success: false,
            error: { code: 'LAWYER_NOT_FOUND', message: 'Lawyer profile not found' },
          });
        }

        const result = await courtService.getUpcomingHearings(lawyer.cityId, days);

        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/hearings/stats
   * Get hearing statistics for the current lawyer's city.
   * Roles: lawyer
   */
  router.get(
    '/stats',
    authorize('lawyer'),
    async (req, res, next) => {
      try {
        const user = (req as any).user!;

        const lawyer = await prisma.lawyer.findFirst({
          where: { userId: user.id },
          select: { id: true, cityId: true },
        });

        if (!lawyer) {
          return res.status(404).json({
            success: false,
            error: { code: 'LAWYER_NOT_FOUND', message: 'Lawyer profile not found' },
          });
        }

        const stats = await courtService.getHearingStats(lawyer.cityId);

        res.json({ success: true, data: stats });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/hearings/:id
   * Get hearing details.
   * Roles: lawyer, ops_manager
   */
  router.get(
    '/:id',
    authorize('lawyer', 'ops_manager'),
    async (req, res, next) => {
      try {
        const { id } = req.params;

        const hearing = await courtService.getHearing(id);

        res.json({ success: true, data: hearing });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * PATCH /api/v1/hearings/:id
   * Update hearing details.
   * Roles: lawyer, ops_manager
   */
  router.patch(
    '/:id',
    authorize('lawyer', 'ops_manager'),
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const input = scheduleHearingSchema.partial().parse(req.body);

        const hearing = await prisma.courtHearing.update({
          where: { id },
          data: {
            ...(input.courtName && { courtName: input.courtName }),
            ...(input.courtAddress !== undefined && { courtAddress: input.courtAddress }),
            ...(input.hearingDate && { hearingDate: input.hearingDate }),
            ...(input.hearingType && { hearingType: input.hearingType }),
            ...(input.notes !== undefined && { notes: input.notes }),
          },
        });

        res.json({ success: true, data: hearing });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/hearings/:id/appearance
   * Record the outcome of a court appearance.
   * Roles: lawyer
   */
  router.post(
    '/:id/appearance',
    authorize('lawyer'),
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const input = recordAppearanceSchema.parse(req.body);
        const user = (req as any).user!;

        const hearing = await courtService.recordAppearance({
          hearingId: id,
          outcome: input.outcome,
          nextHearingDate: input.nextHearingDate,
          notes: input.notes,
          createdByUserId: user.id,
        });

        res.json({ success: true, data: hearing });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/hearings/:id/adjourn
   * Adjourn a scheduled hearing.
   * Roles: lawyer, ops_manager
   */
  router.post(
    '/:id/adjourn',
    authorize('lawyer', 'ops_manager'),
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const input = adjournHearingSchema.parse(req.body);
        const user = (req as any).user!;

        const hearing = await courtService.adjournHearing(
          id,
          input.reason,
          input.newDate,
          user.id,
        );

        res.json({ success: true, data: hearing });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/hearings/:id/cancel
   * Cancel a scheduled hearing.
   * Roles: lawyer, ops_manager
   */
  router.post(
    '/:id/cancel',
    authorize('lawyer', 'ops_manager'),
    async (req, res, next) => {
      try {
        const { id } = req.params;
        const input = cancelHearingSchema.parse(req.body);

        const hearing = await courtService.cancelHearing(id, input.reason);

        res.json({ success: true, data: hearing });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
