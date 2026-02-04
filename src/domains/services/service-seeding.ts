// Stories 5-2, 5-3a/b, 5-4: Service Definition Seeding
// Seeds the 34 property legal services from the master catalog.
// Each service becomes a JSONB service definition in PostgreSQL.

import { PrismaClient } from '@prisma/client';
import type { ServiceDefinitionJson } from './service-definition.types.js';

// ============================================================
// Service Catalog — Seed Data
// ============================================================

const PRE_PURCHASE_SERVICES: ServiceDefinitionJson[] = [
  {
    serviceCode: 'title-search',
    serviceName: 'Title Search / Khatauni Verification',
    category: 'pre_purchase',
    description:
      'Complete title chain verification from revenue records, encumbrance check, and ownership validation.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect property documents from customer',
        estimatedDays: 1,
        requiredDocuments: [
          { code: 'SALE_DEED', name: 'Sale Deed', isMandatory: true, source: 'customer' },
          { code: 'KHATAUNI', name: 'Khatauni', isMandatory: false, source: 'customer' },
        ],
        agentActions: ['photo_evidence', 'gps_evidence'],
      },
      {
        index: 1,
        name: 'Revenue Office Visit',
        description: 'Verify records at Tehsil/revenue office',
        estimatedDays: 3,
        governmentOffice: { officeName: 'Tehsil Office', department: 'Revenue' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 2,
        name: 'Encumbrance Check',
        description: 'Check for liens, mortgages, pending litigation',
        estimatedDays: 2,
        governmentOffice: { officeName: 'Sub-Registrar Office' },
      },
      {
        index: 3,
        name: 'Title Report Preparation',
        description: 'Compile findings into title search report',
        estimatedDays: 2,
        outputDocuments: [
          { code: 'TITLE_REPORT', name: 'Title Search Report', isMandatory: true, source: 'agent' },
        ],
      },
      {
        index: 4,
        name: 'Customer Delivery',
        description: 'Deliver report and explain findings to customer',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'SALE_DEED', name: 'Sale Deed', isMandatory: true, source: 'customer' },
      { code: 'AADHAAR_MASKED', name: 'Aadhaar (Masked)', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 500000,
      govtFeeEstimatePaise: 200000,
      totalEstimatePaise: 700000,
    },
    governmentOffices: [
      { officeName: 'Tehsil Office', department: 'Revenue' },
      { officeName: 'Sub-Registrar Office' },
    ],
    estimatedDaysTotal: 9,
    slaBusinessDays: 12,
    tags: ['title', 'verification', 'pre-purchase'],
  },
  {
    serviceCode: 'encumbrance-certificate',
    serviceName: 'Encumbrance Certificate',
    category: 'pre_purchase',
    description: 'Obtain encumbrance certificate from Sub-Registrar office.',
    steps: [
      {
        index: 0,
        name: 'Application Filing',
        description: 'File application at Sub-Registrar office',
        estimatedDays: 1,
        governmentOffice: { officeName: 'Sub-Registrar Office' },
        agentActions: ['gps_evidence'],
      },
      {
        index: 1,
        name: 'Processing',
        description: 'Government processing period',
        estimatedDays: 5,
      },
      {
        index: 2,
        name: 'Certificate Collection',
        description: 'Collect EC from office',
        estimatedDays: 1,
        outputDocuments: [
          { code: 'EC', name: 'Encumbrance Certificate', isMandatory: true, source: 'government' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 3,
        name: 'Customer Delivery',
        description: 'Deliver certificate to customer',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'PROPERTY_DETAILS', name: 'Property Details', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 300000,
      govtFeeEstimatePaise: 50000,
      totalEstimatePaise: 350000,
    },
    governmentOffices: [{ officeName: 'Sub-Registrar Office' }],
    estimatedDaysTotal: 8,
    slaBusinessDays: 10,
    tags: ['encumbrance', 'certificate', 'pre-purchase'],
  },
];

const PURCHASE_SERVICES: ServiceDefinitionJson[] = [
  {
    serviceCode: 'sale-deed-registration',
    serviceName: 'Sale Deed Registration',
    category: 'purchase',
    description: 'End-to-end sale deed drafting and registration at Sub-Registrar office.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect all required documents from buyer and seller',
        estimatedDays: 2,
        requiredDocuments: [
          { code: 'BUYER_AADHAAR', name: 'Buyer Aadhaar (Masked)', isMandatory: true, source: 'customer' },
          { code: 'SELLER_AADHAAR', name: 'Seller Aadhaar (Masked)', isMandatory: true, source: 'customer' },
          { code: 'PREVIOUS_DEED', name: 'Previous Sale Deed', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Stamp Duty Payment',
        description: 'Calculate and pay stamp duty',
        estimatedDays: 1,
        agentActions: ['photo_evidence'],
      },
      {
        index: 2,
        name: 'Deed Drafting',
        description: 'Draft sale deed document',
        estimatedDays: 3,
        outputDocuments: [
          { code: 'SALE_DEED_DRAFT', name: 'Sale Deed Draft', isMandatory: true, source: 'agent' },
        ],
      },
      {
        index: 3,
        name: 'Registration Appointment',
        description: 'Book and attend Sub-Registrar appointment',
        estimatedDays: 2,
        governmentOffice: { officeName: 'Sub-Registrar Office' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 4,
        name: 'Registration Complete',
        description: 'Collect registered deed',
        estimatedDays: 3,
        outputDocuments: [
          { code: 'REGISTERED_DEED', name: 'Registered Sale Deed', isMandatory: true, source: 'government' },
        ],
      },
      {
        index: 5,
        name: 'Customer Delivery',
        description: 'Deliver registered deed to buyer',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'BUYER_AADHAAR', name: 'Buyer Aadhaar (Masked)', isMandatory: true, source: 'customer' },
      { code: 'SELLER_AADHAAR', name: 'Seller Aadhaar (Masked)', isMandatory: true, source: 'customer' },
      { code: 'PREVIOUS_DEED', name: 'Previous Sale Deed', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 1500000,
      govtFeeEstimatePaise: 0,
      totalEstimatePaise: 1500000,
      stampDutyPercent: 7,
      registrationPercent: 1,
    },
    governmentOffices: [
      { officeName: 'Sub-Registrar Office' },
      { officeName: 'Stamp Duty Office' },
    ],
    estimatedDaysTotal: 12,
    slaBusinessDays: 15,
    tags: ['registration', 'sale-deed', 'purchase'],
  },
];

const POST_PURCHASE_SERVICES: ServiceDefinitionJson[] = [
  {
    serviceCode: 'lda-mutation',
    serviceName: 'LDA Mutation / Name Transfer',
    category: 'post_purchase',
    description: 'Property name transfer (mutation) at LDA/municipal authority.',
    steps: [
      {
        index: 0,
        name: 'Application Preparation',
        description: 'Prepare mutation application with documents',
        estimatedDays: 1,
        requiredDocuments: [
          { code: 'REGISTERED_DEED', name: 'Registered Sale Deed', isMandatory: true, source: 'customer' },
        ],
      },
      {
        index: 1,
        name: 'LDA Filing',
        description: 'File mutation application at LDA office',
        estimatedDays: 1,
        governmentOffice: { officeName: 'LDA Office', department: 'Revenue' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 2,
        name: 'Verification & Objection Period',
        description: 'LDA processes application, objection period',
        estimatedDays: 15,
      },
      {
        index: 3,
        name: 'Hearing (if required)',
        description: 'Attend hearing if objections raised',
        estimatedDays: 2,
        agentActions: ['gps_evidence'],
      },
      {
        index: 4,
        name: 'Mutation Order',
        description: 'Collect mutation order from LDA',
        estimatedDays: 3,
        outputDocuments: [
          { code: 'MUTATION_ORDER', name: 'Mutation Order', isMandatory: true, source: 'government' },
        ],
      },
      {
        index: 5,
        name: 'Customer Delivery',
        description: 'Deliver mutation order to customer',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'REGISTERED_DEED', name: 'Registered Sale Deed', isMandatory: true, source: 'customer' },
      { code: 'AADHAAR_MASKED', name: 'Aadhaar (Masked)', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 800000,
      govtFeeEstimatePaise: 500000,
      totalEstimatePaise: 1300000,
    },
    governmentOffices: [{ officeName: 'LDA Office', department: 'Revenue' }],
    estimatedDaysTotal: 23,
    slaBusinessDays: 30,
    tags: ['mutation', 'name-transfer', 'post-purchase'],
  },
];

// Full catalog array (add more services here as needed)
export const SERVICE_CATALOG: ServiceDefinitionJson[] = [
  ...PRE_PURCHASE_SERVICES,
  ...PURCHASE_SERVICES,
  ...POST_PURCHASE_SERVICES,
];

// ============================================================
// Seeding Functions
// ============================================================

/**
 * Seed all service definitions into the database.
 * Idempotent: skips existing definitions by serviceCode.
 */
export async function seedServiceDefinitions(prisma: PrismaClient) {
  const results: Array<{ code: string; action: 'created' | 'skipped' }> = [];

  for (const def of SERVICE_CATALOG) {
    const existing = await prisma.serviceDefinition.findFirst({
      where: { code: def.serviceCode },
    });

    if (existing) {
      results.push({ code: def.serviceCode, action: 'skipped' });
      continue;
    }

    await prisma.serviceDefinition.create({
      data: {
        code: def.serviceCode,
        name: def.serviceName,
        category: def.category,
        definition: def as any,
        isActive: true,
        cityId: 'default', // TODO: resolve actual city ID during seeding
      },
    });

    results.push({ code: def.serviceCode, action: 'created' });
  }

  return results;
}

/**
 * Update an existing service definition (preserves ID).
 * Used for adding city-specific overrides or updating steps.
 */
export async function updateServiceDefinition(
  prisma: PrismaClient,
  serviceCode: string,
  updates: Partial<ServiceDefinitionJson>,
) {
  const existing = await prisma.serviceDefinition.findFirst({
    where: { code: serviceCode },
  });

  if (!existing) {
    throw new Error(`Service definition not found: ${serviceCode}`);
  }

  const currentDef = existing.definition as any;
  const mergedDef = { ...currentDef, ...updates };

  return prisma.serviceDefinition.update({
    where: { id: existing.id },
    data: {
      definition: mergedDef as any,
      name: updates.serviceName || existing.name,
    },
  });
}

/**
 * Create a city-specific variant of a service definition.
 */
export async function createCityVariant(
  prisma: PrismaClient,
  baseServiceCode: string,
  cityId: string,
  overrides: Partial<ServiceDefinitionJson>,
) {
  const base = await prisma.serviceDefinition.findFirst({
    where: { code: baseServiceCode },
  });

  if (!base) {
    throw new Error(`Base service not found: ${baseServiceCode}`);
  }

  const baseDef = base.definition as any;
  const cityCode = `${baseServiceCode}-${cityId}`;
  const cityDef = { ...baseDef, ...overrides, serviceCode: cityCode };

  return prisma.serviceDefinition.create({
    data: {
      code: cityCode,
      name: overrides.serviceName || base.name,
      category: base.category,
      definition: cityDef as any,
      isActive: true,
      cityId,
      // parentDefinitionId not in schema — parent reference stored in definition JSONB
    },
  });
}
