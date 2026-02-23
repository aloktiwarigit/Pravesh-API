// Story 6.11c: Document completion service for workflow integration
import { PrismaClient } from '@prisma/client';

export class DocumentCompletionService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Checks if all required documents from all stakeholders are uploaded.
   * Used by workflow engine to determine if service can proceed to next step.
   */
  async areAllDocumentsComplete(serviceInstanceId: string): Promise<boolean> {
    const stakeholders = await this.prisma.serviceStakeholder.findMany({
      where: { serviceInstanceId },
    });

    if (stakeholders.length === 0) {
      // No multi-party — check standard document completion
      return this.checkStandardCompletion(serviceInstanceId);
    }

    // Check each stakeholder has all required docs
    const requiredDocs = await this._getRequiredDocuments(serviceInstanceId);

    for (const stakeholder of stakeholders) {
      const requiredForRole = requiredDocs.filter(
        (d: any) => !d.required_from || d.required_from === 'all' || d.required_from === stakeholder.relationship,
      );

      const uploadedCount = await this.prisma.document.count({
        where: {
          serviceInstanceId,
          stakeholderId: stakeholder.id,
          verificationStatus: { in: ['verified', 'pending'] },
        },
      });

      if (uploadedCount < requiredForRole.length) return false;
    }

    return true;
  }

  /**
   * Get completion summary for ops/agent view
   */
  async getCompletionSummary(serviceInstanceId: string) {
    const stakeholders = await this.prisma.serviceStakeholder.findMany({
      where: { serviceInstanceId },
    });

    const requiredDocs = await this._getRequiredDocuments(serviceInstanceId);
    let totalRequired = 0;
    let totalUploaded = 0;

    const perStakeholder = [];

    for (const stakeholder of stakeholders) {
      const requiredForRole = requiredDocs.filter(
        (d: any) => !d.required_from || d.required_from === 'all' || d.required_from === stakeholder.relationship,
      );

      const uploadedCount = await this.prisma.document.count({
        where: { serviceInstanceId, stakeholderId: stakeholder.id },
      });

      totalRequired += requiredForRole.length;
      totalUploaded += uploadedCount;

      perStakeholder.push({
        stakeholder_id: stakeholder.id,
        name: stakeholder.name,
        relationship: stakeholder.relationship,
        required: requiredForRole.length,
        uploaded: uploadedCount,
        complete: uploadedCount >= requiredForRole.length,
      });
    }

    return {
      total_required: totalRequired,
      total_uploaded: totalUploaded,
      completion_percentage: totalRequired > 0 ? Math.round((totalUploaded / totalRequired) * 100) : 0,
      all_complete: totalUploaded >= totalRequired,
      per_stakeholder: perStakeholder,
    };
  }

  private async checkStandardCompletion(serviceInstanceId: string): Promise<boolean> {
    const requiredDocs = await this._getRequiredDocuments(serviceInstanceId);
    const uploadedCount = await this.prisma.document.count({
      where: { serviceInstanceId },
    });

    return uploadedCount >= requiredDocs.length;
  }

  private async _getRequiredDocuments(serviceInstanceId: string): Promise<any[]> {
    const serviceInstance = await this.prisma.serviceInstance.findUnique({
      where: { id: serviceInstanceId },
      select: { serviceDefinitionId: true },
    });

    if (!serviceInstance) {
      return [
        { doc_type: 'identity_proof' },
        { doc_type: 'property_document' },
      ];
    }

    const serviceDefinition = await this.prisma.serviceDefinition.findUnique({
      where: { id: serviceInstance.serviceDefinitionId },
      select: { definition: true },
    });

    if (!serviceDefinition) {
      return [
        { doc_type: 'identity_proof' },
        { doc_type: 'property_document' },
      ];
    }

    const definition = serviceDefinition.definition as any;
    const requiredDocuments: any[] =
      definition?.required_documents ??
      definition?.documents ??
      definition?.steps?.flatMap((s: any) => s.requiredDocuments ?? s.required_documents ?? []) ??
      [];

    if (requiredDocuments.length === 0) {
      return [
        { doc_type: 'identity_proof' },
        { doc_type: 'property_document' },
      ];
    }

    return requiredDocuments;
  }
}
