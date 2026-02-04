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

// Middleware
import { authenticate } from '../middleware/authenticate';
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

export function createApiRouter(services: ServiceContainer, prismaInstance?: PrismaClient): Router {
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

  // FR8-FR10: Service Catalog Browsing
  if (prismaInstance) {
    router.use('/services/catalog', createServiceCatalogController(prismaInstance));
  }

  return router;
}
