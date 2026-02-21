import { PrismaClient } from '@prisma/client';
import admin from 'firebase-admin';
import { franchiseApplicationCreateSchema, reviewChecklistSchema, contractTermsSchema, FranchiseApplicationStatus, ContractTerms } from './franchise.types';
import { BusinessError } from '../../shared/errors/business-error';
import * as ErrorCodes from '../../shared/errors/error-codes';
import { logger } from '../../shared/utils/logger';

/**
 * Story 14-5: Franchise Application & Vetting Workflow
 *
 * Manages the full lifecycle of franchise applications:
 * pending_review -> info_requested -> interview_scheduled -> approved -> agreement_sent -> onboarded
 * OR: pending_review -> rejected
 */
export class FranchiseApplicationService {
  constructor(private prisma: PrismaClient) {}

  private static VALID_TRANSITIONS: Record<string, string[]> = {
    pending_review: ['info_requested', 'interview_scheduled', 'approved', 'rejected'],
    info_requested: ['pending_review', 'rejected'],
    interview_scheduled: ['approved', 'rejected', 'info_requested'],
    approved: ['agreement_sent'],
    agreement_sent: ['onboarded'],
    rejected: [],
    onboarded: [],
  };

  /**
   * Submit a franchise application
   */
  async submitApplication(params: {
    applicantName: string;
    applicantEmail: string;
    applicantPhone: string;
    cityId: string;
    businessExperience: string;
    financialCapacity: string;
    references: { name: string; phone: string; relationship: string }[];
    businessPlanUrl?: string;
  }) {
    franchiseApplicationCreateSchema.parse(params);

    // Verify city exists
    const city = await this.prisma.city.findUnique({ where: { id: params.cityId } });
    if (!city) {
      throw new BusinessError(ErrorCodes.BUSINESS_CITY_NOT_FOUND, 'City not found', 404);
    }

    // Check if franchise already exists for this city
    const existingFranchise = await this.prisma.franchise.findUnique({
      where: { cityId: params.cityId },
    });
    if (existingFranchise) {
      throw new BusinessError(
        ErrorCodes.BUSINESS_FRANCHISE_APPLICATION_INVALID_STATUS,
        'A franchise already exists for this city',
        409
      );
    }

    return this.prisma.franchiseApplication.create({
      data: {
        applicantName: params.applicantName,
        applicantEmail: params.applicantEmail,
        applicantPhone: params.applicantPhone,
        cityId: params.cityId,
        businessExperience: params.businessExperience,
        financialCapacity: params.financialCapacity,
        references: params.references as any,
        businessPlanUrl: params.businessPlanUrl,
        status: 'pending_review',
      },
    });
  }

  /**
   * Update application status with validation
   */
  async updateStatus(
    applicationId: string,
    newStatus: FranchiseApplicationStatus,
    reviewedBy: string,
    reviewNotes?: string,
    reviewChecklist?: Record<string, any>
  ) {
    const application = await this.prisma.franchiseApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application) {
      throw new BusinessError(
        ErrorCodes.BUSINESS_FRANCHISE_NOT_FOUND,
        'Application not found',
        404
      );
    }

    const validTransitions = FranchiseApplicationService.VALID_TRANSITIONS[application.status];
    if (!validTransitions?.includes(newStatus)) {
      throw new BusinessError(
        ErrorCodes.BUSINESS_FRANCHISE_APPLICATION_INVALID_STATUS,
        `Cannot transition from "${application.status}" to "${newStatus}"`,
        422,
        { currentStatus: application.status, requestedStatus: newStatus }
      );
    }

    return this.prisma.franchiseApplication.update({
      where: { id: applicationId },
      data: {
        status: newStatus,
        reviewedBy,
        reviewedAt: new Date(),
        reviewNotes: reviewNotes || application.reviewNotes,
        reviewChecklist: reviewChecklist as any || application.reviewChecklist,
      },
    });
  }

  /**
   * Approve application and send agreement
   */
  async approveAndSendAgreement(applicationId: string, agreementDocUrl: string, reviewedBy: string) {
    const application = await this.prisma.franchiseApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application || application.status !== 'approved') {
      throw new BusinessError(
        ErrorCodes.BUSINESS_FRANCHISE_APPLICATION_INVALID_STATUS,
        'Application must be in approved status to send agreement',
        422
      );
    }

    return this.prisma.franchiseApplication.update({
      where: { id: applicationId },
      data: {
        status: 'agreement_sent',
        agreementDocUrl,
        reviewedBy,
        reviewedAt: new Date(),
      },
    });
  }

  /**
   * Complete onboarding: upload signed agreement, create Franchise + assign role
   */
  async completeOnboarding(
    applicationId: string,
    signedAgreementUrl: string,
    ownerUserId: string,
    contractTerms: ContractTerms
  ) {
    contractTermsSchema.parse(contractTerms);

    const application = await this.prisma.franchiseApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application || application.status !== 'agreement_sent') {
      throw new BusinessError(
        ErrorCodes.BUSINESS_FRANCHISE_APPLICATION_INVALID_STATUS,
        'Application must be in agreement_sent status to onboard',
        422
      );
    }

    // Transaction: update application + create franchise
    const [updatedApp, franchise] = await this.prisma.$transaction([
      this.prisma.franchiseApplication.update({
        where: { id: applicationId },
        data: {
          status: 'onboarded',
          signedAgreementUrl,
        },
      }),
      this.prisma.franchise.create({
        data: {
          cityId: application.cityId,
          ownerUserId,
          ownerName: application.applicantName,
          ownerEmail: application.applicantEmail,
          ownerPhone: application.applicantPhone,
          contractTerms: contractTerms as any,
        },
      }),
    ]);

    // Set Firebase Custom Claims for Franchise Owner role
    try {
      const userRecord = await admin.auth().getUser(ownerUserId);
      const existingClaims = userRecord.customClaims || {};
      const existingRoles: string[] = existingClaims.roles || [];
      if (!existingRoles.includes('franchise_owner')) {
        existingRoles.push('franchise_owner');
      }
      await admin.auth().setCustomUserClaims(ownerUserId, {
        ...existingClaims,
        roles: existingRoles,
        cityId: application.cityId,
        primaryRole: existingClaims.primaryRole || 'franchise_owner',
      });

      // Also update User table
      await this.prisma.user.updateMany({
        where: { firebaseUid: ownerUserId },
        data: {
          roles: existingRoles,
          cityId: application.cityId,
          primaryRole: existingClaims.primaryRole || 'franchise_owner',
          status: 'ACTIVE',
        },
      });
    } catch (claimsErr) {
      logger.error({ err: claimsErr }, 'Failed to set Firebase claims for franchise application');
    }

    return { application: updatedApp, franchise };
  }

  /**
   * List applications with optional status filter
   */
  async listApplications(filters?: { status?: string; cityId?: string }) {
    return this.prisma.franchiseApplication.findMany({
      where: {
        ...(filters?.status && { status: filters.status }),
        ...(filters?.cityId && { cityId: filters.cityId }),
      },
      include: { city: { select: { cityName: true, state: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get application details
   */
  async getApplication(applicationId: string) {
    const app = await this.prisma.franchiseApplication.findUnique({
      where: { id: applicationId },
      include: { city: { select: { cityName: true, state: true } } },
    });

    if (!app) {
      throw new BusinessError(ErrorCodes.BUSINESS_FRANCHISE_NOT_FOUND, 'Application not found', 404);
    }

    return app;
  }
}
