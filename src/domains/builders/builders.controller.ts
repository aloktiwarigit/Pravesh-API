// ============================================================
// Epic 11: Builder Portal & Bulk Services — Controller
// Request handling, validation, response formatting
// All endpoints return standard { success, data } wrapper
// ============================================================

import { Router, Request, Response, NextFunction } from 'express';
import { BuildersService } from './builders.service';
import {
  builderRegistrationSchema,
  builderApprovalSchema,
  projectCreateSchema,
  unitCreateSchema,
  unitUpdateSchema,
  bulkServiceRequestSchema,
  pricingOverrideSchema,
  customPricingRequestSchema,
  contractCreateSchema,
  contractAmendmentSchema,
  broadcastCreateSchema,
} from './builders.validation';
import { PrismaClient } from '@prisma/client';

export function createBuildersController(prisma: PrismaClient): Router {
  const router = Router();
  const service = new BuildersService(prisma);

  // ==========================================================
  // Story 11-1: Builder Registration & Project Setup
  // ==========================================================

  // POST /api/v1/builders/register
  router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = builderRegistrationSchema.parse(req.body);
      const userId = (req as any).user?.id || req.body.userId;
      const builder = await service.registerBuilder(userId, input);
      res.status(201).json({ success: true, data: builder });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/builders/:builderId/approve — Ops approve/reject
  router.post('/:builderId/approve', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = builderApprovalSchema.parse({
        ...req.body,
        builderId: req.params.builderId,
      });
      const result = await service.approveBuilder(input.builderId, input.action, input.notes);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/builders/pending — Ops: list pending verifications
  router.get('/pending', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const builders = await service.getPendingBuilders();
      res.json({ success: true, data: builders });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/builders/profile — Builder profile by auth
  router.get('/profile', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = (req as any).user?.id;
      const builder = await service.getBuilderByUserId(userId);
      res.json({ success: true, data: builder });
    } catch (error) {
      next(error);
    }
  });

  // ==========================================================
  // Story 11-1: Project CRUD
  // ==========================================================

  // POST /api/v1/builders/projects
  router.post('/projects', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = projectCreateSchema.parse(req.body);
      const builderId = (req as any).user?.builderId || req.body.builderId;
      const project = await service.createProject(builderId, input);
      res.status(201).json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/builders/projects
  router.get('/projects', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const builderId = (req as any).user?.builderId;
      const projects = await service.getProjects(builderId);
      res.json({ success: true, data: projects });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/builders/projects/:projectId
  router.get('/projects/:projectId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const builderId = (req as any).user?.builderId;
      const project = await service.getProjectById(req.params.projectId, builderId);
      res.json({ success: true, data: project });
    } catch (error) {
      next(error);
    }
  });

  // ==========================================================
  // Story 11-2: Buyer List Upload & Unit Management
  // ==========================================================

  // POST /api/v1/builders/projects/:projectId/units/upload — CSV upload
  router.post('/projects/:projectId/units/upload', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const builderId = (req as any).user?.builderId;
      // In production: use multer middleware. For now, accept CSV as text body.
      const csvString = req.body.csvData || '';
      const result = await service.uploadBuyerCsv(
        req.params.projectId,
        builderId,
        csvString
      );
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/builders/projects/:projectId/units — add single unit
  router.post('/projects/:projectId/units', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = unitCreateSchema.parse(req.body);
      const builderId = (req as any).user?.builderId;
      const unit = await service.addUnit(req.params.projectId, builderId, input);
      res.status(201).json({ success: true, data: unit });
    } catch (error) {
      next(error);
    }
  });

  // PUT /api/v1/builders/projects/:projectId/units/:unitId — edit unit
  router.put('/projects/:projectId/units/:unitId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = unitUpdateSchema.parse(req.body);
      const builderId = (req as any).user?.builderId;
      const unit = await service.updateUnit(req.params.unitId, builderId, input);
      res.json({ success: true, data: unit });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/builders/projects/:projectId/units — list units
  router.get('/projects/:projectId/units', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const builderId = (req as any).user?.builderId;
      const units = await service.getProjectUnits(req.params.projectId, builderId);
      res.json({ success: true, data: units });
    } catch (error) {
      next(error);
    }
  });

  // ==========================================================
  // Story 11-3: Bulk Service Selection
  // ==========================================================

  // POST /api/v1/builders/projects/:projectId/bulk-services
  router.post(
    '/projects/:projectId/bulk-services',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = bulkServiceRequestSchema.parse(req.body);
        const builderId = (req as any).user?.builderId;
        const result = await service.createBulkServiceRequest(
          builderId,
          req.params.projectId,
          input
        );
        res.status(201).json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/builders/projects/:projectId/bulk-services/preview
  router.post(
    '/projects/:projectId/bulk-services/preview',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { serviceIds, unitCount } = req.body;
        const pricing = await service.getBulkPricingPreview(serviceIds, unitCount);
        // Serialize BigInt to string
        const serialized = {
          ...pricing,
          perUnitServiceFeePaise: pricing.perUnitServiceFeePaise.toString(),
          perUnitGovtFeePaise: pricing.perUnitGovtFeePaise.toString(),
          totalServiceFeePaise: pricing.totalServiceFeePaise.toString(),
          totalGovtFeePaise: pricing.totalGovtFeePaise.toString(),
          discountAmountPaise: pricing.discountAmountPaise.toString(),
          finalServiceFeePaise: pricing.finalServiceFeePaise.toString(),
          grandTotalPaise: pricing.grandTotalPaise.toString(),
        };
        res.json({ success: true, data: serialized });
      } catch (error) {
        next(error);
      }
    }
  );

  // ==========================================================
  // Story 11-5: Project-Level Progress Dashboard
  // ==========================================================

  // GET /api/v1/builders/projects/:projectId/progress
  router.get('/projects/:projectId/progress', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const builderId = (req as any).user?.builderId;
      const data = await service.getProjectProgress(req.params.projectId, builderId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/builders/projects/:projectId/timeline
  router.get('/projects/:projectId/timeline', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const builderId = (req as any).user?.builderId;
      const data = await service.getProjectTimeline(req.params.projectId, builderId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  });

  // ==========================================================
  // Story 11-6: Pricing Tiers
  // ==========================================================

  // GET /api/v1/builders/projects/:projectId/pricing-tier
  router.get(
    '/projects/:projectId/pricing-tier',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const builderId = (req as any).user?.builderId;
        const tier = await service.ensurePricingTier(req.params.projectId, builderId);
        res.json({ success: true, data: tier });
      } catch (error) {
        next(error);
      }
    }
  );

  // PUT /api/v1/builders/pricing-tiers/:tierId — Ops override
  router.put('/pricing-tiers/:tierId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = pricingOverrideSchema.parse(req.body);
      const opsUserId = (req as any).user?.id;
      const tier = await service.overridePricingTier(
        req.params.tierId,
        opsUserId,
        input.discountPct,
        input.notes
      );
      res.json({ success: true, data: tier });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/builders/pricing-tiers/:tierId/request-custom
  router.post(
    '/pricing-tiers/:tierId/request-custom',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = customPricingRequestSchema.parse(req.body);
        const tier = await service.requestCustomPricing(
          req.params.tierId,
          input.requestedPct,
          input.notes
        );
        res.json({ success: true, data: tier });
      } catch (error) {
        next(error);
      }
    }
  );

  // ==========================================================
  // Story 11-7: Unit-Level Payment Tracking
  // ==========================================================

  // GET /api/v1/builders/projects/:projectId/payments
  router.get('/projects/:projectId/payments', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const builderId = (req as any).user?.builderId;
      const data = await service.getProjectPaymentSummary(
        req.params.projectId,
        builderId
      );
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/builders/units/:unitId/payments
  router.get('/units/:unitId/payments', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const builderId = (req as any).user?.builderId;
      const data = await service.getUnitPaymentDetail(req.params.unitId, builderId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/builders/units/:unitId/payment-reminder
  router.post('/units/:unitId/payment-reminder', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const builderId = (req as any).user?.builderId;
      const result = await service.sendPaymentReminder(req.params.unitId, builderId);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  });

  // ==========================================================
  // Story 11-8: Contract Management
  // ==========================================================

  // POST /api/v1/builders/contracts
  router.post('/contracts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = contractCreateSchema.parse(req.body);
      const builderId = (req as any).user?.builderId;
      const contract = await service.createContract(builderId, input);
      res.status(201).json({
        success: true,
        data: { ...contract, totalValuePaise: contract.totalValuePaise.toString() },
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/builders/contracts
  router.get('/contracts', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const builderId = (req as any).user?.builderId;
      const contracts = await service.getContracts(builderId);
      res.json({
        success: true,
        data: contracts.map((c) => ({
          ...c,
          totalValuePaise: c.totalValuePaise.toString(),
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/builders/contracts/:contractId
  router.get('/contracts/:contractId', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const builderId = (req as any).user?.builderId;
      const data = await service.getContractDetail(req.params.contractId, builderId);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/builders/contracts/:contractId/submit
  router.post('/contracts/:contractId/submit', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const builderId = (req as any).user?.builderId;
      const result = await service.submitContractForApproval(
        req.params.contractId,
        builderId
      );
      res.json({
        success: true,
        data: { ...result, totalValuePaise: result.totalValuePaise.toString() },
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/builders/contracts/:contractId/approve — Ops
  router.post('/contracts/:contractId/approve', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const opsUserId = (req as any).user?.id;
      const result = await service.approveContract(req.params.contractId, opsUserId);
      res.json({
        success: true,
        data: { ...result, totalValuePaise: result.totalValuePaise.toString() },
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/builders/contracts/:contractId/amend
  router.post('/contracts/:contractId/amend', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = contractAmendmentSchema.parse(req.body);
      const builderId = (req as any).user?.builderId;
      const result = await service.requestAmendment(
        req.params.contractId,
        builderId,
        input.amendmentNotes
      );
      res.json({
        success: true,
        data: { ...result, totalValuePaise: result.totalValuePaise.toString() },
      });
    } catch (error) {
      next(error);
    }
  });

  // POST /api/v1/builders/contracts/:contractId/cancel-renewal
  router.post(
    '/contracts/:contractId/cancel-renewal',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const builderId = (req as any).user?.builderId;
        const result = await service.cancelAutoRenewal(
          req.params.contractId,
          builderId
        );
        res.json({
          success: true,
          data: { ...result, totalValuePaise: result.totalValuePaise.toString() },
        });
      } catch (error) {
        next(error);
      }
    }
  );

  // ==========================================================
  // Story 11-9: Communication
  // ==========================================================

  // POST /api/v1/builders/projects/:projectId/broadcasts
  router.post(
    '/projects/:projectId/broadcasts',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const input = broadcastCreateSchema.parse(req.body);
        const builderId = (req as any).user?.builderId;
        const broadcast = await service.createBroadcast(
          builderId,
          req.params.projectId,
          input
        );
        res.status(201).json({ success: true, data: broadcast });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/builders/projects/:projectId/broadcasts
  router.get(
    '/projects/:projectId/broadcasts',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const builderId = (req as any).user?.builderId;
        const broadcasts = await service.getBroadcasts(
          builderId,
          req.params.projectId
        );
        res.json({ success: true, data: broadcasts });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/builders/broadcasts/:broadcastId/approve — Ops
  router.post(
    '/broadcasts/:broadcastId/approve',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const opsUserId = (req as any).user?.id;
        const result = await service.approveBroadcast(
          req.params.broadcastId,
          opsUserId
        );
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /api/v1/builders/broadcasts/:broadcastId/reject — Ops
  router.post(
    '/broadcasts/:broadcastId/reject',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const opsUserId = (req as any).user?.id;
        const result = await service.rejectBroadcast(
          req.params.broadcastId,
          opsUserId
        );
        res.json({ success: true, data: result });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/builders/broadcasts/:broadcastId/status
  router.get(
    '/broadcasts/:broadcastId/status',
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const data = await service.getBroadcastDeliveryStatus(
          req.params.broadcastId
        );
        res.json({ success: true, data });
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /api/v1/builders/projects/:projectId/inbox
  router.get('/projects/:projectId/inbox', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const builderId = (req as any).user?.builderId;
      const messages = await service.getInboxMessages(
        builderId,
        req.params.projectId
      );
      res.json({ success: true, data: messages });
    } catch (error) {
      next(error);
    }
  });

  // PUT /api/v1/builders/inbox/:messageId/read
  router.put('/inbox/:messageId/read', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const builderId = (req as any).user?.builderId;
      const message = await service.markInboxMessageRead(
        req.params.messageId,
        builderId
      );
      res.json({ success: true, data: message });
    } catch (error) {
      next(error);
    }
  });

  // GET /api/v1/builders/inbox/unread-count
  router.get('/inbox/unread-count', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const builderId = (req as any).user?.builderId;
      const count = await service.getUnreadInboxCount(builderId);
      res.json({ success: true, data: { unreadCount: count } });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
