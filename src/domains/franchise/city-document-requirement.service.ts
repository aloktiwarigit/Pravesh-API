import { PrismaClient } from '@prisma/client';
import { cityDocumentsSchema, DocumentRequirement } from './franchise.types';
import { BusinessError } from '../../shared/errors/business-error';
import * as ErrorCodes from '../../shared/errors/error-codes';

/**
 * Story 14-4: City-Specific Document Requirements
 *
 * Manages document requirements per city per service.
 * Zero code changes needed to add new document types (NFR24).
 * Customers and agents see city-specific document checklists.
 */
export class CityDocumentRequirementService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Create or update document requirements for a city + service
   */
  async upsertDocumentRequirements(params: {
    cityId: string;
    serviceDefinitionId: string;
    documents: DocumentRequirement[];
    createdBy: string;
  }) {
    cityDocumentsSchema.parse({ documents: params.documents });

    const existing = await this.prisma.cityDocumentRequirement.findUnique({
      where: {
        cityId_serviceDefinitionId: {
          cityId: params.cityId,
          serviceDefinitionId: params.serviceDefinitionId,
        },
      },
    });

    if (existing) {
      return this.prisma.cityDocumentRequirement.update({
        where: { id: existing.id },
        data: {
          documents: params.documents as any,
          version: { increment: 1 },
        },
      });
    }

    return this.prisma.cityDocumentRequirement.create({
      data: {
        cityId: params.cityId,
        serviceDefinitionId: params.serviceDefinitionId,
        documents: params.documents as any,
        createdBy: params.createdBy,
      },
    });
  }

  /**
   * Get document requirements for a city + service
   * Returns city-specific requirements, or empty array if none configured
   */
  async getDocumentRequirements(cityId: string, serviceDefinitionId: string): Promise<DocumentRequirement[]> {
    const record = await this.prisma.cityDocumentRequirement.findUnique({
      where: {
        cityId_serviceDefinitionId: {
          cityId,
          serviceDefinitionId,
        },
      },
    });

    if (!record || !record.isActive) {
      return [
        {
          documentName: 'identity_proof',
          description: 'Government-issued ID',
          isMandatory: true,
          acceptedFormats: ['PDF', 'JPG', 'PNG', 'JPEG'],
          maxFileSizeMb: 10,
        },
        {
          documentName: 'property_document',
          description: 'Property ownership proof',
          isMandatory: true,
          acceptedFormats: ['PDF', 'JPG', 'PNG', 'JPEG'],
          maxFileSizeMb: 10,
        },
        {
          documentName: 'address_proof',
          description: 'Current address proof',
          isMandatory: true,
          acceptedFormats: ['PDF', 'JPG', 'PNG', 'JPEG'],
          maxFileSizeMb: 10,
        },
      ];
    }

    return record.documents as unknown as DocumentRequirement[];
  }

  /**
   * Validate a document submission against city-specific requirements
   */
  async validateDocumentSubmission(
    cityId: string,
    serviceDefinitionId: string,
    submittedDocuments: { documentName: string; format: string; fileSizeMb: number }[]
  ): Promise<{
    isValid: boolean;
    missingMandatory: string[];
    invalidFormat: string[];
    oversized: string[];
  }> {
    const requirements = await this.getDocumentRequirements(cityId, serviceDefinitionId);

    const missingMandatory: string[] = [];
    const invalidFormat: string[] = [];
    const oversized: string[] = [];

    for (const req of requirements) {
      const submitted = submittedDocuments.find(
        (d) => d.documentName === req.documentName
      );

      if (!submitted && req.isMandatory) {
        missingMandatory.push(req.documentName);
        continue;
      }

      if (submitted) {
        if (!req.acceptedFormats.includes(submitted.format.toUpperCase() as any)) {
          invalidFormat.push(req.documentName);
        }
        if (submitted.fileSizeMb > req.maxFileSizeMb) {
          oversized.push(req.documentName);
        }
      }
    }

    return {
      isValid: missingMandatory.length === 0 && invalidFormat.length === 0 && oversized.length === 0,
      missingMandatory,
      invalidFormat,
      oversized,
    };
  }

  /**
   * List all document requirements for a city
   */
  async listAllForCity(cityId: string) {
    return this.prisma.cityDocumentRequirement.findMany({
      where: { cityId, isActive: true },
      orderBy: { serviceDefinitionId: 'asc' },
    });
  }

  /**
   * Deactivate document requirements
   */
  async deactivate(id: string) {
    return this.prisma.cityDocumentRequirement.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
