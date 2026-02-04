// Story 6.2 + 6.3 + 6.6 + 6.7 + 6.8 + 6.9 + 6.11b + 6.14: Document Management Service
import { PrismaClient } from '@prisma/client';
import { getStorage } from 'firebase-admin/storage';
import { getFirestore } from 'firebase-admin/firestore';
import { CreateDocumentInput, OverrideVerificationInput } from './documents.types.js';
import { DOCUMENT_VERIFY_JOB } from '../../shared/queue/jobs/document-verify.job.js';
import { DOCUMENT_DELIVERY_JOB } from '../../shared/queue/jobs/document-delivery.job.js';
import { isCriticalDocument } from './document-config.js';

export class DocumentsService {
  constructor(
    private prisma: PrismaClient,
    private boss: any, // PgBoss instance - namespace import cannot be used as type
  ) {}

  // ================================================================
  // Story 6.2: Create document record after upload
  // ================================================================
  async createDocument(input: CreateDocumentInput) {
    // Generate signed URL with 24-hour expiry (AC3)
    const bucket = getStorage().bucket();
    const file = bucket.file(input.storagePath);
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 24 * 60 * 60 * 1000,
    });

    const document = await this.prisma.document.create({
      data: {
        serviceInstanceId: input.serviceInstanceId,
        docType: input.docType,
        storagePath: input.storagePath,
        downloadUrl: input.downloadUrl,
        fileSize: input.fileSize,
        uploadedBy: input.uploadedBy,
        uploadedByUserId: input.uploadedByUserId,
        signedUrl,
        signedUrlExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        verificationStatus: input.uploadedBy === 'agent' ? 'verified' : 'pending',
        cityId: input.cityId,
        stakeholderId: input.stakeholderId,
        agentNotes: input.agentNotes,
        gpsLat: input.gpsLat,
        gpsLng: input.gpsLng,
      },
    });

    // Story 6.3: Queue AI verification job for customer uploads
    if (document.verificationStatus === 'pending') {
      await this.boss.send(DOCUMENT_VERIFY_JOB, {
        documentId: document.id,
      }, {
        retryLimit: 3,
        retryDelay: 10,
        retryBackoff: true,
        expireInMinutes: 5,
        priority: 1,
      });
    }

    // Story 6.7: Notify customer on agent upload
    if (input.uploadedBy === 'agent') {
      await this._notifyCustomerOnAgentUpload(input, document);
    }

    // Story 6.9: Trigger WhatsApp delivery for critical documents
    if (input.uploadedBy === 'agent' && isCriticalDocument(input.docType)) {
      await this._triggerWhatsAppDelivery(input, document);
    }

    // Story 6.11b: Notify primary customer on stakeholder upload
    if (input.stakeholderId) {
      await this._notifyPrimaryOnStakeholderUpload(input);
    }

    return document;
  }

  // ================================================================
  // Story 6.2: Document retrieval methods
  // ================================================================
  async getDocumentsByServiceInstance(serviceInstanceId: string) {
    return this.prisma.document.findMany({
      where: { serviceInstanceId },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  async getDocumentById(id: string) {
    return this.prisma.document.findUnique({ where: { id } });
  }

  // ================================================================
  // Story 6.2: Document checklist (maps required docs to upload status)
  // ================================================================
  async getDocumentChecklist(serviceInstanceId: string) {
    const uploadedDocs = await this.prisma.document.findMany({
      where: { serviceInstanceId },
    });

    // Get required documents from service definition
    const requiredDocs = await this._getRequiredDocuments(serviceInstanceId);

    return requiredDocs.map((doc: any) => {
      const uploaded = uploadedDocs.filter((d) => d.docType === doc.doc_type);
      return {
        doc_type: doc.doc_type,
        name_en: doc.name_en || doc.doc_type,
        name_hi: doc.name_hi || doc.doc_type,
        description_en: doc.description_en || '',
        description_hi: doc.description_hi || '',
        example_thumbnail_url: doc.example_thumbnail_url,
        status: uploaded.length > 0
          ? uploaded.some((d) => d.verificationStatus === 'verified')
            ? 'verified'
            : uploaded.some((d) => d.verificationStatus === 'rejected')
              ? 'rejected'
              : 'uploaded'
          : 'pending',
        uploaded_files: uploaded.map((d) => ({
          file_id: d.id,
          storage_path: d.storagePath,
          download_url: d.downloadUrl,
          file_size: d.fileSize,
          uploaded_at: d.uploadedAt,
        })),
        rejection_reason: uploaded.find((d) => d.rejectionReason)?.rejectionReason,
      };
    });
  }

  // ================================================================
  // Story 6.2: Signed URL refresh
  // ================================================================
  async refreshSignedUrl(documentId: string) {
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!doc) throw new Error('Document not found');

    const bucket = getStorage().bucket();
    const file = bucket.file(doc.storagePath);
    const [signedUrl] = await file.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + 24 * 60 * 60 * 1000,
    });

    return this.prisma.document.update({
      where: { id: documentId },
      data: {
        signedUrl,
        signedUrlExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  }

  // ================================================================
  // Story 6.2: Delete document from storage and database
  // ================================================================
  async deleteDocument(id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new Error('Document not found');

    const bucket = getStorage().bucket();
    try {
      await bucket.file(doc.storagePath).delete();
    } catch (e) {
      // File may already be deleted from storage
    }

    return this.prisma.document.delete({ where: { id } });
  }

  // ================================================================
  // Story 6.2: Update verification status (used by AI verification job)
  // ================================================================
  async updateVerificationStatus(
    id: string,
    status: string,
    result?: any,
    rejectionReason?: string,
  ) {
    return this.prisma.document.update({
      where: { id },
      data: {
        verificationStatus: status,
        aiVerificationResult: result || undefined,
        rejectionReason: rejectionReason || undefined,
      },
    });
  }

  // ================================================================
  // Story 6.6: Override AI verification result
  // ================================================================
  async overrideVerification(input: OverrideVerificationInput) {
    const doc = await this.prisma.document.findUnique({ where: { id: input.documentId } });
    if (!doc) throw new Error('Document not found');

    const newStatus = input.action === 'approve' ? 'verified' : 'rejected';
    const rejectionReason = input.action === 'reject'
      ? `${input.reasonCategory}: ${input.notes || ''}`
      : null;

    // Update document with override info
    const updated = await this.prisma.document.update({
      where: { id: input.documentId },
      data: {
        verificationStatus: newStatus,
        rejectionReason,
        verificationOverriddenBy: input.overriddenBy,
        verificationOverriddenAt: new Date(),
      },
    });

    // Mark ops review task as completed
    await this.prisma.opsReviewTask.updateMany({
      where: { resourceId: input.documentId, resourceType: 'document' },
      data: { status: 'completed', completedAt: new Date() },
    });

    // Flag AI for accuracy tracking
    if (input.flagAiIncorrect) {
      await this.prisma.aiAccuracyFlag.create({
        data: {
          documentId: input.documentId,
          originalAiResult: doc.aiVerificationResult as any || {},
          humanDecision: newStatus,
          flaggedBy: input.overriddenBy,
          notes: input.notes || '',
        },
      });
    }

    // Notify customer via push + WhatsApp
    await this.boss.send('notification.send', {
      userId: doc.uploadedByUserId,
      templateId: newStatus === 'verified' ? 'document-verified' : 'document-rejected',
      channel: 'fcm',
      data: {
        documentType: doc.docType,
        serviceInstanceId: doc.serviceInstanceId,
        status: newStatus,
      },
    });

    await this.boss.send('notification.send', {
      userId: doc.uploadedByUserId,
      templateId: newStatus === 'verified' ? 'document-verified-wa' : 'document-rejected-wa',
      channel: 'whatsapp',
      data: {
        documentType: doc.docType,
        serviceInstanceId: doc.serviceInstanceId,
        rejectionReason: rejectionReason || '',
      },
    });

    // Update Firestore for real-time UI
    const firestore = getFirestore();
    await firestore
      .collection('service_events')
      .doc(doc.serviceInstanceId)
      .collection('document_statuses')
      .doc(doc.id)
      .set({ verification_status: newStatus, updated_at: new Date().toISOString() });

    return updated;
  }

  // ================================================================
  // Story 6.6: Get ops review queue
  // ================================================================
  async getReviewQueue(cityId: string) {
    return this.prisma.opsReviewTask.findMany({
      where: { type: 'document_review', status: 'pending', cityId },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ================================================================
  // Story 6.8: Get all documents for a user (document vault)
  // ================================================================
  async getDocumentsForUser(userId: string) {
    return this.prisma.document.findMany({
      where: {
        OR: [
          { uploadedByUserId: userId },
        ],
      },
      orderBy: { uploadedAt: 'desc' },
    });
  }

  // ================================================================
  // Story 6.11b: Stakeholder-scoped checklist
  // ================================================================
  async getStakeholderChecklist(
    serviceInstanceId: string,
    stakeholderId: string,
    relationship: string,
  ) {
    const requiredDocs = await this._getRequiredDocuments(serviceInstanceId);

    // Filter by stakeholder role/relationship
    const stakeholderDocs = requiredDocs.filter((doc: any) =>
      !doc.required_from || doc.required_from === 'all' || doc.required_from === relationship,
    );

    // Get this stakeholder's uploads only
    const uploadedDocs = await this.prisma.document.findMany({
      where: { serviceInstanceId, stakeholderId },
    });

    return stakeholderDocs.map((doc: any) => {
      const uploaded = uploadedDocs.filter((d) => d.docType === doc.doc_type);
      return {
        doc_type: doc.doc_type,
        name_en: doc.name_en || doc.doc_type,
        name_hi: doc.name_hi || doc.doc_type,
        status: uploaded.length > 0
          ? uploaded.some((d) => d.verificationStatus === 'verified') ? 'verified' : 'uploaded'
          : 'pending',
        uploaded_files: uploaded.map((d) => ({
          file_id: d.id,
          download_url: d.downloadUrl,
          uploaded_at: d.uploadedAt,
        })),
      };
    });
  }

  // ================================================================
  // Story 6.11b: Per-stakeholder completion status
  // ================================================================
  async getPerStakeholderStatus(serviceInstanceId: string) {
    const stakeholders = await this.prisma.serviceStakeholder.findMany({
      where: { serviceInstanceId },
    });

    const requiredDocs = await this._getRequiredDocuments(serviceInstanceId);
    const statuses = [];

    for (const stakeholder of stakeholders) {
      const uploaded = await this.prisma.document.count({
        where: { serviceInstanceId, stakeholderId: stakeholder.id },
      });
      const total = requiredDocs.filter((d: any) =>
        !d.required_from || d.required_from === 'all' || d.required_from === stakeholder.relationship,
      ).length;

      statuses.push({
        stakeholder_id: stakeholder.id,
        stakeholder_name: stakeholder.name,
        relationship: stakeholder.relationship,
        uploaded_count: uploaded,
        required_count: total,
        completion_percentage: total > 0 ? Math.round((uploaded / total) * 100) : 0,
      });
    }

    return statuses;
  }

  // ================================================================
  // Story 6.14: Request archived document retrieval
  // ================================================================
  async requestRetrieval(documentId: string) {
    await this.boss.send('document.retrieve-archived', {
      documentId,
    }, {
      retryLimit: 3,
      retryBackoff: true,
    });
  }

  // ================================================================
  // Private helpers
  // ================================================================
  private async _getRequiredDocuments(serviceInstanceId: string): Promise<any[]> {
    // In production, this would query service_definitions JSONB
    // For now return empty array - populated from service_definitions.definition.required_documents
    return [];
  }

  private async _notifyCustomerOnAgentUpload(input: CreateDocumentInput, document: any) {
    // Send push notification to customer about new document
    await this.boss.send('notification.send', {
      userId: input.uploadedByUserId, // Will be resolved to customer in notification handler
      templateId: 'agent-document-uploaded',
      channel: 'fcm',
      data: {
        documentType: input.docType,
        serviceInstanceId: input.serviceInstanceId,
      },
    });

    // Write to Firestore for real-time customer UI
    const firestore = getFirestore();
    await firestore
      .collection('service_events')
      .doc(input.serviceInstanceId)
      .collection('document_statuses')
      .doc(document.id)
      .set({
        verification_status: 'verified',
        uploaded_by: 'agent',
        updated_at: new Date().toISOString(),
      });
  }

  private async _triggerWhatsAppDelivery(input: CreateDocumentInput, document: any) {
    await this.boss.send(DOCUMENT_DELIVERY_JOB, {
      documentId: document.id,
      customerId: input.uploadedByUserId,
      serviceInstanceId: input.serviceInstanceId,
    }, {
      retryLimit: 3,
      retryBackoff: true,
    });
  }

  private async _notifyPrimaryOnStakeholderUpload(input: CreateDocumentInput) {
    const stakeholder = input.stakeholderId
      ? await this.prisma.serviceStakeholder.findUnique({ where: { id: input.stakeholderId } })
      : null;
    const primary = await this.prisma.serviceStakeholder.findFirst({
      where: { serviceInstanceId: input.serviceInstanceId, role: 'primary' },
    });

    if (primary?.userId) {
      await this.boss.send('notification.send', {
        userId: primary.userId,
        templateId: 'stakeholder-document-uploaded',
        channel: 'fcm',
        data: {
          stakeholderName: stakeholder?.name,
          documentType: input.docType,
          serviceInstanceId: input.serviceInstanceId,
        },
      });
    }
  }
}
