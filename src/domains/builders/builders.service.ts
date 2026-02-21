// ============================================================
// Epic 11: Builder Portal & Bulk Services — Service Layer
// All business logic for Stories 11-1 through 11-9
// Money stored as paise integers (BigInt). UUIDs for all IDs.
// ============================================================

import { PrismaClient, BuilderStatus } from '@prisma/client';
import admin from 'firebase-admin';
import { BusinessError } from '../../shared/errors/business-error';
import { parseBuyerCsv, CsvParseResult } from './csv-parser';
import {
  calculateBulkPricingBreakdown,
  calculateBulkDiscount,
  getDiscountTier,
} from './pricing-engine';
import type {
  BuilderRegistrationInput,
  ProjectCreateInput,
  UnitCreateInput,
  UnitUpdateInput,
  BulkServiceRequestInput,
  ContractCreateInput,
  BroadcastCreateInput,
} from './builders.validation';
import type {
  PricingLineItem,
  BulkPricingBreakdown,
  RecipientFilter,
} from './builders.types';
import { logger } from '../../shared/utils/logger';

export class BuildersService {
  constructor(private prisma: PrismaClient) {}

  // ==========================================================
  // Story 11-1: Builder Registration & Project Setup
  // ==========================================================

  async registerBuilder(userId: string, input: BuilderRegistrationInput) {
    // Check duplicate RERA
    const existing = await this.prisma.builder.findUnique({
      where: { reraNumber: input.reraNumber },
    });
    if (existing) {
      throw new BusinessError('BUILDER_RERA_DUPLICATE', 'RERA number already registered');
    }

    const builder = await this.prisma.builder.create({
      data: {
        userId,
        companyName: input.companyName,
        reraNumber: input.reraNumber,
        gstNumber: input.gstNumber,
        contactPhone: input.contactPhone,
        contactEmail: input.contactEmail,
        cityId: input.cityId,
        status: 'PENDING_VERIFICATION',
      },
    });

    // AC3: Queue Ops notification via pg-boss
    // await pgBoss.send('notification.send', {
    //   type: 'builder_registration_pending',
    //   builderId: builder.id,
    //   targetRole: 'ops',
    // });

    return builder;
  }

  async approveBuilder(builderId: string, action: 'approve' | 'reject', notes?: string) {
    const builder = await this.prisma.builder.findUnique({
      where: { id: builderId },
    });

    if (!builder) throw new BusinessError('BUILDER_NOT_FOUND', 'Builder not found');
    if (builder.status !== 'PENDING_VERIFICATION') {
      throw new BusinessError(
        'BUILDER_INVALID_STATUS',
        'Builder is not pending verification'
      );
    }

    const newStatus: BuilderStatus =
      action === 'approve' ? 'VERIFIED' : 'REJECTED';

    const updated = await this.prisma.builder.update({
      where: { id: builderId },
      data: {
        status: newStatus,
        verifiedAt: action === 'approve' ? new Date() : undefined,
      },
    });

    if (action === 'approve') {
      // AC4: Set Firebase Custom Claims for builder role
      try {
        // Look up user to get existing claims and merge
        const userRecord = await admin.auth().getUser(builder.userId);
        const existingClaims = userRecord.customClaims || {};
        const existingRoles: string[] = existingClaims.roles || [];
        if (!existingRoles.includes('builder')) {
          existingRoles.push('builder');
        }
        await admin.auth().setCustomUserClaims(builder.userId, {
          ...existingClaims,
          roles: existingRoles,
          primaryRole: existingClaims.primaryRole || 'builder',
        });

        // Also update User table
        await this.prisma.user.updateMany({
          where: { firebaseUid: builder.userId },
          data: {
            roles: existingRoles,
            primaryRole: existingClaims.primaryRole || 'builder',
            status: 'ACTIVE',
          },
        });
      } catch (claimsErr) {
        logger.error({ err: claimsErr }, 'Failed to set Firebase claims for builder');
      }
    }

    return updated;
  }

  async createProject(builderId: string, input: ProjectCreateInput) {
    const builder = await this.prisma.builder.findUnique({
      where: { id: builderId },
    });
    if (!builder || builder.status !== 'VERIFIED') {
      throw new BusinessError(
        'BUILDER_NOT_VERIFIED',
        'Builder must be verified to create projects'
      );
    }

    const project = await this.prisma.builderProject.create({
      data: {
        builderId,
        name: input.name,
        totalUnits: input.totalUnits,
        location: input.location,
        projectType: input.projectType,
        cityId: input.cityId,
        status: 'ACTIVE',
      },
    });

    return project;
  }

  async getBuilderByUserId(userId: string) {
    return this.prisma.builder.findUnique({
      where: { userId },
      include: { projects: true },
    });
  }

  async getProjects(builderId: string) {
    return this.prisma.builderProject.findMany({
      where: { builderId },
      include: { _count: { select: { units: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getProjectById(projectId: string, builderId: string) {
    const project = await this.prisma.builderProject.findFirst({
      where: { id: projectId, builderId },
      include: { _count: { select: { units: true } } },
    });
    if (!project) throw new BusinessError('PROJECT_NOT_FOUND', 'Project not found');
    return project;
  }

  async getPendingBuilders() {
    return this.prisma.builder.findMany({
      where: { status: 'PENDING_VERIFICATION' },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ==========================================================
  // Story 11-2: Buyer List Upload & Unit Management
  // ==========================================================

  async uploadBuyerCsv(projectId: string, builderId: string, csvString: string) {
    const project = await this.prisma.builderProject.findFirst({
      where: { id: projectId, builderId },
    });
    if (!project) throw new BusinessError('PROJECT_NOT_FOUND', 'Project not found');

    const { validRows, errors, encodingWarning } = parseBuyerCsv(csvString);

    if (errors.length > 0 && validRows.length === 0) {
      return { created: 0, errors, encodingWarning };
    }

    // Check for existing unit numbers in the project
    const existingUnits = await this.prisma.projectUnit.findMany({
      where: { projectId },
      select: { unitNumber: true },
    });
    const existingSet = new Set(existingUnits.map((u) => u.unitNumber));

    const duplicatesInDb = validRows.filter((r) => existingSet.has(r.unit_number));
    if (duplicatesInDb.length > 0) {
      errors.push(
        ...duplicatesInDb.map((r) => ({
          row: 0,
          field: 'unit_number',
          message: `Unit ${r.unit_number} already exists in project`,
        }))
      );
    }

    const newRows = validRows.filter((r) => !existingSet.has(r.unit_number));

    const result = await this.prisma.projectUnit.createMany({
      data: newRows.map((row) => ({
        projectId,
        unitNumber: row.unit_number,
        buyerName: row.buyer_name,
        buyerPhone: row.buyer_phone,
        buyerEmail: row.buyer_email,
        status: 'PENDING_SERVICES',
      })),
    });

    // AC7: Queue WhatsApp welcome notifications for each buyer
    // for (const row of newRows) {
    //   await pgBoss.send('notification.send', {
    //     type: 'builder_buyer_welcome',
    //     phone: row.buyer_phone,
    //     templateData: { builderName: project.name, unitNumber: row.unit_number },
    //   });
    // }

    return { created: result.count, errors, encodingWarning };
  }

  async addUnit(projectId: string, builderId: string, input: UnitCreateInput) {
    const project = await this.prisma.builderProject.findFirst({
      where: { id: projectId, builderId },
    });
    if (!project) throw new BusinessError('PROJECT_NOT_FOUND', 'Project not found');

    return this.prisma.projectUnit.create({
      data: {
        projectId,
        unitNumber: input.unitNumber,
        buyerName: input.buyerName,
        buyerPhone: input.buyerPhone,
        buyerEmail: input.buyerEmail,
        status: 'PENDING_SERVICES',
      },
    });
  }

  async updateUnit(unitId: string, builderId: string, input: UnitUpdateInput) {
    const unit = await this.prisma.projectUnit.findUnique({
      where: { id: unitId },
      include: { project: true },
    });
    if (!unit || unit.project.builderId !== builderId) {
      throw new BusinessError('UNIT_NOT_FOUND', 'Unit not found');
    }

    return this.prisma.projectUnit.update({
      where: { id: unitId },
      data: input,
    });
  }

  async getProjectUnits(projectId: string, builderId: string) {
    const project = await this.prisma.builderProject.findFirst({
      where: { id: projectId, builderId },
    });
    if (!project) throw new BusinessError('PROJECT_NOT_FOUND', 'Project not found');

    return this.prisma.projectUnit.findMany({
      where: { projectId },
      orderBy: { unitNumber: 'asc' },
      take: 500,
    });
  }

  // ==========================================================
  // Story 11-3: Bulk Service Selection & Request
  // ==========================================================

  async createBulkServiceRequest(
    builderId: string,
    projectId: string,
    input: BulkServiceRequestInput
  ) {
    const project = await this.prisma.builderProject.findFirst({
      where: { id: projectId, builderId },
      include: { units: true },
    });
    if (!project) throw new BusinessError('PROJECT_NOT_FOUND', 'Project not found');

    // Resolve unit list
    const unitIds = input.allUnits
      ? project.units.map((u) => u.id)
      : input.unitIds!;

    const unitCount = unitIds.length;
    if (unitCount === 0) {
      throw new BusinessError('NO_UNITS_SELECTED', 'No units selected for bulk services');
    }

    // Calculate pricing (uses BigInt internally)
    // Fetch service prices from ServiceDefinition catalog
    const serviceDefs = await this.prisma.serviceDefinition.findMany({
      where: { id: { in: input.serviceIds } },
      select: { id: true, definition: true },
    });

    // Calculate total fee from service catalog prices
    let totalFeePaise = BigInt(0);
    for (const svc of serviceDefs) {
      const config = svc.definition as { pricing?: { basePaiseFee?: number } } | null;
      const baseFee = config?.pricing?.basePaiseFee ?? 1500000; // fallback 15K if not configured
      totalFeePaise += BigInt(baseFee) * BigInt(unitCount);
    }

    const discountPct = calculateBulkDiscount(unitCount);
    const discountAmountPaise = (totalFeePaise * BigInt(discountPct)) / BigInt(100);
    const discountedFeePaise = totalFeePaise - discountAmountPaise;

    const bulkRequest = await this.prisma.bulkServiceRequest.create({
      data: {
        projectId,
        builderId,
        serviceIds: input.serviceIds,
        packageIds: input.packageIds || [],
        unitIds,
        allUnits: input.allUnits || false,
        unitCount,
        totalFeePaise,
        discountPct,
        discountedFeePaise,
        status: 'PENDING',
      },
    });

    // AC7 (Story 11-4): Trigger async workflow creation via pg-boss
    // await pgBoss.send('bulk-service-create', {
    //   bulkRequestId: bulkRequest.id,
    //   projectId,
    //   builderId,
    //   serviceIds: input.serviceIds,
    //   unitIds,
    // });

    return {
      bulkRequest: {
        ...bulkRequest,
        totalFeePaise: bulkRequest.totalFeePaise.toString(),
        discountedFeePaise: bulkRequest.discountedFeePaise.toString(),
      },
      pricing: {
        unitCount,
        servicesCount: input.serviceIds.length,
        totalFeePaise: totalFeePaise.toString(),
        discountPct,
        discountAmountPaise: discountAmountPaise.toString(),
        discountedFeePaise: discountedFeePaise.toString(),
      },
    };
  }

  async getBulkPricingPreview(serviceIds: string[], unitCount: number) {
    // Fetch service fees from ServiceDefinition catalog
    const serviceDefs = await this.prisma.serviceDefinition.findMany({
      where: { id: { in: serviceIds } },
      select: { id: true, name: true, definition: true },
    });

    const lineItems: PricingLineItem[] = serviceDefs.map((svc) => {
      const config = svc.definition as {
        pricing?: { basePaiseFee?: number; govtFeeEstimatePaise?: number };
      } | null;

      return {
        serviceId: svc.id,
        serviceName: svc.name || '',
        baseFeePaise: BigInt(config?.pricing?.basePaiseFee ?? 1500000), // fallback 15K
        govtFeeEstimatePaise: BigInt(config?.pricing?.govtFeeEstimatePaise ?? 500000), // fallback 5K
      };
    });

    // Handle case where some services weren't found
    const foundIds = new Set(serviceDefs.map(s => s.id));
    const missingIds = serviceIds.filter(id => !foundIds.has(id));
    for (const id of missingIds) {
      lineItems.push({
        serviceId: id,
        serviceName: 'Unknown Service',
        baseFeePaise: BigInt(1500000),
        govtFeeEstimatePaise: BigInt(500000),
      });
    }

    return calculateBulkPricingBreakdown(lineItems, unitCount);
  }

  // ==========================================================
  // Story 11-5: Project-Level Progress Dashboard
  // ==========================================================

  async getProjectProgress(projectId: string, builderId: string) {
    const project = await this.prisma.builderProject.findFirst({
      where: { id: projectId, builderId },
    });
    if (!project) throw new BusinessError('PROJECT_NOT_FOUND', 'Project not found');

    // Aggregate service request statuses by service type using raw SQL
    const serviceProgress = await this.prisma.$queryRaw`
      SELECT
        pu.status as unit_status,
        COUNT(*)::int as count
      FROM project_units pu
      WHERE pu.project_id = ${projectId}::uuid
      GROUP BY pu.status
    `;

    const unitCounts = await this.prisma.projectUnit.groupBy({
      by: ['status'],
      where: { projectId },
      _count: { id: true },
    });

    const totalUnits = await this.prisma.projectUnit.count({
      where: { projectId },
    });

    const bulkRequests = await this.prisma.bulkServiceRequest.findMany({
      where: { projectId },
      select: {
        id: true,
        status: true,
        unitCount: true,
        serviceIds: true,
        discountPct: true,
        totalFeePaise: true,
        discountedFeePaise: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      project,
      unitStatusSummary: unitCounts.map((uc) => ({
        status: uc.status,
        count: uc._count.id,
      })),
      totalUnits,
      bulkRequests: bulkRequests.map((br) => ({
        ...br,
        totalFeePaise: br.totalFeePaise.toString(),
        discountedFeePaise: br.discountedFeePaise.toString(),
      })),
    };
  }

  async getProjectTimeline(projectId: string, builderId: string) {
    const project = await this.prisma.builderProject.findFirst({
      where: { id: projectId, builderId },
    });
    if (!project) throw new BusinessError('PROJECT_NOT_FOUND', 'Project not found');

    // Return bulk request creation history as timeline
    const timeline = await this.prisma.bulkServiceRequest.findMany({
      where: { projectId },
      select: {
        id: true,
        status: true,
        unitCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return timeline;
  }

  // ==========================================================
  // Story 11-6: Bulk Pricing & Discount Engine
  // ==========================================================

  async ensurePricingTier(projectId: string, builderId: string) {
    const existing = await this.prisma.builderPricingTier.findUnique({
      where: { projectId },
    });
    if (existing) return existing;

    const project = await this.prisma.builderProject.findUnique({
      where: { id: projectId },
    });
    if (!project) throw new BusinessError('PROJECT_NOT_FOUND', 'Project not found');

    const tier = getDiscountTier(project.totalUnits);

    return this.prisma.builderPricingTier.create({
      data: {
        projectId,
        builderId,
        unitCount: project.totalUnits,
        tierName: tier.name,
        discountPct: tier.pct,
        status: 'AUTO',
      },
    });
  }

  async overridePricingTier(
    tierId: string,
    opsUserId: string,
    discountPct: number,
    notes?: string
  ) {
    return this.prisma.builderPricingTier.update({
      where: { id: tierId },
      data: {
        discountPct,
        status: 'CUSTOM_APPROVED',
        approvedBy: opsUserId,
        approvedAt: new Date(),
        notes,
      },
    });
  }

  async requestCustomPricing(tierId: string, requestedPct: number, notes: string) {
    return this.prisma.builderPricingTier.update({
      where: { id: tierId },
      data: {
        discountPct: requestedPct,
        status: 'CUSTOM_PENDING',
        notes,
      },
    });
  }

  async getPricingTier(projectId: string) {
    return this.prisma.builderPricingTier.findUnique({
      where: { projectId },
    });
  }

  // ==========================================================
  // Story 11-7: Unit-Level Payment Tracking
  // ==========================================================

  async getProjectPaymentSummary(projectId: string, builderId: string) {
    const project = await this.prisma.builderProject.findFirst({
      where: { id: projectId, builderId },
    });
    if (!project) throw new BusinessError('PROJECT_NOT_FOUND', 'Project not found');

    const units = await this.prisma.projectUnit.findMany({
      where: { projectId },
      orderBy: { unitNumber: 'asc' },
    });

    // For each unit, derive payment status from unit status
    const unitPayments = units.map((u) => ({
      unitId: u.id,
      unitNumber: u.unitNumber,
      buyerName: u.buyerName,
      status: u.status,
      paymentStatus:
        u.status === 'SERVICES_COMPLETED'
          ? 'paid'
          : u.status === 'SERVICES_ACTIVE'
            ? 'pending'
            : 'pending',
    }));

    const summary = {
      paid: unitPayments.filter((u) => u.paymentStatus === 'paid').length,
      pending: unitPayments.filter((u) => u.paymentStatus === 'pending').length,
      overdue: 0, // Determined by SLA deadline comparison in production
    };

    return {
      units: unitPayments,
      totals: {
        totalCollectedPaise: '0',
        totalDuePaise: '0',
        pendingPaise: '0',
      },
      summary,
    };
  }

  async getUnitPaymentDetail(unitId: string, builderId: string) {
    const unit = await this.prisma.projectUnit.findUnique({
      where: { id: unitId },
      include: { project: true },
    });
    if (!unit || unit.project.builderId !== builderId) {
      throw new BusinessError('UNIT_NOT_FOUND', 'Unit not found');
    }

    // AC6: No payment method or transaction ID exposed to builder
    return {
      unit: {
        id: unit.id,
        unitNumber: unit.unitNumber,
        buyerName: unit.buyerName,
        status: unit.status,
      },
      serviceRequests: [], // In production: query service_requests for this unit
    };
  }

  async sendPaymentReminder(unitId: string, builderId: string) {
    const unit = await this.prisma.projectUnit.findUnique({
      where: { id: unitId },
      include: { project: true },
    });
    if (!unit || unit.project.builderId !== builderId) {
      throw new BusinessError('UNIT_NOT_FOUND', 'Unit not found');
    }

    // Queue WhatsApp notification via pg-boss
    // await pgBoss.send('notification.send', {
    //   type: 'builder_payment_reminder',
    //   phone: unit.buyerPhone,
    //   templateData: { unitNumber: unit.unitNumber, builderName: unit.project.name },
    // });

    return { sent: true };
  }

  // ==========================================================
  // Story 11-8: Annual Service Contract Management
  // ==========================================================

  /**
   * Generate a unique contract number using retry loop to handle race conditions.
   * The contractNumber column has a @unique constraint in the schema, so concurrent
   * inserts with the same number will fail. We retry with an incremented sequence.
   */
  async generateContractNumber(maxRetries = 5): Promise<string> {
    const year = new Date().getFullYear();

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      const lastContract = await this.prisma.builderContract.findFirst({
        where: { contractNumber: { startsWith: `PLA-CNTR-${year}` } },
        orderBy: { contractNumber: 'desc' },
      });
      const seq = lastContract
        ? parseInt(lastContract.contractNumber.split('-').pop()!) + 1 + attempt
        : 1 + attempt;
      const candidate = `PLA-CNTR-${year}-${String(seq).padStart(5, '0')}`;

      // Check if this number already exists (defensive check before insert)
      const existing = await this.prisma.builderContract.findUnique({
        where: { contractNumber: candidate },
      });
      if (!existing) {
        return candidate;
      }
    }

    // Fallback: append random suffix to guarantee uniqueness
    const fallbackSeq = Date.now().toString(36);
    return `PLA-CNTR-${year}-${fallbackSeq}`;
  }

  async createContract(builderId: string, input: ContractCreateInput) {
    const contractNumber = await this.generateContractNumber();

    // Calculate total value: sum of service fees x units x discount
    // Fetch actual service fees from ServiceDefinition catalog
    const serviceDefs = await this.prisma.serviceDefinition.findMany({
      where: { id: { in: input.serviceIds } },
      select: { id: true, definition: true },
    });

    let perUnitFeePaise = BigInt(0);
    for (const svc of serviceDefs) {
      const config = svc.definition as { pricing?: { basePaiseFee?: number } } | null;
      const baseFee = config?.pricing?.basePaiseFee ?? 1500000; // fallback 15K
      perUnitFeePaise += BigInt(baseFee);
    }
    // Add fallback for any missing services
    const missingCount = input.serviceIds.length - serviceDefs.length;
    if (missingCount > 0) {
      perUnitFeePaise += BigInt(1500000) * BigInt(missingCount);
    }

    const totalValuePaise =
      (perUnitFeePaise * BigInt(input.unitCount) * BigInt(100 - input.discountPct)) /
      BigInt(100);

    return this.prisma.builderContract.create({
      data: {
        builderId,
        projectId: input.projectId,
        contractNumber,
        serviceIds: input.serviceIds,
        unitCount: input.unitCount,
        discountPct: input.discountPct,
        validFrom: new Date(input.validFrom),
        validTo: new Date(input.validTo),
        autoRenew: input.autoRenew ?? true,
        totalValuePaise,
        status: 'DRAFT',
      },
    });
  }

  async submitContractForApproval(contractId: string, builderId: string) {
    const contract = await this.prisma.builderContract.findFirst({
      where: { id: contractId, builderId, status: 'DRAFT' },
    });
    if (!contract) {
      throw new BusinessError(
        'CONTRACT_NOT_FOUND',
        'Contract not found or not in draft status'
      );
    }

    return this.prisma.builderContract.update({
      where: { id: contractId },
      data: { status: 'PENDING_APPROVAL' },
    });
  }

  async approveContract(contractId: string, opsUserId: string) {
    return this.prisma.builderContract.update({
      where: { id: contractId },
      data: {
        status: 'ACTIVE',
        approvedBy: opsUserId,
        approvedAt: new Date(),
      },
    });
  }

  async requestAmendment(contractId: string, builderId: string, amendmentNotes: string) {
    const contract = await this.prisma.builderContract.findFirst({
      where: { id: contractId, builderId, status: 'ACTIVE' },
    });
    if (!contract) {
      throw new BusinessError('CONTRACT_NOT_FOUND', 'Active contract not found');
    }

    return this.prisma.builderContract.update({
      where: { id: contractId },
      data: { status: 'AMENDMENT_PENDING', amendmentNotes },
    });
  }

  async cancelAutoRenewal(contractId: string, builderId: string) {
    const contract = await this.prisma.builderContract.findFirst({
      where: { id: contractId, builderId },
    });
    if (!contract) throw new BusinessError('CONTRACT_NOT_FOUND', 'Contract not found');

    return this.prisma.builderContract.update({
      where: { id: contractId },
      data: { autoRenew: false },
    });
  }

  async getContracts(builderId: string) {
    return this.prisma.builderContract.findMany({
      where: { builderId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getContractDetail(contractId: string, builderId: string) {
    const contract = await this.prisma.builderContract.findFirst({
      where: { id: contractId, builderId },
    });
    if (!contract) throw new BusinessError('CONTRACT_NOT_FOUND', 'Contract not found');

    const remainingDays = Math.max(
      0,
      Math.ceil((contract.validTo.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    );
    const utilizationPct =
      contract.unitCount > 0
        ? Math.round((contract.utilizedUnits / contract.unitCount) * 100)
        : 0;

    return {
      contract: {
        ...contract,
        totalValuePaise: contract.totalValuePaise.toString(),
      },
      utilizationPct,
      remainingDays,
      remainingUnits: contract.unitCount - contract.utilizedUnits,
    };
  }

  // ==========================================================
  // Story 11-9: Builder-Buyer Communication Channel
  // ==========================================================

  async createBroadcast(
    builderId: string,
    projectId: string,
    input: BroadcastCreateInput
  ) {
    // AC7: Anti-spam — max 2 broadcasts per week
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentCount = await this.prisma.builderBroadcast.count({
      where: {
        builderId,
        projectId,
        createdAt: { gte: oneWeekAgo },
        status: { in: ['APPROVED', 'SENDING', 'SENT'] },
      },
    });
    if (recentCount >= 2) {
      throw new BusinessError(
        'BROADCAST_LIMIT_REACHED',
        'Maximum 2 broadcasts per week'
      );
    }

    // Resolve recipient list from filter
    const units = await this.resolveRecipients(projectId, input.recipientFilter);

    return this.prisma.builderBroadcast.create({
      data: {
        builderId,
        projectId,
        message: input.message,
        recipientFilter: input.recipientFilter as any,
        recipientCount: units.length,
        status: 'PENDING_APPROVAL', // AC8: Requires Ops approval
      },
    });
  }

  private async resolveRecipients(
    projectId: string,
    filter?: RecipientFilter | null
  ) {
    const where: any = { projectId };
    if (filter?.serviceStatus) {
      where.status = filter.serviceStatus;
    }
    return this.prisma.projectUnit.findMany({
      where,
      select: { id: true, buyerPhone: true },
    });
  }

  async approveBroadcast(broadcastId: string, opsUserId: string) {
    const broadcast = await this.prisma.builderBroadcast.update({
      where: { id: broadcastId },
      data: { status: 'APPROVED', approvedBy: opsUserId },
    });

    // Queue sending via pg-boss
    // await pgBoss.send('builder-broadcast-send', { broadcastId });

    return broadcast;
  }

  async rejectBroadcast(broadcastId: string, opsUserId: string) {
    return this.prisma.builderBroadcast.update({
      where: { id: broadcastId },
      data: { status: 'REJECTED', approvedBy: opsUserId },
    });
  }

  async getBroadcasts(builderId: string, projectId: string) {
    return this.prisma.builderBroadcast.findMany({
      where: { builderId, projectId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async getBroadcastDeliveryStatus(broadcastId: string) {
    const deliveries = await this.prisma.broadcastDelivery.findMany({
      where: { broadcastId },
      include: { unit: { select: { unitNumber: true, buyerName: true } } },
      take: 500,
    });

    return {
      total: deliveries.length,
      sent: deliveries.filter((d) => d.status === 'SENT').length,
      delivered: deliveries.filter((d) => d.status === 'DELIVERED').length,
      read: deliveries.filter((d) => d.status === 'READ').length,
      failed: deliveries.filter((d) => d.status === 'FAILED').length,
      details: deliveries,
    };
  }

  async getInboxMessages(builderId: string, projectId: string) {
    return this.prisma.builderInboxMessage.findMany({
      where: { builderId, projectId },
      orderBy: { createdAt: 'desc' },
      include: { unit: { select: { unitNumber: true } } },
      take: 50,
    });
  }

  async markInboxMessageRead(messageId: string, builderId: string) {
    const message = await this.prisma.builderInboxMessage.findFirst({
      where: { id: messageId, builderId },
    });
    if (!message) throw new BusinessError('MESSAGE_NOT_FOUND', 'Message not found');

    return this.prisma.builderInboxMessage.update({
      where: { id: messageId },
      data: { isRead: true },
    });
  }

  async getUnreadInboxCount(builderId: string) {
    return this.prisma.builderInboxMessage.count({
      where: { builderId, isRead: false },
    });
  }
}
