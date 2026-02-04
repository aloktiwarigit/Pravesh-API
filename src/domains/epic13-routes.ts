// Epic 13: NRI Services, POA & Court Tracking - Route Registration
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

// Payment domain (Stories 13-1 to 13-3)
import { InternationalPaymentService } from './payments/international-payment.service.js';
import { internationalPaymentRoutes } from './payments/international-payment.controller.js';
import { WireTransferService } from './payments/wire-transfer.service.js';
import { wireTransferRoutes } from './payments/wire-transfer.controller.js';
import { ExchangeRateService } from './payments/exchange-rate.service.js';
import { exchangeRateRoutes } from './payments/exchange-rate.controller.js';

// Ops domain (Stories 13-4, 13-14)
import { NriPaymentDashboardService } from './ops/nri-payment-dashboard.service.js';
import { nriPaymentDashboardRoutes } from './ops/nri-payment-dashboard.controller.js';
import { NriFilterService } from './ops/nri-filter.service.js';

// Services domain - POA (Stories 13-5 to 13-7)
import { PoaTemplateService } from './services/poa-template.service.js';
import { poaTemplateRoutes } from './services/poa-template.controller.js';
import { PoaExecutionService } from './services/poa-execution.service.js';
import { poaExecutionRoutes } from './services/poa-execution.controller.js';
import { PoaVerificationService } from './services/poa-verification.service.js';
import { poaVerificationRoutes } from './services/poa-verification.controller.js';

// Agents domain - POA Handoff (Story 13-8)
import { PoaHandoffService } from './agents/poa-handoff.service.js';
import { poaHandoffRoutes } from './agents/poa-handoff.controller.js';

// Services domain - Court (Stories 13-9 to 13-12)
import { CourtHearingService } from './services/court-hearing.service.js';
import { courtHearingRoutes } from './services/court-hearing.controller.js';
import { CourtAdjournmentService } from './services/court-adjournment.service.js';
import { courtAdjournmentRoutes } from './services/court-adjournment.controller.js';
import { CourtOrderService } from './services/court-order.service.js';
import { courtOrderRoutes } from './services/court-order.controller.js';
import { CourtEventNotificationService } from './services/court-event-notification.service.js';
import { courtEventRoutes } from './services/court-event-notification.controller.js';

// Services domain - Consultation (Story 13-13)
import { ConsultationService } from './services/consultation.service.js';
import { consultationRoutes } from './services/consultation.controller.js';

// Services domain - NRI Document Coordination (Story 13-15)
import { NriDocumentCoordinationService } from './services/nri-document-coordination.service.js';
import { nriDocumentRoutes } from './services/nri-document-coordination.controller.js';

// Background Jobs
import { registerWireTransferSlaJob } from './payments/wire-transfer-sla.job.js';
import { registerExchangeRateRefreshJob } from './payments/exchange-rate-refresh.job.js';
import { registerPoaExpiryJob } from './services/poa-expiry.job.js';

export function registerEpic13Routes(
  router: Router,
  prisma: PrismaClient,
  boss: any, // PgBoss instance - namespace import cannot be used as type
) {
  // --- Service Instantiation ---

  // Payments
  const internationalPaymentService =
    new InternationalPaymentService(prisma);
  const wireTransferService = new WireTransferService(prisma);
  const exchangeRateService = new ExchangeRateService(prisma);

  // Ops
  const nriPaymentDashboardService =
    new NriPaymentDashboardService(prisma);

  // POA
  const poaTemplateService = new PoaTemplateService(prisma);
  const poaExecutionService = new PoaExecutionService(prisma, boss);
  const poaVerificationService = new PoaVerificationService(
    prisma,
    boss
  );

  // Agents
  const poaHandoffService = new PoaHandoffService(prisma, boss);

  // Court
  const courtHearingService = new CourtHearingService(prisma, boss);
  const courtAdjournmentService = new CourtAdjournmentService(
    prisma,
    boss
  );
  const courtOrderService = new CourtOrderService(prisma, boss);
  const courtEventNotificationService =
    new CourtEventNotificationService(prisma, boss);

  // Consultation
  const consultationService = new ConsultationService(prisma, boss);

  // NRI Document Coordination
  const nriDocumentCoordinationService =
    new NriDocumentCoordinationService(prisma, boss);

  // --- Route Registration ---

  // Payments (Stories 13-1 to 13-3)
  router.use(
    '/api/v1/payments/international-upi',
    internationalPaymentRoutes(internationalPaymentService)
  );
  router.use(
    '/api/v1/payments/wire-transfer',
    wireTransferRoutes(wireTransferService)
  );
  router.use(
    '/api/v1/exchange-rates',
    exchangeRateRoutes(exchangeRateService)
  );

  // Ops NRI Payments (Story 13-4)
  router.use(
    '/api/v1/ops/nri-payments',
    nriPaymentDashboardRoutes(nriPaymentDashboardService)
  );

  // POA (Stories 13-5 to 13-7)
  router.use('/api/v1/poa', poaTemplateRoutes(poaTemplateService));
  router.use(
    '/api/v1/poa/execution',
    poaExecutionRoutes(poaExecutionService)
  );
  router.use(
    '/api/v1/poa/verification',
    poaVerificationRoutes(poaVerificationService)
  );

  // Agent POA Handoff (Story 13-8)
  router.use(
    '/api/v1/agents/poa',
    poaHandoffRoutes(poaHandoffService)
  );

  // Court (Stories 13-9 to 13-12)
  router.use(
    '/api/v1/court-hearings',
    courtHearingRoutes(courtHearingService)
  );
  router.use(
    '/api/v1/court-hearings/adjournments',
    courtAdjournmentRoutes(courtAdjournmentService)
  );
  router.use(
    '/api/v1/court-orders',
    courtOrderRoutes(courtOrderService)
  );
  router.use(
    '/api/v1/court-events',
    courtEventRoutes(courtEventNotificationService)
  );

  // Consultation (Story 13-13)
  router.use(
    '/api/v1/consultations',
    consultationRoutes(consultationService)
  );

  // NRI Document Coordination (Story 13-15)
  router.use(
    '/api/v1/nri-documents',
    nriDocumentRoutes(nriDocumentCoordinationService)
  );

  // --- Background Job Registration ---
  registerWireTransferSlaJob(boss, wireTransferService);
  registerExchangeRateRefreshJob(boss, exchangeRateService);
  registerPoaExpiryJob(boss, poaVerificationService);

  // Consultation no-show check worker
  boss.work('consultation.no-show-check', async (job: any) => {
    await consultationService.handleNoShow(
      job.data.consultationId
    );
  });
}
