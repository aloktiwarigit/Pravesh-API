import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

// Franchise domain services
import { CityService } from '../domains/franchise/city.service';
import { CityServiceFeeService } from '../domains/franchise/city-service-fee.service';
import { CityProcessOverrideService } from '../domains/franchise/city-process-override.service';
import { CityDocumentRequirementService } from '../domains/franchise/city-document-requirement.service';
import { FranchiseApplicationService } from '../domains/franchise/franchise-application.service';
import { AgentManagementService } from '../domains/franchise/agent-management.service';
import { DealerManagementService } from '../domains/franchise/dealer-management.service';
import { FranchiseRevenueService } from '../domains/franchise/franchise-revenue.service';
import { TrainingModuleService } from '../domains/franchise/training-module.service';
import { CorporateAuditService } from '../domains/franchise/corporate-audit.service';

// Analytics domain services
import { AnalyticsService } from '../domains/analytics/analytics.service';
import { FeatureUsageService } from '../domains/analytics/feature-usage.service';
import { ExportService } from '../domains/analytics/export.service';
import { BigQueryPipelineService } from '../domains/analytics/bigquery-pipeline.service';

// Controllers
import { createCityController } from '../domains/franchise/city.controller';
import { createCityServiceFeeController } from '../domains/franchise/city-service-fee.controller';
import { createCityProcessOverrideController } from '../domains/franchise/city-process-override.controller';
import { createCityDocumentRequirementController } from '../domains/franchise/city-document-requirement.controller';
import { createFranchiseApplicationController } from '../domains/franchise/franchise-application.controller';
import { createAgentManagementController } from '../domains/franchise/agent-management.controller';
import { createDealerManagementController } from '../domains/franchise/dealer-management.controller';
import { createFranchiseRevenueController } from '../domains/franchise/franchise-revenue.controller';
import { createTrainingModuleController } from '../domains/franchise/training-module.controller';
import { createCorporateAuditController } from '../domains/franchise/corporate-audit.controller';
import { createFranchiseOwnerProfileController } from '../domains/franchise/franchise-owner-profile.controller';
import { createAdminDashboardController } from '../domains/admin/admin-dashboard.controller';
import { createAnalyticsController } from '../domains/analytics/analytics.controller';
import { createExportController } from '../domains/analytics/export.controller';
import { createFeatureUsageController } from '../domains/analytics/feature-usage.controller';
import { createBigQueryPipelineController } from '../domains/analytics/bigquery-pipeline.controller';

// Builder domain
import { createBuildersController } from '../domains/builders/builders.controller';

// User domain (Epic 1)
import { createUserController } from '../domains/user/user.controller';

// Dealer domain (Epic 9)
import { createDealerController } from '../domains/dealers/dealers.controller';
import { createCommissionController } from '../domains/dealers/commissions.controller';

// Ratings domain (FR19-FR20)
import { RatingService } from '../domains/ratings/rating.service';
import { createRatingController } from '../domains/ratings/rating.controller';

// Service catalog (FR8-FR10)
import { createServiceCatalogController } from '../domains/services/service-catalog.controller';

// Service requests (Story 2-7: Submit Service Request)
import { createServiceRequestController } from '../domains/services/service-request.controller';

// Packages
import { createPackagesController } from '../domains/services/packages.controller';

// Customer service lifecycle
import { createCustomerServicesController } from '../domains/services/customer-services.controller';

// Customer dashboard
import { createCustomerDashboardController } from '../domains/services/customer-dashboard.controller';

// Service instances (Story 5-6)
import { ServiceInstanceService } from '../domains/services/service-instance.service';
import { serviceInstanceRoutes } from '../domains/services/service-instance.controller';

// Documents (Stories 6.2–6.14)
import { DocumentsService } from '../domains/documents/documents.service';
import { documentsRoutes } from '../domains/documents/documents.controller';

// Agent domain (Stories 3-3, 3-5, 3-13)
import { AgentTaskService } from '../domains/agents/agent-task.service';
import { ChecklistService } from '../domains/agents/checklist.service';
import { CashCollectionService } from '../domains/agents/cash-collection.service';
import { AgentAssignmentService } from '../domains/agents/agent-assignment.service';
import { agentTaskRoutes } from '../domains/agents/agent-task.controller';
import { createAgentDashboardController } from '../domains/agents/agent-dashboard.controller';
import { checklistRoutes } from '../domains/agents/checklist.controller';
import { cashCollectionRoutes } from '../domains/agents/cash-collection.controller';
import { agentAssignmentRoutes } from '../domains/agents/agent-assignment.controller';

// Referral domain (Story 4.11)
import { ReferralService } from '../domains/referrals/referral.service';
import { createReferralRouter } from '../domains/referrals/referral.router';

// Payment domain (Stories 4.1, 4.2, 4.13)
import { createPaymentController } from '../domains/payments/payment.controller';
import { createRefundController } from '../domains/payments/refund.controller';
import { createPricingController } from '../domains/payments/pricing.controller';
import { RazorpayClient } from '../core/integrations/razorpay.client';

// Support domain (Story 10.X)
import { createTicketController } from '../domains/support/ticket.controller';
import supportRouter from '../domains/support/support.controller';

// Dispute domain (Story 3-17)
import { disputeRoutes } from '../domains/agents/dispute.controller';
import { DisputeService } from '../domains/agents/dispute.service';

// Training domain (Story 3-18)
import { trainingRoutes } from '../domains/agents/training.controller';
import { TrainingService } from '../domains/agents/training.service';

// Stakeholder domain (Story 6.11)
import { stakeholderRoutes } from '../domains/documents/stakeholders.controller';
import { StakeholderService } from '../domains/documents/stakeholders.service';

// Court tracking (Story 4.1X)
import { createCourtTrackingController } from '../domains/lawyers/court-tracking.controller';

// Lawyer domain (Epic 12 — Stories 12-1 through 12-12)
import lawyerRoutes from './lawyers.routes';
import legalCaseRoutes from './legal-cases.routes';
import legalOpinionRoutes from './legal-opinions.routes';
import opsLegalMarketplaceRoutes from './ops-legal-marketplace.routes';

// Ops dashboard (Story 5.1)
import { createDashboardController } from '../domains/ops/dashboard.controller';
import { createOpsServiceRequestsController } from '../domains/ops/ops-service-requests.controller';

// NRI payment dashboard (Story 13-4)
import { NriPaymentDashboardService } from '../domains/ops/nri-payment-dashboard.service';
import { nriPaymentDashboardRoutes } from '../domains/ops/nri-payment-dashboard.controller';

// Cash reconciliation API (Story 4.8)
import { createCashReconciliationApiController } from '../domains/payments/cash-reconciliation-api.controller';

// Franchise territories (Story 8.X)
import { createTerritoryController } from '../domains/franchise/territory.controller';

// Notifications (Story 7.X)
import { createNotificationController } from '../domains/notifications/notification.controller';
import { createNotificationTemplateController } from '../domains/notifications/notification-template.controller';

// Campaigns
import { createCampaignController } from '../domains/campaigns/campaign.controller';

// Middleware
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { scope } from '../middleware/scope';

export interface ServiceContainer {
  cityService: CityService;
  cityServiceFeeService: CityServiceFeeService;
  cityProcessOverrideService: CityProcessOverrideService;
  cityDocumentRequirementService: CityDocumentRequirementService;
  franchiseApplicationService: FranchiseApplicationService;
  agentManagementService: AgentManagementService;
  dealerManagementService: DealerManagementService;
  franchiseRevenueService: FranchiseRevenueService;
  trainingModuleService: TrainingModuleService;
  corporateAuditService: CorporateAuditService;
  analyticsService: AnalyticsService;
  featureUsageService: FeatureUsageService;
  exportService: ExportService;
  bigQueryPipelineService: BigQueryPipelineService;
}

export function createServiceContainer(prisma: PrismaClient): ServiceContainer {
  return {
    cityService: new CityService(prisma),
    cityServiceFeeService: new CityServiceFeeService(prisma),
    cityProcessOverrideService: new CityProcessOverrideService(prisma),
    cityDocumentRequirementService: new CityDocumentRequirementService(prisma),
    franchiseApplicationService: new FranchiseApplicationService(prisma),
    agentManagementService: new AgentManagementService(prisma),
    dealerManagementService: new DealerManagementService(prisma),
    franchiseRevenueService: new FranchiseRevenueService(prisma),
    trainingModuleService: new TrainingModuleService(prisma),
    corporateAuditService: new CorporateAuditService(prisma),
    analyticsService: new AnalyticsService(prisma),
    featureUsageService: new FeatureUsageService(prisma),
    exportService: new ExportService(prisma),
    bigQueryPipelineService: new BigQueryPipelineService(prisma),
  };
}

export function createApiRouter(services: ServiceContainer, prismaInstance?: PrismaClient, boss?: any): Router {
  const router = Router();

  // Apply authentication and scoping to all /api/v1 routes
  router.use(authenticate);
  router.use(scope);

  // Story 14-1: City Configuration
  router.use('/cities', createCityController(services.cityService));

  // Story 14-2: City Service Fee Schedules
  router.use('/city-service-fees', createCityServiceFeeController(services.cityServiceFeeService));

  // Story 14-3: City Process Overrides
  router.use('/city-process-overrides', createCityProcessOverrideController(services.cityProcessOverrideService));

  // Story 14-4: City Document Requirements
  router.use('/city-document-requirements', createCityDocumentRequirementController(services.cityDocumentRequirementService));

  // Story 14-5: Franchise Applications
  router.use('/franchise-applications', createFranchiseApplicationController(services.franchiseApplicationService));

  // Story 14-6: Agent Management
  router.use('/franchise-agents', createAgentManagementController(services.agentManagementService));

  // Story 14-7: Dealer Management
  router.use('/franchise-dealers', createDealerManagementController(services.dealerManagementService));

  // Story 14-8: Franchise Revenue
  router.use('/franchise-revenue', createFranchiseRevenueController(services.franchiseRevenueService));

  // Stories 14-9, 14-10a/b/c, 14-11: Analytics
  router.use('/analytics', createAnalyticsController(services.analyticsService));

  // Story 14-13: Exports
  router.use('/exports', createExportController(services.exportService));

  // Story 14-15: Training Modules
  router.use('/training-modules', createTrainingModuleController(services.trainingModuleService));

  // Story 14-12: Feature Usage Tracking
  router.use('/feature-usage', createFeatureUsageController(services.featureUsageService));

  // Story 14-14: BigQuery Pipeline
  router.use('/bigquery', createBigQueryPipelineController(services.bigQueryPipelineService));

  // Story 14-16: Corporate Audits
  router.use('/corporate-audits', createCorporateAuditController(services.corporateAuditService));

  // Epic 1: User Profile Management
  if (prismaInstance) {
    router.use('/users', createUserController(prismaInstance));
  }

  // Epic 9: Dealer Network, Commissions & Gamification (Stories 9-1 through 9-16)
  if (prismaInstance) {
    router.use('/dealers', createDealerController(prismaInstance));
    router.use('/dealer-commissions', createCommissionController(prismaInstance));
  }

  // Epic 11: Builder Portal & Bulk Services (Stories 11-1 through 11-10)
  if (prismaInstance) {
    router.use('/builders', createBuildersController(prismaInstance));
  }

  // FR19-FR20: Service Ratings
  if (prismaInstance) {
    const ratingService = new RatingService(prismaInstance);
    router.use('/ratings', createRatingController(ratingService));
  }

  // Customer dashboard (GET /api/v1/customers/me/dashboard)
  if (prismaInstance) {
    router.use('/customers/me/dashboard', createCustomerDashboardController(prismaInstance));
  }

  // Customer service lifecycle (mount BEFORE catalog to avoid /:id catching 'catalog')
  if (prismaInstance) {
    router.use('/services', createCustomerServicesController(prismaInstance));

    // Service instances (existing controller, now mounted)
    const serviceInstanceService = new ServiceInstanceService(prismaInstance, boss ?? null);
    router.use('/services/instances', serviceInstanceRoutes(serviceInstanceService));
  }

  // Stories 6.2–6.14: Document Management
  if (prismaInstance) {
    const documentService = new DocumentsService(prismaInstance, boss ?? null);
    router.use('/documents', documentsRoutes(documentService));

    // Story 6.11: Stakeholder Management
    const stakeholderService = new StakeholderService(prismaInstance, boss ?? null);
    router.use('/stakeholders', stakeholderRoutes(stakeholderService));
  }

  // FR8-FR10: Service Catalog Browsing
  // Mount at both /services/catalog (canonical) and /services/categories (Flutter app compatibility)
  if (prismaInstance) {
    router.use('/services/catalog', createServiceCatalogController(prismaInstance));
    router.use('/services/categories', createServiceCatalogController(prismaInstance));
  }

  // Packages (Flutter: GET /api/v1/packages, GET /api/v1/packages/:id)
  if (prismaInstance) {
    router.use('/packages', createPackagesController(prismaInstance));
  }

  // Story 2-7: Service Request Submission
  if (prismaInstance) {
    router.use('/service-requests', createServiceRequestController(prismaInstance));
  }

  // Agent domain: Dashboard, Tasks, Checklists, Cash Collection
  if (prismaInstance) {
    // Dashboard endpoints must be mounted before task routes
    // so /agents/tasks/summary is matched before /:taskId
    router.use('/agents', createAgentDashboardController(prismaInstance));
    const agentTaskService = new AgentTaskService(prismaInstance, boss ?? null);
    const checklistService = new ChecklistService(prismaInstance, boss ?? null);
    const cashCollectionService = new CashCollectionService(prismaInstance, boss ?? null);
    const agentAssignmentService = new AgentAssignmentService(prismaInstance, boss ?? null);
    router.use('/agents/tasks', agentTaskRoutes(agentTaskService, prismaInstance));
    router.use('/agents/assignments', agentAssignmentRoutes(agentAssignmentService));
    router.use('/agents/checklists', checklistRoutes(checklistService));
    router.use('/agents/cash', cashCollectionRoutes(cashCollectionService));

    // Story 3-17: Dispute Flagging
    const disputeService = new DisputeService(prismaInstance, boss ?? null);
    router.use('/agents/disputes', disputeRoutes(disputeService));

    // Story 3-18: Agent Training
    const trainingService = new TrainingService(prismaInstance);
    router.use('/agents/training', trainingRoutes(trainingService));
  }

  // Story 4.11: Referral Credits
  // Note: authenticate is already applied at router level; pass no-op for authMiddleware
  if (prismaInstance) {
    const referralService = new ReferralService(prismaInstance);
    const noopMiddleware = (_req: any, _res: any, next: any) => next();
    router.use('/referrals', createReferralRouter({
      referralService,
      authMiddleware: noopMiddleware,
      roleMiddleware: (..._roles: string[]) => noopMiddleware,
      validate: () => noopMiddleware,
    }));
  }

  // Stories 4.1, 4.2: Payment Order Creation & Verification
  // Story 4.13: Refund Processing
  if (prismaInstance) {
    const razorpay = new RazorpayClient(
      process.env.RAZORPAY_KEY_ID || '',
      process.env.RAZORPAY_KEY_SECRET || '',
    );
    router.use('/payments', createPaymentController(prismaInstance, razorpay));
    router.use('/payments', createRefundController(prismaInstance, razorpay));
    router.use('/refunds', createRefundController(prismaInstance, razorpay));

    // Story 4.4: Pricing Calculation (P2-4)
    router.use('/pricing', createPricingController(prismaInstance));
  }

  // Story 10.X: Support Tickets + Full Support Module
  if (prismaInstance) {
    router.use('/support/tickets', createTicketController(prismaInstance));
  }
  router.use('/support', supportRouter);

  // Story 4.1X: Court Hearing Tracking
  // Mounted only at /hearings — /legal-cases is reserved for the lawyer legal case routes (Epic 12)
  if (prismaInstance) {
    router.use('/hearings', createCourtTrackingController(prismaInstance));
  }

  // Story 5.1: Ops Dashboard
  if (prismaInstance) {
    router.use('/ops/dashboard', createDashboardController(prismaInstance));
    router.use('/ops/service-requests', createOpsServiceRequestsController(prismaInstance));

    // Story 13-4: NRI Payment Dashboard
    const nriPaymentService = new NriPaymentDashboardService(prismaInstance);
    router.use('/ops/nri-payments', nriPaymentDashboardRoutes(nriPaymentService));

    // Story 4.8: Cash Reconciliation API
    router.use('/cash/reconciliation', createCashReconciliationApiController(prismaInstance));
  }

  // Story 8.X: Franchise Territories
  if (prismaInstance) {
    router.use('/franchise', createTerritoryController(prismaInstance));
  }

  // Notification endpoints (customer-facing)
  if (prismaInstance) {
    router.use('/notifications', createNotificationController(prismaInstance));
    router.use('/notification-templates', createNotificationTemplateController(prismaInstance));
    router.use('/campaigns', createCampaignController(prismaInstance));
  }

  // Epic 12: Lawyer Portal (Stories 12-1 through 12-12)
  router.use('/lawyers', lawyerRoutes);
  router.use('/legal-cases', legalCaseRoutes);
  router.use('/legal-opinions', legalOpinionRoutes);
  router.use('/ops/legal-marketplace', opsLegalMarketplaceRoutes);

  // Franchise owner profile
  if (prismaInstance) {
    router.use('/franchise-owners/me', createFranchiseOwnerProfileController(prismaInstance));
  }

  // Admin dashboard
  if (prismaInstance) {
    router.use('/admin', createAdminDashboardController(prismaInstance));
  }

  return router;
}
