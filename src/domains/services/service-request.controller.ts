/**
 * Service Request Controller
 *
 * GET   /api/v1/service-requests           — List customer's service requests (paginated)
 * POST  /api/v1/service-requests           — Submit a new service request from Flutter app
 * PATCH /api/v1/service-requests/:id       — Edit property details on an existing request
 * POST  /api/v1/service-requests/:id/add-service — Add a service to an existing request
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { ServiceRequestSubmitService } from './service-request.service';
import { authorize } from '../../middleware/authorize';

const submitRequestSchema = z.object({
  serviceId: z.string().min(1),
  propertyType: z.string().min(1),
  propertyLocation: z.string().min(1),
  ownershipStatus: z.string().min(1),
  packageId: z.string().optional(),
  estimatedValuePaise: z.number().int().positive().optional(),
});

const editRequestSchema = z.object({
  propertyType: z.string().min(1).optional(),
  propertyAddress: z.string().min(1).optional(),
  ownershipStatus: z.string().min(1).optional(),
  estimatedValuePaise: z.number().int().positive().optional(),
});

const addServiceSchema = z.object({
  serviceId: z.string().min(1),
});

export function createServiceRequestController(prisma: PrismaClient): Router {
  const router = Router();
  const service = new ServiceRequestSubmitService(prisma);

  /**
   * GET /api/v1/service-requests
   * List customer's service requests (paginated).
   */
  router.get(
    '/',
    authorize('customer'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user!;
        const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
        const skip = (page - 1) * limit;

        const [requests, total] = await Promise.all([
          prisma.serviceRequest.findMany({
            where: { customerId: user.id },
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            include: {
              serviceInstance: {
                include: {
                  serviceDefinition: { select: { name: true, code: true, category: true } },
                },
              },
            },
          }),
          prisma.serviceRequest.count({ where: { customerId: user.id } }),
        ]);

        const data = requests.map((r) => ({
          id: r.id,
          serviceInstanceId: r.serviceInstanceId,
          requestNumber: r.requestNumber,
          serviceNameEn: r.serviceInstance?.serviceDefinition?.name ?? null,
          serviceNameHi: r.serviceInstance?.serviceDefinition?.name ?? null,
          packageNameEn: null,
          packageNameHi: null,
          serviceCode: r.serviceCode,
          status: r.status,
          paymentStatus: r.paymentStatus,
          propertyType: r.serviceInstance?.propertyType ?? null,
          propertyLocation: r.serviceInstance?.propertyAddress ?? null,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        }));

        const totalPages = Math.ceil(total / limit);

        res.json({
          success: true,
          data,
          meta: { page, limit, total, totalPages },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * GET /api/v1/service-requests/:id
   * Get single service request with tracking details.
   * Roles: customer
   */
  router.get(
    '/:id',
    authorize('customer'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user!;
        const requestId = req.params.id;

        const request = await prisma.serviceRequest.findFirst({
          where: { id: requestId, customerId: user.id },
          include: {
            serviceInstance: {
              include: {
                serviceDefinition: {
                  select: { id: true, code: true, name: true, category: true, definition: true },
                },
              },
            },
          },
        });

        if (!request) {
          res.status(404).json({
            success: false,
            error: { code: 'REQUEST_NOT_FOUND', message: 'Service request not found' },
          });
          return;
        }

        const instance = request.serviceInstance;
        const definition = instance?.serviceDefinition;
        const defJson = definition?.definition as any;

        // Fetch state history if service instance exists
        let history: any[] = [];
        if (instance) {
          history = await prisma.serviceStateHistory.findMany({
            where: { serviceInstanceId: instance.id },
            orderBy: { createdAt: 'desc' },
          });
        }

        res.json({
          success: true,
          data: {
            id: request.id,
            requestNumber: request.requestNumber,
            serviceCode: request.serviceCode,
            status: request.status,
            paymentStatus: request.paymentStatus,
            createdAt: request.createdAt.toISOString(),
            updatedAt: request.updatedAt.toISOString(),
            // Service instance tracking info (may be null for new requests)
            serviceInstance: instance ? {
              id: instance.id,
              state: instance.state,
              currentStepIndex: instance.currentStepIndex,
              propertyAddress: instance.propertyAddress,
              propertyType: instance.propertyType,
              slaDeadline: instance.slaDeadline?.toISOString() ?? null,
              createdAt: instance.createdAt.toISOString(),
            } : null,
            // Service definition info
            serviceDefinition: definition ? {
              id: definition.id,
              code: definition.code,
              name: definition.name,
              category: definition.category,
              definition: defJson,
            } : null,
            // State history
            history: history.map((h) => ({
              fromState: h.fromState,
              toState: h.toState,
              changedBy: h.changedBy,
              reason: h.reason,
              createdAt: h.createdAt.toISOString(),
            })),
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * PATCH /api/v1/service-requests/:id
   * Edit property details on an existing request (early-stage only).
   * Roles: customer
   */
  router.patch(
    '/:id',
    authorize('customer'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user!;
        const requestId = req.params.id;
        const updates = editRequestSchema.parse(req.body);

        // Verify ownership
        const request = await prisma.serviceRequest.findFirst({
          where: { id: requestId, customerId: user.id },
          include: { serviceInstance: true },
        });

        if (!request) {
          res.status(404).json({
            success: false,
            error: { code: 'REQUEST_NOT_FOUND', message: 'Service request not found' },
          });
          return;
        }

        // Only allow edits in early stages
        const editableStatuses = ['pending', 'assigned'];
        if (!editableStatuses.includes(request.status)) {
          res.status(409).json({
            success: false,
            error: {
              code: 'REQUEST_NOT_EDITABLE',
              message: `Cannot edit request in '${request.status}' status`,
            },
          });
          return;
        }

        if (!request.serviceInstance) {
          res.status(409).json({
            success: false,
            error: { code: 'NO_SERVICE_INSTANCE', message: 'No service instance linked to this request' },
          });
          return;
        }

        // Build update payload for ServiceInstance
        const instanceUpdate: Record<string, any> = {};
        if (updates.propertyType !== undefined) instanceUpdate.propertyType = updates.propertyType;
        if (updates.propertyAddress !== undefined) instanceUpdate.propertyAddress = updates.propertyAddress;
        if (updates.estimatedValuePaise !== undefined) {
          instanceUpdate.propertyValuePaise = BigInt(updates.estimatedValuePaise);
        }

        // ownershipStatus lives inside metadata JSON
        if (updates.ownershipStatus !== undefined) {
          const existingMeta = (request.serviceInstance.metadata as Record<string, any>) || {};
          instanceUpdate.metadata = { ...existingMeta, ownershipStatus: updates.ownershipStatus };
        }

        const updated = await prisma.serviceInstance.update({
          where: { id: request.serviceInstance.id },
          data: instanceUpdate,
        });

        res.json({
          success: true,
          data: {
            id: request.id,
            serviceInstanceId: updated.id,
            propertyType: updated.propertyType,
            propertyAddress: updated.propertyAddress,
            ownershipStatus: (updated.metadata as any)?.ownershipStatus ?? null,
          },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/service-requests
   * Submit a new service request.
   * Roles: customer
   */
  router.post(
    '/',
    authorize('customer'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = submitRequestSchema.parse(req.body);
        const user = (req as any).user!;

        const result = await service.submitRequest(input, user);

        res.status(201).json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  /**
   * POST /api/v1/service-requests/:id/add-service
   * Create a new ServiceInstance linked to an existing request.
   */
  router.post(
    '/:id/add-service',
    authorize('customer'),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const user = (req as any).user!;
        const { serviceId } = addServiceSchema.parse(req.body);
        const requestId = req.params.id;

        // Verify the original request belongs to the customer
        const existingRequest = await prisma.serviceRequest.findFirst({
          where: { id: requestId, customerId: user.id },
          include: { serviceInstance: true },
        });

        if (!existingRequest) {
          res.status(404).json({
            success: false,
            error: { code: 'REQUEST_NOT_FOUND', message: 'Service request not found' },
          });
          return;
        }

        // Use the submit service to create a new request linked to this
        const result = await service.submitRequest(
          {
            serviceId,
            propertyType: existingRequest.serviceInstance?.propertyType || 'residential',
            propertyLocation: existingRequest.serviceInstance?.propertyAddress || '',
            ownershipStatus: 'self',
          },
          user,
        );

        res.status(201).json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
