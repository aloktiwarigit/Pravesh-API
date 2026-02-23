// Story 13-15: NRI Document Coordination Workflow Service
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const RECOMMENDED_COURIERS = [
  {
    name: 'DHL Express',
    website: 'https://www.dhl.com',
    trackingUrl:
      'https://www.dhl.com/en/express/tracking.html?AWB=',
  },
  {
    name: 'FedEx International',
    website: 'https://www.fedex.com',
    trackingUrl: 'https://www.fedex.com/fedextrack/?trknbr=',
  },
  {
    name: 'India Post Speed Post',
    website: 'https://www.indiapost.gov.in',
    trackingUrl:
      'https://www.indiapost.gov.in/VAS/Pages/trackconsignment.aspx',
  },
  {
    name: 'Blue Dart',
    website: 'https://www.bluedart.com',
    trackingUrl:
      'https://www.bluedart.com/tracking?handler=tnt&action=awbquery&awb=query&numbers=',
  },
];

export class NriDocumentCoordinationService {
  constructor(
    private prisma: PrismaClient,
    private boss: any // PgBoss instance - namespace import cannot be used as type
  ) {}

  async uploadScannedCopy(params: {
    serviceRequestId: string;
    customerId: string;
    documentType: string;
    scannedCopyUrl: string;
    cityId: string;
  }) {
    return this.prisma.nriDocumentSubmission.create({
      data: {
        id: crypto.randomUUID(),
        serviceRequestId: params.serviceRequestId,
        customerId: params.customerId,
        documentType: params.documentType,
        scannedCopyUrl: params.scannedCopyUrl,
        scannedCopyStatus: 'pending',
        cityId: params.cityId,
      },
    });
  }

  async verifyScannedCopy(params: {
    submissionId: string;
    approved: boolean;
    notes?: string;
    agentId: string;
  }) {
    const submission =
      await this.prisma.nriDocumentSubmission.update({
        where: { id: params.submissionId },
        data: {
          scannedCopyStatus: params.approved
            ? 'approved'
            : 'rejected',
          scannedCopyNotes: params.notes || null,
          verifiedByAgentId: params.agentId,
        },
      });

    if (params.approved) {
      // Notify customer with courier instructions
      await this.boss.send('notification.send', {
        type: 'nri_scan_approved_courier_instructions',
        customerId: submission.customerId,
        submissionId: submission.id,
        documentType: submission.documentType,
      });
    } else {
      await this.boss.send('notification.send', {
        type: 'nri_scan_rejected',
        customerId: submission.customerId,
        reason: params.notes,
      });
    }

    return submission;
  }

  getCourierInstructions(cityId: string) {
    return {
      couriers: RECOMMENDED_COURIERS,
      deliveryAddress:
        'Property Legal Agent Office, [City Address]',
      referenceFormat: 'NRI-DOC-{serviceRequestId}',
      instructions: [
        'Ship originals via any recommended courier service.',
        'Include the reference number on the package.',
        'Upload the tracking number in the app for real-time tracking.',
        'Estimated delivery: 5-10 business days depending on country.',
      ],
    };
  }

  async updateCourierTracking(params: {
    submissionId: string;
    courierService: string;
    trackingNumber: string;
    shippedDate: Date;
  }) {
    return this.prisma.nriDocumentSubmission.update({
      where: { id: params.submissionId },
      data: {
        courierService: params.courierService,
        courierTrackingNumber: params.trackingNumber,
        courierShippedDate: params.shippedDate,
        courierStatus: 'shipped',
      },
    });
  }

  async confirmOriginalReceipt(params: {
    submissionId: string;
    matchesScan: boolean;
    mismatchNotes?: string;
    agentId: string;
  }) {
    const submission =
      await this.prisma.nriDocumentSubmission.update({
        where: { id: params.submissionId },
        data: {
          originalReceivedDate: new Date(),
          originalMatchesScan: params.matchesScan,
          mismatchNotes: params.mismatchNotes || null,
          courierStatus: 'received_by_agent',
          verifiedByAgentId: params.agentId,
        },
      });

    if (params.matchesScan) {
      await this.boss.send('notification.send', {
        type: 'nri_originals_received_matched',
        customerId: submission.customerId,
      });
    } else {
      // Trigger halt through workflow job
      await this.boss.send('workflow.halt', {
        serviceRequestId: submission.serviceRequestId,
        reason: 'halted_document_mismatch',
      });

      await this.boss.send('notification.send', {
        type: 'nri_originals_mismatch',
        customerId: submission.customerId,
        mismatchNotes: params.mismatchNotes,
      });
    }

    return submission;
  }

  async grantProvisionalCompletion(params: {
    serviceRequestId: string;
    opsUserId: string;
  }) {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);

    await this.prisma.nriDocumentSubmission.updateMany({
      where: {
        serviceRequestId: params.serviceRequestId,
        originalRequired: true,
        originalReceivedDate: null,
      },
      data: {
        provisionalApproval: true,
        provisionalDeadline: deadline,
      },
    });

    // Schedule deadline reminder (7 days before)
    const reminderDate = new Date(deadline);
    reminderDate.setDate(reminderDate.getDate() - 7);
    await this.boss.send(
      'notification.send',
      {
        type: 'nri_provisional_deadline_reminder',
        serviceRequestId: params.serviceRequestId,
      },
      { startAfter: reminderDate }
    );

    return { provisionalDeadline: deadline };
  }

  async getDocumentTimeline(serviceRequestId: string) {
    return this.prisma.nriDocumentSubmission.findMany({
      where: { serviceRequestId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
