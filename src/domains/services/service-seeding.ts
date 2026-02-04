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

// ============================================================
// Additional Pre-Purchase Services
// ============================================================

const ADDITIONAL_PRE_PURCHASE_SERVICES: ServiceDefinitionJson[] = [
  {
    serviceCode: 'property-valuation',
    serviceName: 'Property Valuation Report',
    category: 'pre_purchase',
    description:
      'Professional property valuation by certified valuers including physical inspection, market comparison, and detailed valuation report.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect property documents, previous sale deed, and area details from customer',
        estimatedDays: 1,
        requiredDocuments: [
          { code: 'SALE_DEED', name: 'Sale Deed / Allotment Letter', isMandatory: true, source: 'customer' },
          { code: 'PROPERTY_MAP', name: 'Property Map / Layout Plan', isMandatory: false, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Physical Site Inspection',
        description: 'Visit property for physical inspection, measurements, and neighbourhood assessment',
        estimatedDays: 2,
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 2,
        name: 'Market Analysis',
        description: 'Compare recent sale transactions in the area and circle rate verification at Tehsil',
        estimatedDays: 2,
        governmentOffice: { officeName: 'Tehsil Office', department: 'Revenue' },
      },
      {
        index: 3,
        name: 'Valuation Report Preparation',
        description: 'Prepare detailed valuation report with fair market value assessment',
        estimatedDays: 1,
        outputDocuments: [
          { code: 'VALUATION_REPORT', name: 'Property Valuation Report', isMandatory: true, source: 'agent' },
        ],
      },
      {
        index: 4,
        name: 'Customer Delivery',
        description: 'Deliver valuation report and explain findings to customer',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'SALE_DEED', name: 'Sale Deed / Allotment Letter', isMandatory: true, source: 'customer' },
      { code: 'PROPERTY_MAP', name: 'Property Map / Layout Plan', isMandatory: false, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 400000,
      govtFeeEstimatePaise: 50000,
      totalEstimatePaise: 450000,
    },
    governmentOffices: [{ officeName: 'Tehsil Office', department: 'Revenue' }],
    estimatedDaysTotal: 7,
    slaBusinessDays: 10,
    tags: ['valuation', 'pre-purchase', 'inspection'],
  },
  {
    serviceCode: 'society-noc',
    serviceName: 'Society NOC for Apartment Sale',
    category: 'pre_purchase',
    description:
      'Obtain No Objection Certificate from housing society/apartment association required for apartment resale transactions.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect society membership documents, maintenance receipts, and sale agreement draft',
        estimatedDays: 1,
        requiredDocuments: [
          { code: 'SOCIETY_MEMBERSHIP', name: 'Society Membership Certificate', isMandatory: true, source: 'customer' },
          { code: 'MAINTENANCE_RECEIPTS', name: 'Maintenance Payment Receipts', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Society Application',
        description: 'Submit NOC application to society secretary with required documents',
        estimatedDays: 1,
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 2,
        name: 'Society Verification',
        description: 'Society committee reviews application, verifies no pending dues',
        estimatedDays: 5,
      },
      {
        index: 3,
        name: 'NOC Issuance',
        description: 'Collect NOC from society office after committee approval',
        estimatedDays: 2,
        outputDocuments: [
          { code: 'SOCIETY_NOC', name: 'Society No Objection Certificate', isMandatory: true, source: 'agent' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 4,
        name: 'Customer Delivery',
        description: 'Deliver NOC to customer',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'SOCIETY_MEMBERSHIP', name: 'Society Membership Certificate', isMandatory: true, source: 'customer' },
      { code: 'MAINTENANCE_RECEIPTS', name: 'Maintenance Payment Receipts', isMandatory: true, source: 'customer' },
      { code: 'AADHAAR_MASKED', name: 'Aadhaar (Masked)', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 300000,
      govtFeeEstimatePaise: 100000,
      totalEstimatePaise: 400000,
    },
    governmentOffices: [],
    estimatedDaysTotal: 10,
    slaBusinessDays: 14,
    tags: ['society', 'noc', 'apartment', 'pre-purchase'],
  },
  {
    serviceCode: 'land-use-certificate',
    serviceName: 'Land Use Certificate',
    category: 'pre_purchase',
    description:
      'Obtain Land Use Certificate from development authority confirming the permissible use of land (residential, commercial, industrial).',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect property documents including survey number and ownership proof',
        estimatedDays: 1,
        requiredDocuments: [
          { code: 'SALE_DEED', name: 'Sale Deed / Ownership Proof', isMandatory: true, source: 'customer' },
          { code: 'SURVEY_MAP', name: 'Survey Map / Khasra', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Application Filing',
        description: 'File application at Development Authority / Town Planning office',
        estimatedDays: 1,
        governmentOffice: { officeName: 'Development Authority', department: 'Town Planning' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 2,
        name: 'Site Inspection by Authority',
        description: 'Development authority conducts site inspection and verifies land use zone',
        estimatedDays: 5,
        governmentOffice: { officeName: 'Development Authority', department: 'Town Planning' },
      },
      {
        index: 3,
        name: 'Processing & Issuance',
        description: 'Authority processes application and issues land use certificate',
        estimatedDays: 4,
        outputDocuments: [
          { code: 'LAND_USE_CERT', name: 'Land Use Certificate', isMandatory: true, source: 'government' },
        ],
      },
      {
        index: 4,
        name: 'Customer Delivery',
        description: 'Deliver certificate to customer with zoning explanation',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'SALE_DEED', name: 'Sale Deed / Ownership Proof', isMandatory: true, source: 'customer' },
      { code: 'SURVEY_MAP', name: 'Survey Map / Khasra', isMandatory: true, source: 'customer' },
      { code: 'AADHAAR_MASKED', name: 'Aadhaar (Masked)', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 500000,
      govtFeeEstimatePaise: 200000,
      totalEstimatePaise: 700000,
    },
    governmentOffices: [{ officeName: 'Development Authority', department: 'Town Planning' }],
    estimatedDaysTotal: 12,
    slaBusinessDays: 15,
    tags: ['land-use', 'zoning', 'certificate', 'pre-purchase'],
  },
  {
    serviceCode: 'conversion-certificate',
    serviceName: 'Agricultural to Non-Agricultural Conversion',
    category: 'pre_purchase',
    description:
      'Convert agricultural land to non-agricultural (NA) use for residential/commercial development through the District Collector office.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect land records, 7/12 extract, and ownership documents',
        estimatedDays: 2,
        requiredDocuments: [
          { code: 'LAND_RECORDS', name: '7/12 Extract / Khatauni', isMandatory: true, source: 'customer' },
          { code: 'SURVEY_MAP', name: 'Survey Map', isMandatory: true, source: 'customer' },
          { code: 'TAX_RECEIPTS', name: 'Land Tax Receipts', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Application Filing at Tehsil',
        description: 'File NA conversion application at Tehsil office with prescribed fee',
        estimatedDays: 2,
        governmentOffice: { officeName: 'Tehsil Office', department: 'Revenue' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 2,
        name: 'Site Inspection',
        description: 'Revenue inspector conducts site inspection and submits report',
        estimatedDays: 7,
        governmentOffice: { officeName: 'Tehsil Office', department: 'Revenue' },
      },
      {
        index: 3,
        name: 'District Collector Processing',
        description: 'Application forwarded to District Collector for approval',
        estimatedDays: 15,
        governmentOffice: { officeName: 'District Collector Office', department: 'Revenue' },
      },
      {
        index: 4,
        name: 'NA Order Collection',
        description: 'Collect NA conversion order after approval',
        estimatedDays: 3,
        outputDocuments: [
          { code: 'NA_ORDER', name: 'Non-Agricultural Conversion Order', isMandatory: true, source: 'government' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 5,
        name: 'Customer Delivery',
        description: 'Deliver NA conversion order to customer',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'LAND_RECORDS', name: '7/12 Extract / Khatauni', isMandatory: true, source: 'customer' },
      { code: 'SURVEY_MAP', name: 'Survey Map', isMandatory: true, source: 'customer' },
      { code: 'TAX_RECEIPTS', name: 'Land Tax Receipts', isMandatory: true, source: 'customer' },
      { code: 'AADHAAR_MASKED', name: 'Aadhaar (Masked)', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 800000,
      govtFeeEstimatePaise: 500000,
      totalEstimatePaise: 1300000,
    },
    governmentOffices: [
      { officeName: 'Tehsil Office', department: 'Revenue' },
      { officeName: 'District Collector Office', department: 'Revenue' },
    ],
    estimatedDaysTotal: 30,
    slaBusinessDays: 45,
    tags: ['conversion', 'agricultural', 'non-agricultural', 'pre-purchase'],
  },
  {
    serviceCode: 'legal-opinion',
    serviceName: 'Legal Opinion on Property',
    category: 'pre_purchase',
    description:
      'Comprehensive legal opinion on property title, encumbrances, litigation risks, and compliance by a qualified property lawyer.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect all property documents from customer for legal review',
        estimatedDays: 1,
        requiredDocuments: [
          { code: 'SALE_DEED', name: 'Sale Deed / Title Documents', isMandatory: true, source: 'customer' },
          { code: 'EC', name: 'Encumbrance Certificate', isMandatory: false, source: 'customer' },
          { code: 'TAX_RECEIPTS', name: 'Property Tax Receipts', isMandatory: false, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Title Chain Analysis',
        description: 'Analyze complete title chain and verify ownership history',
        estimatedDays: 2,
      },
      {
        index: 2,
        name: 'Legal Opinion Preparation',
        description: 'Prepare detailed legal opinion covering risks, title validity, and recommendations',
        estimatedDays: 1,
        outputDocuments: [
          { code: 'LEGAL_OPINION', name: 'Legal Opinion Report', isMandatory: true, source: 'agent' },
        ],
      },
      {
        index: 3,
        name: 'Customer Delivery',
        description: 'Deliver legal opinion and explain findings to customer',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'SALE_DEED', name: 'Sale Deed / Title Documents', isMandatory: true, source: 'customer' },
      { code: 'AADHAAR_MASKED', name: 'Aadhaar (Masked)', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 600000,
      govtFeeEstimatePaise: 0,
      totalEstimatePaise: 600000,
    },
    governmentOffices: [],
    estimatedDaysTotal: 5,
    slaBusinessDays: 7,
    tags: ['legal-opinion', 'due-diligence', 'pre-purchase'],
  },
  {
    serviceCode: 'property-tax-verification',
    serviceName: 'Property Tax Verification',
    category: 'pre_purchase',
    description:
      'Verify property tax payment history, outstanding dues, and assess current tax liability at Nagar Nigam / Municipal office.',
    steps: [
      {
        index: 0,
        name: 'Property Details Collection',
        description: 'Collect property ID, house number, and owner details from customer',
        estimatedDays: 1,
        requiredDocuments: [
          { code: 'PROPERTY_DETAILS', name: 'Property Details / House Tax ID', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Municipal Office Visit',
        description: 'Visit Nagar Nigam to verify tax records and check pending dues',
        estimatedDays: 2,
        governmentOffice: { officeName: 'Nagar Nigam', department: 'Property Tax' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 2,
        name: 'Verification Report',
        description: 'Prepare verification report with tax payment history and pending dues',
        estimatedDays: 1,
        outputDocuments: [
          { code: 'TAX_VERIFICATION', name: 'Property Tax Verification Report', isMandatory: true, source: 'agent' },
        ],
      },
      {
        index: 3,
        name: 'Customer Delivery',
        description: 'Deliver verification report to customer',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'PROPERTY_DETAILS', name: 'Property Details / House Tax ID', isMandatory: true, source: 'customer' },
      { code: 'AADHAAR_MASKED', name: 'Aadhaar (Masked)', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 250000,
      govtFeeEstimatePaise: 50000,
      totalEstimatePaise: 300000,
    },
    governmentOffices: [{ officeName: 'Nagar Nigam', department: 'Property Tax' }],
    estimatedDaysTotal: 5,
    slaBusinessDays: 7,
    tags: ['tax', 'verification', 'municipal', 'pre-purchase'],
  },
];

// ============================================================
// Additional Purchase Services
// ============================================================

const ADDITIONAL_PURCHASE_SERVICES: ServiceDefinitionJson[] = [
  {
    serviceCode: 'gift-deed-registration',
    serviceName: 'Gift Deed Registration',
    category: 'purchase',
    description:
      'Drafting and registration of gift deed for transferring property ownership without consideration, typically between family members.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect documents from donor and donee including identity and property proofs',
        estimatedDays: 2,
        requiredDocuments: [
          { code: 'DONOR_AADHAAR', name: 'Donor Aadhaar (Masked)', isMandatory: true, source: 'customer' },
          { code: 'DONEE_AADHAAR', name: 'Donee Aadhaar (Masked)', isMandatory: true, source: 'customer' },
          { code: 'PROPERTY_DEED', name: 'Existing Property Deed', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Gift Deed Drafting',
        description: 'Draft gift deed with appropriate clauses and conditions',
        estimatedDays: 2,
        outputDocuments: [
          { code: 'GIFT_DEED_DRAFT', name: 'Gift Deed Draft', isMandatory: true, source: 'agent' },
        ],
      },
      {
        index: 2,
        name: 'Stamp Duty Payment',
        description: 'Calculate and pay stamp duty (concessional rate for family transfers in many states)',
        estimatedDays: 1,
        agentActions: ['photo_evidence'],
      },
      {
        index: 3,
        name: 'Registration at Sub-Registrar',
        description: 'Register gift deed at Sub-Registrar office with donor and donee present',
        estimatedDays: 2,
        governmentOffice: { officeName: 'Sub-Registrar Office' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 4,
        name: 'Registered Deed Collection',
        description: 'Collect registered gift deed from Sub-Registrar office',
        estimatedDays: 2,
        outputDocuments: [
          { code: 'REGISTERED_GIFT_DEED', name: 'Registered Gift Deed', isMandatory: true, source: 'government' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 5,
        name: 'Customer Delivery',
        description: 'Deliver registered gift deed to donee',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'DONOR_AADHAAR', name: 'Donor Aadhaar (Masked)', isMandatory: true, source: 'customer' },
      { code: 'DONEE_AADHAAR', name: 'Donee Aadhaar (Masked)', isMandatory: true, source: 'customer' },
      { code: 'PROPERTY_DEED', name: 'Existing Property Deed', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 1000000,
      govtFeeEstimatePaise: 0,
      totalEstimatePaise: 1000000,
      stampDutyPercent: 5,
      registrationPercent: 1,
    },
    governmentOffices: [
      { officeName: 'Sub-Registrar Office' },
      { officeName: 'Stamp Duty Office' },
    ],
    estimatedDaysTotal: 10,
    slaBusinessDays: 14,
    tags: ['gift-deed', 'registration', 'purchase', 'family-transfer'],
  },
  {
    serviceCode: 'lease-deed-registration',
    serviceName: 'Lease Deed Registration',
    category: 'purchase',
    description:
      'Drafting and registration of lease deed for long-term property leases exceeding 11 months as required by law.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect documents from lessor and lessee',
        estimatedDays: 1,
        requiredDocuments: [
          { code: 'LESSOR_AADHAAR', name: 'Lessor Aadhaar (Masked)', isMandatory: true, source: 'customer' },
          { code: 'LESSEE_AADHAAR', name: 'Lessee Aadhaar (Masked)', isMandatory: true, source: 'customer' },
          { code: 'PROPERTY_DEED', name: 'Property Ownership Proof', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Lease Deed Drafting',
        description: 'Draft lease deed with terms, rent, tenure, and conditions',
        estimatedDays: 2,
        outputDocuments: [
          { code: 'LEASE_DEED_DRAFT', name: 'Lease Deed Draft', isMandatory: true, source: 'agent' },
        ],
      },
      {
        index: 2,
        name: 'Stamp Duty & Registration',
        description: 'Pay stamp duty and register lease deed at Sub-Registrar office',
        estimatedDays: 2,
        governmentOffice: { officeName: 'Sub-Registrar Office' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 3,
        name: 'Registered Deed Collection',
        description: 'Collect registered lease deed',
        estimatedDays: 2,
        outputDocuments: [
          { code: 'REGISTERED_LEASE', name: 'Registered Lease Deed', isMandatory: true, source: 'government' },
        ],
      },
      {
        index: 4,
        name: 'Customer Delivery',
        description: 'Deliver registered lease deed to both parties',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'LESSOR_AADHAAR', name: 'Lessor Aadhaar (Masked)', isMandatory: true, source: 'customer' },
      { code: 'LESSEE_AADHAAR', name: 'Lessee Aadhaar (Masked)', isMandatory: true, source: 'customer' },
      { code: 'PROPERTY_DEED', name: 'Property Ownership Proof', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 800000,
      govtFeeEstimatePaise: 0,
      totalEstimatePaise: 800000,
      stampDutyPercent: 2,
      registrationPercent: 1,
    },
    governmentOffices: [{ officeName: 'Sub-Registrar Office' }],
    estimatedDaysTotal: 8,
    slaBusinessDays: 12,
    tags: ['lease-deed', 'registration', 'purchase', 'rental'],
  },
  {
    serviceCode: 'partition-deed',
    serviceName: 'Partition Deed Registration',
    category: 'purchase',
    description:
      'Drafting and registration of partition deed to legally divide jointly owned property among co-owners.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect ownership documents and identity proofs of all co-owners',
        estimatedDays: 2,
        requiredDocuments: [
          { code: 'JOINT_DEED', name: 'Joint Ownership Deed', isMandatory: true, source: 'customer' },
          { code: 'ALL_OWNER_AADHAAR', name: 'Aadhaar of All Co-owners', isMandatory: true, source: 'customer' },
          { code: 'SURVEY_MAP', name: 'Survey / Measurement Map', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Site Survey & Demarcation',
        description: 'Conduct site survey and demarcate partition boundaries',
        estimatedDays: 3,
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 2,
        name: 'Partition Deed Drafting',
        description: 'Draft partition deed detailing each share and boundaries',
        estimatedDays: 3,
        outputDocuments: [
          { code: 'PARTITION_DEED_DRAFT', name: 'Partition Deed Draft', isMandatory: true, source: 'agent' },
        ],
      },
      {
        index: 3,
        name: 'Stamp Duty & Registration',
        description: 'Pay stamp duty and register partition deed at Sub-Registrar',
        estimatedDays: 3,
        governmentOffice: { officeName: 'Sub-Registrar Office' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 4,
        name: 'Registered Deed Collection',
        description: 'Collect registered partition deed copies for all parties',
        estimatedDays: 3,
        outputDocuments: [
          { code: 'REGISTERED_PARTITION', name: 'Registered Partition Deed', isMandatory: true, source: 'government' },
        ],
      },
      {
        index: 5,
        name: 'Customer Delivery',
        description: 'Deliver registered partition deed to all co-owners',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'JOINT_DEED', name: 'Joint Ownership Deed', isMandatory: true, source: 'customer' },
      { code: 'ALL_OWNER_AADHAAR', name: 'Aadhaar of All Co-owners', isMandatory: true, source: 'customer' },
      { code: 'SURVEY_MAP', name: 'Survey / Measurement Map', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 1200000,
      govtFeeEstimatePaise: 0,
      totalEstimatePaise: 1200000,
      stampDutyPercent: 3,
      registrationPercent: 1,
    },
    governmentOffices: [{ officeName: 'Sub-Registrar Office' }],
    estimatedDaysTotal: 15,
    slaBusinessDays: 20,
    tags: ['partition', 'deed', 'registration', 'purchase', 'joint-property'],
  },
  {
    serviceCode: 'stamp-duty-calculation',
    serviceName: 'Stamp Duty Calculation & Payment',
    category: 'purchase',
    description:
      'Accurate stamp duty calculation based on circle rates, property type, and applicable exemptions with facilitated payment.',
    steps: [
      {
        index: 0,
        name: 'Property Details Collection',
        description: 'Collect property details, area, type, and transaction value',
        estimatedDays: 1,
        requiredDocuments: [
          { code: 'PROPERTY_DETAILS', name: 'Property Details / Agreement', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Circle Rate Verification',
        description: 'Verify applicable circle rate at Tehsil / Sub-Registrar office',
        estimatedDays: 1,
        governmentOffice: { officeName: 'Sub-Registrar Office' },
        agentActions: ['gps_evidence'],
      },
      {
        index: 2,
        name: 'Stamp Duty Calculation & Payment',
        description: 'Calculate stamp duty considering exemptions and facilitate e-stamp / stamp paper purchase',
        estimatedDays: 1,
        outputDocuments: [
          { code: 'STAMP_DUTY_RECEIPT', name: 'Stamp Duty Payment Receipt', isMandatory: true, source: 'government' },
          { code: 'CALCULATION_SHEET', name: 'Stamp Duty Calculation Sheet', isMandatory: true, source: 'agent' },
        ],
        agentActions: ['photo_evidence'],
      },
    ],
    requiredDocuments: [
      { code: 'PROPERTY_DETAILS', name: 'Property Details / Agreement', isMandatory: true, source: 'customer' },
      { code: 'AADHAAR_MASKED', name: 'Aadhaar (Masked)', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 200000,
      govtFeeEstimatePaise: 0,
      totalEstimatePaise: 200000,
    },
    governmentOffices: [{ officeName: 'Sub-Registrar Office' }],
    estimatedDaysTotal: 3,
    slaBusinessDays: 5,
    tags: ['stamp-duty', 'calculation', 'payment', 'purchase'],
  },
];

// ============================================================
// Additional Post-Purchase Services
// ============================================================

const ADDITIONAL_POST_PURCHASE_SERVICES: ServiceDefinitionJson[] = [
  {
    serviceCode: 'nagar-nigam-mutation',
    serviceName: 'Nagar Nigam/Municipal Mutation',
    category: 'post_purchase',
    description:
      'Property mutation (name transfer) at Nagar Nigam / Municipal Corporation for updating municipal records and property tax records.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect registered deed, identity proof, and previous tax receipts',
        estimatedDays: 1,
        requiredDocuments: [
          { code: 'REGISTERED_DEED', name: 'Registered Sale Deed', isMandatory: true, source: 'customer' },
          { code: 'TAX_RECEIPTS', name: 'Previous Property Tax Receipts', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Application Filing',
        description: 'File mutation application at Nagar Nigam with prescribed documents and fee',
        estimatedDays: 1,
        governmentOffice: { officeName: 'Nagar Nigam', department: 'Property Tax' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 2,
        name: 'Field Verification',
        description: 'Municipal inspector conducts field verification',
        estimatedDays: 7,
        governmentOffice: { officeName: 'Nagar Nigam', department: 'Property Tax' },
      },
      {
        index: 3,
        name: 'Objection Period',
        description: 'Public notice and objection period as per municipal rules',
        estimatedDays: 7,
      },
      {
        index: 4,
        name: 'Mutation Order Collection',
        description: 'Collect mutation order from Nagar Nigam after approval',
        estimatedDays: 3,
        outputDocuments: [
          { code: 'MUNICIPAL_MUTATION', name: 'Municipal Mutation Order', isMandatory: true, source: 'government' },
        ],
        agentActions: ['photo_evidence'],
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
      { code: 'TAX_RECEIPTS', name: 'Previous Property Tax Receipts', isMandatory: true, source: 'customer' },
      { code: 'AADHAAR_MASKED', name: 'Aadhaar (Masked)', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 600000,
      govtFeeEstimatePaise: 300000,
      totalEstimatePaise: 900000,
    },
    governmentOffices: [{ officeName: 'Nagar Nigam', department: 'Property Tax' }],
    estimatedDaysTotal: 20,
    slaBusinessDays: 25,
    tags: ['mutation', 'nagar-nigam', 'municipal', 'post-purchase'],
  },
  {
    serviceCode: 'electricity-transfer',
    serviceName: 'Electricity Connection Name Transfer',
    category: 'post_purchase',
    description:
      'Transfer electricity connection to new owner name at the local electricity distribution company (DISCOM).',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect registered deed, previous electricity bills, and identity proof',
        estimatedDays: 1,
        requiredDocuments: [
          { code: 'REGISTERED_DEED', name: 'Registered Sale Deed', isMandatory: true, source: 'customer' },
          { code: 'ELECTRICITY_BILL', name: 'Previous Electricity Bill', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Application Filing',
        description: 'File name transfer application at electricity office (DISCOM)',
        estimatedDays: 1,
        governmentOffice: { officeName: 'Electricity Distribution Company (DISCOM)', department: 'Consumer Services' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 2,
        name: 'Meter Inspection',
        description: 'DISCOM inspector verifies meter and connection details',
        estimatedDays: 5,
        governmentOffice: { officeName: 'Electricity Distribution Company (DISCOM)', department: 'Consumer Services' },
      },
      {
        index: 3,
        name: 'Name Transfer Processing',
        description: 'DISCOM processes name transfer and issues updated connection details',
        estimatedDays: 2,
        outputDocuments: [
          { code: 'ELECTRICITY_TRANSFER', name: 'Electricity Name Transfer Certificate', isMandatory: true, source: 'government' },
        ],
      },
      {
        index: 4,
        name: 'Customer Delivery',
        description: 'Deliver updated connection papers to customer',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'REGISTERED_DEED', name: 'Registered Sale Deed', isMandatory: true, source: 'customer' },
      { code: 'ELECTRICITY_BILL', name: 'Previous Electricity Bill', isMandatory: true, source: 'customer' },
      { code: 'AADHAAR_MASKED', name: 'Aadhaar (Masked)', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 300000,
      govtFeeEstimatePaise: 100000,
      totalEstimatePaise: 400000,
    },
    governmentOffices: [{ officeName: 'Electricity Distribution Company (DISCOM)', department: 'Consumer Services' }],
    estimatedDaysTotal: 10,
    slaBusinessDays: 14,
    tags: ['electricity', 'transfer', 'utility', 'post-purchase'],
  },
  {
    serviceCode: 'water-connection-transfer',
    serviceName: 'Water Connection Transfer',
    category: 'post_purchase',
    description:
      'Transfer water supply connection to new owner name at the Jal Nigam / Water Works department.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect registered deed, previous water bills, and identity proof',
        estimatedDays: 1,
        requiredDocuments: [
          { code: 'REGISTERED_DEED', name: 'Registered Sale Deed', isMandatory: true, source: 'customer' },
          { code: 'WATER_BILL', name: 'Previous Water Bill', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Application Filing',
        description: 'File name transfer application at Jal Nigam / Water Works office',
        estimatedDays: 1,
        governmentOffice: { officeName: 'Jal Nigam / Water Works', department: 'Water Supply' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 2,
        name: 'Connection Verification',
        description: 'Water department verifies connection and meter details',
        estimatedDays: 5,
        governmentOffice: { officeName: 'Jal Nigam / Water Works', department: 'Water Supply' },
      },
      {
        index: 3,
        name: 'Name Transfer Processing',
        description: 'Department processes name transfer and issues updated connection details',
        estimatedDays: 2,
        outputDocuments: [
          { code: 'WATER_TRANSFER', name: 'Water Connection Transfer Certificate', isMandatory: true, source: 'government' },
        ],
      },
      {
        index: 4,
        name: 'Customer Delivery',
        description: 'Deliver updated water connection papers to customer',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'REGISTERED_DEED', name: 'Registered Sale Deed', isMandatory: true, source: 'customer' },
      { code: 'WATER_BILL', name: 'Previous Water Bill', isMandatory: true, source: 'customer' },
      { code: 'AADHAAR_MASKED', name: 'Aadhaar (Masked)', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 300000,
      govtFeeEstimatePaise: 100000,
      totalEstimatePaise: 400000,
    },
    governmentOffices: [{ officeName: 'Jal Nigam / Water Works', department: 'Water Supply' }],
    estimatedDaysTotal: 10,
    slaBusinessDays: 14,
    tags: ['water', 'transfer', 'utility', 'post-purchase'],
  },
  {
    serviceCode: 'gas-connection-transfer',
    serviceName: 'Gas Connection Transfer',
    category: 'post_purchase',
    description:
      'Transfer piped gas / LPG connection to new owner name at the gas distribution company.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect registered deed, gas connection details, and identity proof',
        estimatedDays: 1,
        requiredDocuments: [
          { code: 'REGISTERED_DEED', name: 'Registered Sale Deed', isMandatory: true, source: 'customer' },
          { code: 'GAS_BILL', name: 'Previous Gas Bill / Connection ID', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Application Filing',
        description: 'File name transfer application at gas distribution company office',
        estimatedDays: 1,
        governmentOffice: { officeName: 'Gas Distribution Company', department: 'Consumer Services' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 2,
        name: 'Verification & Processing',
        description: 'Gas company verifies connection and processes name transfer',
        estimatedDays: 4,
      },
      {
        index: 3,
        name: 'Transfer Confirmation',
        description: 'Collect transfer confirmation and updated connection details',
        estimatedDays: 1,
        outputDocuments: [
          { code: 'GAS_TRANSFER', name: 'Gas Connection Transfer Certificate', isMandatory: true, source: 'agent' },
        ],
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'REGISTERED_DEED', name: 'Registered Sale Deed', isMandatory: true, source: 'customer' },
      { code: 'GAS_BILL', name: 'Previous Gas Bill / Connection ID', isMandatory: true, source: 'customer' },
      { code: 'AADHAAR_MASKED', name: 'Aadhaar (Masked)', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 250000,
      govtFeeEstimatePaise: 50000,
      totalEstimatePaise: 300000,
    },
    governmentOffices: [{ officeName: 'Gas Distribution Company', department: 'Consumer Services' }],
    estimatedDaysTotal: 7,
    slaBusinessDays: 10,
    tags: ['gas', 'transfer', 'utility', 'post-purchase'],
  },
  {
    serviceCode: 'property-tax-name-change',
    serviceName: 'Property Tax Name Change',
    category: 'post_purchase',
    description:
      'Update property tax records with new owner name at Nagar Nigam / Municipal Corporation to ensure future tax demands are in correct name.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect registered deed, previous tax receipts, and identity proof',
        estimatedDays: 1,
        requiredDocuments: [
          { code: 'REGISTERED_DEED', name: 'Registered Sale Deed', isMandatory: true, source: 'customer' },
          { code: 'TAX_RECEIPTS', name: 'Previous Property Tax Receipts', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Application Filing',
        description: 'File name change application at Nagar Nigam property tax department',
        estimatedDays: 1,
        governmentOffice: { officeName: 'Nagar Nigam', department: 'Property Tax' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 2,
        name: 'Verification & Processing',
        description: 'Municipal staff verifies documents and processes name change',
        estimatedDays: 10,
        governmentOffice: { officeName: 'Nagar Nigam', department: 'Property Tax' },
      },
      {
        index: 3,
        name: 'Updated Records Collection',
        description: 'Collect updated property tax assessment with new owner name',
        estimatedDays: 2,
        outputDocuments: [
          { code: 'TAX_NAME_CHANGE', name: 'Updated Property Tax Assessment', isMandatory: true, source: 'government' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 4,
        name: 'Customer Delivery',
        description: 'Deliver updated tax records to customer',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'REGISTERED_DEED', name: 'Registered Sale Deed', isMandatory: true, source: 'customer' },
      { code: 'TAX_RECEIPTS', name: 'Previous Property Tax Receipts', isMandatory: true, source: 'customer' },
      { code: 'AADHAAR_MASKED', name: 'Aadhaar (Masked)', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 400000,
      govtFeeEstimatePaise: 100000,
      totalEstimatePaise: 500000,
    },
    governmentOffices: [{ officeName: 'Nagar Nigam', department: 'Property Tax' }],
    estimatedDaysTotal: 15,
    slaBusinessDays: 20,
    tags: ['tax', 'name-change', 'municipal', 'post-purchase'],
  },
];

// ============================================================
// Inheritance Services
// ============================================================

const INHERITANCE_SERVICES: ServiceDefinitionJson[] = [
  {
    serviceCode: 'succession-certificate',
    serviceName: 'Succession Certificate',
    category: 'inheritance',
    description:
      'Obtain Succession Certificate from Civil Court under Indian Succession Act for transferring property of a deceased person without a will.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect death certificate, family tree, property documents, and heir details',
        estimatedDays: 3,
        requiredDocuments: [
          { code: 'DEATH_CERTIFICATE', name: 'Death Certificate', isMandatory: true, source: 'customer' },
          { code: 'PROPERTY_DOCS', name: 'Property Documents of Deceased', isMandatory: true, source: 'customer' },
          { code: 'HEIR_AADHAAR', name: 'Aadhaar of All Legal Heirs', isMandatory: true, source: 'customer' },
          { code: 'FAMILY_TREE', name: 'Family Tree / Affidavit', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Petition Drafting',
        description: 'Draft succession certificate petition for Civil Court',
        estimatedDays: 3,
        outputDocuments: [
          { code: 'SUCCESSION_PETITION', name: 'Succession Certificate Petition', isMandatory: true, source: 'agent' },
        ],
      },
      {
        index: 2,
        name: 'Court Filing',
        description: 'File petition at District Civil Court with court fee',
        estimatedDays: 2,
        governmentOffice: { officeName: 'District Civil Court', department: 'Civil' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 3,
        name: 'Public Notice & Objection Period',
        description: 'Court publishes public notice, mandatory 45-day objection period',
        estimatedDays: 45,
      },
      {
        index: 4,
        name: 'Court Hearing & Order',
        description: 'Attend court hearing and obtain succession certificate order',
        estimatedDays: 5,
        governmentOffice: { officeName: 'District Civil Court', department: 'Civil' },
        agentActions: ['gps_evidence'],
        outputDocuments: [
          { code: 'SUCCESSION_CERT', name: 'Succession Certificate', isMandatory: true, source: 'government' },
        ],
      },
      {
        index: 5,
        name: 'Customer Delivery',
        description: 'Deliver succession certificate to legal heirs',
        estimatedDays: 2,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'DEATH_CERTIFICATE', name: 'Death Certificate', isMandatory: true, source: 'customer' },
      { code: 'PROPERTY_DOCS', name: 'Property Documents of Deceased', isMandatory: true, source: 'customer' },
      { code: 'HEIR_AADHAAR', name: 'Aadhaar of All Legal Heirs', isMandatory: true, source: 'customer' },
      { code: 'FAMILY_TREE', name: 'Family Tree / Affidavit', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 1500000,
      govtFeeEstimatePaise: 500000,
      totalEstimatePaise: 2000000,
    },
    governmentOffices: [{ officeName: 'District Civil Court', department: 'Civil' }],
    estimatedDaysTotal: 60,
    slaBusinessDays: 90,
    tags: ['succession', 'certificate', 'court', 'inheritance'],
  },
  {
    serviceCode: 'will-probate',
    serviceName: 'Will Probate',
    category: 'inheritance',
    description:
      'Obtain probate of will from High Court / District Court to legally validate and execute a deceased person\'s will for property transfer.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect original will, death certificate, and heir documents',
        estimatedDays: 2,
        requiredDocuments: [
          { code: 'ORIGINAL_WILL', name: 'Original Will', isMandatory: true, source: 'customer' },
          { code: 'DEATH_CERTIFICATE', name: 'Death Certificate', isMandatory: true, source: 'customer' },
          { code: 'EXECUTOR_AADHAAR', name: 'Executor Aadhaar (Masked)', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Probate Petition Drafting',
        description: 'Draft probate petition with all supporting documents and witness affidavits',
        estimatedDays: 5,
        outputDocuments: [
          { code: 'PROBATE_PETITION', name: 'Probate Petition', isMandatory: true, source: 'agent' },
        ],
      },
      {
        index: 2,
        name: 'Court Filing',
        description: 'File probate petition at District Court / High Court with court fee',
        estimatedDays: 2,
        governmentOffice: { officeName: 'District Court', department: 'Probate' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 3,
        name: 'Citation & Objection Period',
        description: 'Court issues citation to interested parties, objection period',
        estimatedDays: 30,
      },
      {
        index: 4,
        name: 'Court Hearing & Probate Grant',
        description: 'Attend hearing, examine witnesses, obtain probate order from court',
        estimatedDays: 5,
        governmentOffice: { officeName: 'District Court', department: 'Probate' },
        agentActions: ['gps_evidence'],
        outputDocuments: [
          { code: 'PROBATE_ORDER', name: 'Probate Order / Letters of Administration', isMandatory: true, source: 'government' },
        ],
      },
      {
        index: 5,
        name: 'Customer Delivery',
        description: 'Deliver probate order to executor / beneficiaries',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'ORIGINAL_WILL', name: 'Original Will', isMandatory: true, source: 'customer' },
      { code: 'DEATH_CERTIFICATE', name: 'Death Certificate', isMandatory: true, source: 'customer' },
      { code: 'EXECUTOR_AADHAAR', name: 'Executor Aadhaar (Masked)', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 1200000,
      govtFeeEstimatePaise: 500000,
      totalEstimatePaise: 1700000,
    },
    governmentOffices: [{ officeName: 'District Court', department: 'Probate' }],
    estimatedDaysTotal: 45,
    slaBusinessDays: 60,
    tags: ['will', 'probate', 'court', 'inheritance'],
  },
  {
    serviceCode: 'legal-heir-certificate',
    serviceName: 'Legal Heir Certificate',
    category: 'inheritance',
    description:
      'Obtain Legal Heir Certificate from Tehsil / SDM office establishing the legal heirs of a deceased person for property transfer.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect death certificate, family details, and identity proofs of all heirs',
        estimatedDays: 2,
        requiredDocuments: [
          { code: 'DEATH_CERTIFICATE', name: 'Death Certificate', isMandatory: true, source: 'customer' },
          { code: 'HEIR_AADHAAR', name: 'Aadhaar of All Legal Heirs', isMandatory: true, source: 'customer' },
          { code: 'RATION_CARD', name: 'Ration Card / Family ID', isMandatory: false, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Application Filing',
        description: 'File application at Tehsil / SDM office with affidavit',
        estimatedDays: 1,
        governmentOffice: { officeName: 'Tehsil Office / SDM Office', department: 'Revenue' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 2,
        name: 'Verification & Enquiry',
        description: 'Tehsildar conducts enquiry and verifies heir details through local body',
        estimatedDays: 15,
        governmentOffice: { officeName: 'Tehsil Office / SDM Office', department: 'Revenue' },
      },
      {
        index: 3,
        name: 'Public Notice Period',
        description: 'Public notice published for objections',
        estimatedDays: 7,
      },
      {
        index: 4,
        name: 'Certificate Issuance',
        description: 'Collect legal heir certificate from Tehsil office',
        estimatedDays: 3,
        outputDocuments: [
          { code: 'LEGAL_HEIR_CERT', name: 'Legal Heir Certificate', isMandatory: true, source: 'government' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 5,
        name: 'Customer Delivery',
        description: 'Deliver legal heir certificate to applicant',
        estimatedDays: 2,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'DEATH_CERTIFICATE', name: 'Death Certificate', isMandatory: true, source: 'customer' },
      { code: 'HEIR_AADHAAR', name: 'Aadhaar of All Legal Heirs', isMandatory: true, source: 'customer' },
      { code: 'RATION_CARD', name: 'Ration Card / Family ID', isMandatory: false, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 800000,
      govtFeeEstimatePaise: 200000,
      totalEstimatePaise: 1000000,
    },
    governmentOffices: [{ officeName: 'Tehsil Office / SDM Office', department: 'Revenue' }],
    estimatedDaysTotal: 30,
    slaBusinessDays: 45,
    tags: ['legal-heir', 'certificate', 'inheritance'],
  },
  {
    serviceCode: 'death-certificate-property',
    serviceName: 'Death Certificate for Property Transfer',
    category: 'inheritance',
    description:
      'Obtain death certificate from Nagar Nigam / Gram Panchayat specifically formatted for property transfer proceedings.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect hospital records, family details, and applicant identity proof',
        estimatedDays: 1,
        requiredDocuments: [
          { code: 'HOSPITAL_RECORDS', name: 'Hospital Records / Doctor Certificate', isMandatory: false, source: 'customer' },
          { code: 'APPLICANT_AADHAAR', name: 'Applicant Aadhaar (Masked)', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Application Filing',
        description: 'File death certificate application at Nagar Nigam / Registrar of Births & Deaths',
        estimatedDays: 1,
        governmentOffice: { officeName: 'Nagar Nigam / Registrar of Births & Deaths', department: 'Civil Registration' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 2,
        name: 'Verification & Processing',
        description: 'Authority verifies details and processes death certificate application',
        estimatedDays: 10,
        governmentOffice: { officeName: 'Nagar Nigam / Registrar of Births & Deaths', department: 'Civil Registration' },
      },
      {
        index: 3,
        name: 'Certificate Collection',
        description: 'Collect death certificate from issuing authority',
        estimatedDays: 2,
        outputDocuments: [
          { code: 'DEATH_CERT', name: 'Death Certificate', isMandatory: true, source: 'government' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 4,
        name: 'Customer Delivery',
        description: 'Deliver death certificate to applicant',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'HOSPITAL_RECORDS', name: 'Hospital Records / Doctor Certificate', isMandatory: false, source: 'customer' },
      { code: 'APPLICANT_AADHAAR', name: 'Applicant Aadhaar (Masked)', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 500000,
      govtFeeEstimatePaise: 50000,
      totalEstimatePaise: 550000,
    },
    governmentOffices: [{ officeName: 'Nagar Nigam / Registrar of Births & Deaths', department: 'Civil Registration' }],
    estimatedDaysTotal: 15,
    slaBusinessDays: 20,
    tags: ['death-certificate', 'property-transfer', 'inheritance'],
  },
  {
    serviceCode: 'family-settlement-deed',
    serviceName: 'Family Settlement Deed',
    category: 'inheritance',
    description:
      'Draft and register family settlement deed to amicably divide inherited property among family members without court intervention.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect property documents, heir details, and proposed division plan',
        estimatedDays: 2,
        requiredDocuments: [
          { code: 'PROPERTY_DOCS', name: 'Property Documents of Deceased', isMandatory: true, source: 'customer' },
          { code: 'HEIR_AADHAAR', name: 'Aadhaar of All Family Members', isMandatory: true, source: 'customer' },
          { code: 'DEATH_CERTIFICATE', name: 'Death Certificate', isMandatory: true, source: 'customer' },
          { code: 'LEGAL_HEIR_CERT', name: 'Legal Heir Certificate', isMandatory: false, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Family Discussion & Agreement',
        description: 'Facilitate discussion among family members and finalize division terms',
        estimatedDays: 3,
      },
      {
        index: 2,
        name: 'Settlement Deed Drafting',
        description: 'Draft family settlement deed detailing each member\'s share',
        estimatedDays: 3,
        outputDocuments: [
          { code: 'SETTLEMENT_DRAFT', name: 'Family Settlement Deed Draft', isMandatory: true, source: 'agent' },
        ],
      },
      {
        index: 3,
        name: 'Stamp Duty & Registration',
        description: 'Pay stamp duty and register settlement deed at Sub-Registrar office',
        estimatedDays: 3,
        governmentOffice: { officeName: 'Sub-Registrar Office' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 4,
        name: 'Registered Deed Collection',
        description: 'Collect registered family settlement deed',
        estimatedDays: 3,
        outputDocuments: [
          { code: 'REGISTERED_SETTLEMENT', name: 'Registered Family Settlement Deed', isMandatory: true, source: 'government' },
        ],
      },
      {
        index: 5,
        name: 'Customer Delivery',
        description: 'Deliver registered deed copies to all family members',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'PROPERTY_DOCS', name: 'Property Documents of Deceased', isMandatory: true, source: 'customer' },
      { code: 'HEIR_AADHAAR', name: 'Aadhaar of All Family Members', isMandatory: true, source: 'customer' },
      { code: 'DEATH_CERTIFICATE', name: 'Death Certificate', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 1000000,
      govtFeeEstimatePaise: 0,
      totalEstimatePaise: 1000000,
      stampDutyPercent: 3,
      registrationPercent: 1,
    },
    governmentOffices: [{ officeName: 'Sub-Registrar Office' }],
    estimatedDaysTotal: 20,
    slaBusinessDays: 30, // Updated from 25 to match realistic timeline
    tags: ['family-settlement', 'deed', 'registration', 'inheritance'],
  },
];

// ============================================================
// Construction Services
// ============================================================

const CONSTRUCTION_SERVICES: ServiceDefinitionJson[] = [
  {
    serviceCode: 'building-plan-approval',
    serviceName: 'Building Plan Approval',
    category: 'construction',
    description:
      'Obtain building plan approval from Development Authority / Nagar Nigam for new construction or renovation projects.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect land documents, architectural plans, and owner identity proof',
        estimatedDays: 3,
        requiredDocuments: [
          { code: 'LAND_DEED', name: 'Land Ownership Deed', isMandatory: true, source: 'customer' },
          { code: 'ARCHITECTURAL_PLAN', name: 'Architectural Plan (by licensed architect)', isMandatory: true, source: 'customer' },
          { code: 'SITE_PLAN', name: 'Site Plan with Setbacks', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Application Filing',
        description: 'File building plan approval application at Development Authority',
        estimatedDays: 2,
        governmentOffice: { officeName: 'Development Authority / Nagar Nigam', department: 'Building Permission' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 2,
        name: 'Site Inspection',
        description: 'Authority conducts site inspection to verify plot details and setbacks',
        estimatedDays: 10,
        governmentOffice: { officeName: 'Development Authority / Nagar Nigam', department: 'Building Permission' },
      },
      {
        index: 3,
        name: 'Technical Scrutiny',
        description: 'Technical committee reviews plans for compliance with building bylaws',
        estimatedDays: 15,
        governmentOffice: { officeName: 'Development Authority / Nagar Nigam', department: 'Building Permission' },
      },
      {
        index: 4,
        name: 'Approval & NOC Collection',
        description: 'Collect sanctioned building plan and approval order',
        estimatedDays: 5,
        outputDocuments: [
          { code: 'BUILDING_APPROVAL', name: 'Building Plan Approval Order', isMandatory: true, source: 'government' },
          { code: 'SANCTIONED_PLAN', name: 'Sanctioned Building Plan', isMandatory: true, source: 'government' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 5,
        name: 'Customer Delivery',
        description: 'Deliver approved building plan and approval order to customer',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'LAND_DEED', name: 'Land Ownership Deed', isMandatory: true, source: 'customer' },
      { code: 'ARCHITECTURAL_PLAN', name: 'Architectural Plan (by licensed architect)', isMandatory: true, source: 'customer' },
      { code: 'SITE_PLAN', name: 'Site Plan with Setbacks', isMandatory: true, source: 'customer' },
      { code: 'AADHAAR_MASKED', name: 'Aadhaar (Masked)', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 2000000,
      govtFeeEstimatePaise: 1000000,
      totalEstimatePaise: 3000000,
    },
    governmentOffices: [{ officeName: 'Development Authority / Nagar Nigam', department: 'Building Permission' }],
    estimatedDaysTotal: 45, // Updated to reflect realistic timeline
    slaBusinessDays: 60,
    tags: ['building-plan', 'approval', 'construction', 'permission'],
  },
  {
    serviceCode: 'completion-certificate',
    serviceName: 'Completion/Occupancy Certificate',
    category: 'construction',
    description:
      'Obtain Completion Certificate (CC) / Occupancy Certificate (OC) from Development Authority after construction completion.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect sanctioned plan, building approval, and completion photographs',
        estimatedDays: 2,
        requiredDocuments: [
          { code: 'BUILDING_APPROVAL', name: 'Building Plan Approval', isMandatory: true, source: 'customer' },
          { code: 'SANCTIONED_PLAN', name: 'Sanctioned Building Plan', isMandatory: true, source: 'customer' },
          { code: 'COMPLETION_PHOTOS', name: 'Building Completion Photographs', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Application Filing',
        description: 'File completion certificate application with prescribed fee',
        estimatedDays: 1,
        governmentOffice: { officeName: 'Development Authority / Nagar Nigam', department: 'Building Permission' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 2,
        name: 'Site Inspection by Authority',
        description: 'Authority engineers inspect completed building for compliance with sanctioned plan',
        estimatedDays: 15,
        governmentOffice: { officeName: 'Development Authority / Nagar Nigam', department: 'Building Permission' },
      },
      {
        index: 3,
        name: 'Compliance Verification',
        description: 'Verify compliance with fire safety, structural stability, and utility connections',
        estimatedDays: 7,
      },
      {
        index: 4,
        name: 'Certificate Issuance',
        description: 'Collect Completion / Occupancy Certificate from authority',
        estimatedDays: 4,
        outputDocuments: [
          { code: 'COMPLETION_CERT', name: 'Completion / Occupancy Certificate', isMandatory: true, source: 'government' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 5,
        name: 'Customer Delivery',
        description: 'Deliver certificate to customer',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'BUILDING_APPROVAL', name: 'Building Plan Approval', isMandatory: true, source: 'customer' },
      { code: 'SANCTIONED_PLAN', name: 'Sanctioned Building Plan', isMandatory: true, source: 'customer' },
      { code: 'AADHAAR_MASKED', name: 'Aadhaar (Masked)', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 1200000,
      govtFeeEstimatePaise: 500000,
      totalEstimatePaise: 1700000,
    },
    governmentOffices: [{ officeName: 'Development Authority / Nagar Nigam', department: 'Building Permission' }],
    estimatedDaysTotal: 30,
    slaBusinessDays: 45,
    tags: ['completion', 'occupancy', 'certificate', 'construction'],
  },
  {
    serviceCode: 'rera-registration',
    serviceName: 'RERA Registration Assistance',
    category: 'construction',
    description:
      'Assist builders/developers with RERA (Real Estate Regulatory Authority) project registration as mandated by RERA Act 2016.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect project details, approvals, land documents, and promoter details',
        estimatedDays: 3,
        requiredDocuments: [
          { code: 'LAND_DEED', name: 'Land Title Documents', isMandatory: true, source: 'customer' },
          { code: 'BUILDING_APPROVAL', name: 'Building Plan Approval', isMandatory: true, source: 'customer' },
          { code: 'PROMOTER_PAN', name: 'Promoter PAN Card', isMandatory: true, source: 'customer' },
          { code: 'PROJECT_DETAILS', name: 'Project Layout & Details', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Application Preparation',
        description: 'Prepare RERA registration application with all annexures and declarations',
        estimatedDays: 5,
        outputDocuments: [
          { code: 'RERA_APPLICATION', name: 'RERA Registration Application', isMandatory: true, source: 'agent' },
        ],
      },
      {
        index: 2,
        name: 'Online Filing & Fee Payment',
        description: 'File RERA application online and pay registration fee',
        estimatedDays: 2,
        governmentOffice: { officeName: 'RERA Authority', department: 'Real Estate Regulation' },
        agentActions: ['photo_evidence'],
      },
      {
        index: 3,
        name: 'Authority Review & Queries',
        description: 'RERA authority reviews application and responds to any queries',
        estimatedDays: 12,
        governmentOffice: { officeName: 'RERA Authority', department: 'Real Estate Regulation' },
      },
      {
        index: 4,
        name: 'Registration Certificate',
        description: 'Obtain RERA registration number and certificate',
        estimatedDays: 2,
        outputDocuments: [
          { code: 'RERA_CERT', name: 'RERA Registration Certificate', isMandatory: true, source: 'government' },
        ],
      },
      {
        index: 5,
        name: 'Customer Delivery',
        description: 'Deliver RERA registration certificate and compliance guidelines',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'LAND_DEED', name: 'Land Title Documents', isMandatory: true, source: 'customer' },
      { code: 'BUILDING_APPROVAL', name: 'Building Plan Approval', isMandatory: true, source: 'customer' },
      { code: 'PROMOTER_PAN', name: 'Promoter PAN Card', isMandatory: true, source: 'customer' },
      { code: 'PROJECT_DETAILS', name: 'Project Layout & Details', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 1500000,
      govtFeeEstimatePaise: 1000000,
      totalEstimatePaise: 2500000,
    },
    governmentOffices: [{ officeName: 'RERA Authority', department: 'Real Estate Regulation' }],
    estimatedDaysTotal: 25,
    slaBusinessDays: 35,
    tags: ['rera', 'registration', 'construction', 'regulatory'],
  },
  {
    serviceCode: 'environmental-clearance',
    serviceName: 'Environmental Clearance (NOC)',
    category: 'construction',
    description:
      'Obtain Environmental Clearance / NOC from State Environment Impact Assessment Authority (SEIAA) for construction projects exceeding threshold limits.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect project details, EIA report, land documents, and building plan',
        estimatedDays: 3,
        requiredDocuments: [
          { code: 'PROJECT_DETAILS', name: 'Project Details & Report', isMandatory: true, source: 'customer' },
          { code: 'LAND_DEED', name: 'Land Ownership Documents', isMandatory: true, source: 'customer' },
          { code: 'BUILDING_APPROVAL', name: 'Building Plan Approval', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Application Preparation',
        description: 'Prepare environmental clearance application with Form-1 and project details',
        estimatedDays: 5,
        outputDocuments: [
          { code: 'ENV_APPLICATION', name: 'Environmental Clearance Application', isMandatory: true, source: 'agent' },
        ],
      },
      {
        index: 2,
        name: 'Online Filing',
        description: 'File application on PARIVESH portal with prescribed fee',
        estimatedDays: 2,
        governmentOffice: { officeName: 'State Environment Impact Assessment Authority (SEIAA)', department: 'Environment' },
        agentActions: ['photo_evidence'],
      },
      {
        index: 3,
        name: 'Authority Review & Site Visit',
        description: 'SEIAA reviews application, may conduct site visit',
        estimatedDays: 15,
        governmentOffice: { officeName: 'State Environment Impact Assessment Authority (SEIAA)', department: 'Environment' },
      },
      {
        index: 4,
        name: 'Clearance Issuance',
        description: 'Obtain environmental clearance / NOC from authority',
        estimatedDays: 4,
        outputDocuments: [
          { code: 'ENV_CLEARANCE', name: 'Environmental Clearance NOC', isMandatory: true, source: 'government' },
        ],
      },
      {
        index: 5,
        name: 'Customer Delivery',
        description: 'Deliver environmental clearance to customer with compliance conditions',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'PROJECT_DETAILS', name: 'Project Details & Report', isMandatory: true, source: 'customer' },
      { code: 'LAND_DEED', name: 'Land Ownership Documents', isMandatory: true, source: 'customer' },
      { code: 'AADHAAR_MASKED', name: 'Aadhaar (Masked)', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 1000000,
      govtFeeEstimatePaise: 500000,
      totalEstimatePaise: 1500000,
    },
    governmentOffices: [{ officeName: 'State Environment Impact Assessment Authority (SEIAA)', department: 'Environment' }],
    estimatedDaysTotal: 30,
    slaBusinessDays: 45,
    tags: ['environmental', 'clearance', 'noc', 'construction'],
  },
  {
    serviceCode: 'fire-noc',
    serviceName: 'Fire Safety NOC',
    category: 'construction',
    description:
      'Obtain Fire Safety No Objection Certificate from Fire Department for commercial buildings, high-rises, and buildings above specified height.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect building plan, fire safety system details, and ownership proof',
        estimatedDays: 2,
        requiredDocuments: [
          { code: 'BUILDING_PLAN', name: 'Sanctioned Building Plan', isMandatory: true, source: 'customer' },
          { code: 'FIRE_SAFETY_PLAN', name: 'Fire Safety System Plan', isMandatory: true, source: 'customer' },
          { code: 'OWNERSHIP_PROOF', name: 'Building Ownership Proof', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Application Filing',
        description: 'File NOC application at Fire Department with prescribed documents',
        estimatedDays: 1,
        governmentOffice: { officeName: 'Fire Department', department: 'Fire Safety' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 2,
        name: 'Fire Safety Inspection',
        description: 'Fire Department officials inspect building for fire safety compliance',
        estimatedDays: 10,
        governmentOffice: { officeName: 'Fire Department', department: 'Fire Safety' },
      },
      {
        index: 3,
        name: 'Compliance Report & NOC Issuance',
        description: 'Fire Department issues compliance report and NOC',
        estimatedDays: 5,
        outputDocuments: [
          { code: 'FIRE_NOC', name: 'Fire Safety NOC', isMandatory: true, source: 'government' },
        ],
      },
      {
        index: 4,
        name: 'Customer Delivery',
        description: 'Deliver Fire NOC to customer',
        estimatedDays: 2,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'BUILDING_PLAN', name: 'Sanctioned Building Plan', isMandatory: true, source: 'customer' },
      { code: 'FIRE_SAFETY_PLAN', name: 'Fire Safety System Plan', isMandatory: true, source: 'customer' },
      { code: 'OWNERSHIP_PROOF', name: 'Building Ownership Proof', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 800000,
      govtFeeEstimatePaise: 300000,
      totalEstimatePaise: 1100000,
    },
    governmentOffices: [{ officeName: 'Fire Department', department: 'Fire Safety' }],
    estimatedDaysTotal: 20,
    slaBusinessDays: 30,
    tags: ['fire', 'safety', 'noc', 'construction'],
  },
];

// ============================================================
// Specialized Services
// ============================================================

const SPECIALIZED_SERVICES: ServiceDefinitionJson[] = [
  {
    serviceCode: 'nri-power-of-attorney',
    serviceName: 'NRI Power of Attorney',
    category: 'specialized',
    description:
      'Assist NRIs with drafting and registration of Power of Attorney for property transactions in India, including consulate attestation guidance.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect NRI passport, OCI/PIO card, property documents, and attorney details',
        estimatedDays: 3,
        requiredDocuments: [
          { code: 'NRI_PASSPORT', name: 'NRI Passport Copy', isMandatory: true, source: 'customer' },
          { code: 'OCI_CARD', name: 'OCI / PIO Card', isMandatory: false, source: 'customer' },
          { code: 'PROPERTY_DOCS', name: 'Property Documents', isMandatory: true, source: 'customer' },
          { code: 'ATTORNEY_AADHAAR', name: 'Attorney Aadhaar (Masked)', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'POA Drafting',
        description: 'Draft Power of Attorney with specific powers and property details',
        estimatedDays: 3,
        outputDocuments: [
          { code: 'POA_DRAFT', name: 'Power of Attorney Draft', isMandatory: true, source: 'agent' },
        ],
      },
      {
        index: 2,
        name: 'Consulate Attestation Guidance',
        description: 'Guide NRI for POA execution and attestation at Indian Consulate abroad',
        estimatedDays: 7,
      },
      {
        index: 3,
        name: 'Adjudication & Registration',
        description: 'Get POA adjudicated and registered at Sub-Registrar office in India',
        estimatedDays: 5,
        governmentOffice: { officeName: 'Sub-Registrar Office' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 4,
        name: 'Customer Delivery',
        description: 'Deliver registered POA to attorney / NRI',
        estimatedDays: 2,
        outputDocuments: [
          { code: 'REGISTERED_POA', name: 'Registered Power of Attorney', isMandatory: true, source: 'government' },
        ],
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'NRI_PASSPORT', name: 'NRI Passport Copy', isMandatory: true, source: 'customer' },
      { code: 'PROPERTY_DOCS', name: 'Property Documents', isMandatory: true, source: 'customer' },
      { code: 'ATTORNEY_AADHAAR', name: 'Attorney Aadhaar (Masked)', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 1200000,
      govtFeeEstimatePaise: 300000,
      totalEstimatePaise: 1500000,
    },
    governmentOffices: [{ officeName: 'Sub-Registrar Office' }],
    estimatedDaysTotal: 20,
    slaBusinessDays: 30,
    tags: ['nri', 'power-of-attorney', 'specialized', 'consulate'],
  },
  {
    serviceCode: 'agricultural-land-purchase',
    serviceName: 'Agricultural Land Purchase Assistance',
    category: 'specialized',
    description:
      'End-to-end assistance for agricultural land purchase including eligibility verification, title search, and registration under state agricultural land laws.',
    steps: [
      {
        index: 0,
        name: 'Eligibility Verification',
        description: 'Verify buyer eligibility under state agricultural land ceiling and purchase laws',
        estimatedDays: 2,
        requiredDocuments: [
          { code: 'BUYER_AADHAAR', name: 'Buyer Aadhaar (Masked)', isMandatory: true, source: 'customer' },
          { code: 'FARMER_CERT', name: 'Farmer Certificate (if applicable)', isMandatory: false, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Land Record Verification',
        description: 'Verify 7/12 extract, Khatauni, and land records at Tehsil office',
        estimatedDays: 5,
        governmentOffice: { officeName: 'Tehsil Office', department: 'Revenue' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 2,
        name: 'Physical Site Inspection',
        description: 'Conduct physical inspection of agricultural land, verify boundaries and usage',
        estimatedDays: 2,
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 3,
        name: 'Title Search & Due Diligence',
        description: 'Complete title search and legal due diligence on agricultural land',
        estimatedDays: 5,
        governmentOffice: { officeName: 'Sub-Registrar Office' },
      },
      {
        index: 4,
        name: 'Sale Deed Drafting & Registration',
        description: 'Draft and register sale deed for agricultural land',
        estimatedDays: 5,
        governmentOffice: { officeName: 'Sub-Registrar Office' },
        agentActions: ['gps_evidence', 'photo_evidence'],
        outputDocuments: [
          { code: 'REGISTERED_AGRI_DEED', name: 'Registered Agricultural Land Sale Deed', isMandatory: true, source: 'government' },
        ],
      },
      {
        index: 5,
        name: 'Mutation Filing',
        description: 'File mutation application at Tehsil for name transfer in land records',
        estimatedDays: 5,
        governmentOffice: { officeName: 'Tehsil Office', department: 'Revenue' },
        agentActions: ['gps_evidence'],
      },
      {
        index: 6,
        name: 'Customer Delivery',
        description: 'Deliver registered deed and mutation receipt to customer',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'BUYER_AADHAAR', name: 'Buyer Aadhaar (Masked)', isMandatory: true, source: 'customer' },
      { code: 'FARMER_CERT', name: 'Farmer Certificate (if applicable)', isMandatory: false, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 1500000,
      govtFeeEstimatePaise: 0,
      totalEstimatePaise: 1500000,
      stampDutyPercent: 5,
      registrationPercent: 1,
    },
    governmentOffices: [
      { officeName: 'Tehsil Office', department: 'Revenue' },
      { officeName: 'Sub-Registrar Office' },
    ],
    estimatedDaysTotal: 25,
    slaBusinessDays: 35,
    tags: ['agricultural', 'land', 'purchase', 'specialized'],
  },
  {
    serviceCode: 'property-dispute-mediation',
    serviceName: 'Property Dispute Mediation',
    category: 'specialized',
    description:
      'Professional mediation services for property disputes including boundary disputes, ownership conflicts, and tenancy issues to avoid prolonged litigation.',
    steps: [
      {
        index: 0,
        name: 'Case Assessment',
        description: 'Collect dispute details, property documents, and background from all parties',
        estimatedDays: 3,
        requiredDocuments: [
          { code: 'PROPERTY_DOCS', name: 'Property Documents', isMandatory: true, source: 'customer' },
          { code: 'DISPUTE_DETAILS', name: 'Dispute Description / History', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Document Verification',
        description: 'Verify property records at relevant government offices',
        estimatedDays: 5,
        governmentOffice: { officeName: 'Tehsil Office', department: 'Revenue' },
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 2,
        name: 'Site Inspection',
        description: 'Conduct joint site inspection with disputing parties if applicable',
        estimatedDays: 2,
        agentActions: ['gps_evidence', 'photo_evidence'],
      },
      {
        index: 3,
        name: 'Mediation Sessions',
        description: 'Conduct mediation sessions between disputing parties to reach settlement',
        estimatedDays: 10,
      },
      {
        index: 4,
        name: 'Settlement Agreement Drafting',
        description: 'Draft settlement agreement based on mediation outcome',
        estimatedDays: 5,
        outputDocuments: [
          { code: 'SETTLEMENT_AGREEMENT', name: 'Mediation Settlement Agreement', isMandatory: true, source: 'agent' },
        ],
      },
      {
        index: 5,
        name: 'Agreement Registration (if needed)',
        description: 'Register settlement agreement at Sub-Registrar if property transfer involved',
        estimatedDays: 4,
        governmentOffice: { officeName: 'Sub-Registrar Office' },
        agentActions: ['gps_evidence'],
      },
      {
        index: 6,
        name: 'Customer Delivery',
        description: 'Deliver settlement agreement to all parties',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'PROPERTY_DOCS', name: 'Property Documents', isMandatory: true, source: 'customer' },
      { code: 'DISPUTE_DETAILS', name: 'Dispute Description / History', isMandatory: true, source: 'customer' },
      { code: 'AADHAAR_MASKED', name: 'Aadhaar (Masked)', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 2000000,
      govtFeeEstimatePaise: 200000,
      totalEstimatePaise: 2200000,
    },
    governmentOffices: [
      { officeName: 'Tehsil Office', department: 'Revenue' },
      { officeName: 'Sub-Registrar Office' },
    ],
    estimatedDaysTotal: 30,
    slaBusinessDays: 45,
    tags: ['dispute', 'mediation', 'settlement', 'specialized'],
  },
  {
    serviceCode: 'home-loan-documentation',
    serviceName: 'Home Loan Documentation Assistance',
    category: 'specialized',
    description:
      'Assist home loan applicants with complete documentation, property legal verification for bank, and liaison with bank for smooth loan disbursement.',
    steps: [
      {
        index: 0,
        name: 'Document Collection',
        description: 'Collect income proof, property documents, and identity documents',
        estimatedDays: 2,
        requiredDocuments: [
          { code: 'INCOME_PROOF', name: 'Income Proof / Salary Slips', isMandatory: true, source: 'customer' },
          { code: 'PROPERTY_DOCS', name: 'Property Documents', isMandatory: true, source: 'customer' },
          { code: 'AADHAAR_MASKED', name: 'Aadhaar (Masked)', isMandatory: true, source: 'customer' },
          { code: 'PAN_CARD', name: 'PAN Card', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Property Legal Report for Bank',
        description: 'Prepare property legal report in bank-prescribed format for loan processing',
        estimatedDays: 3,
        outputDocuments: [
          { code: 'BANK_LEGAL_REPORT', name: 'Property Legal Report for Bank', isMandatory: true, source: 'agent' },
        ],
      },
      {
        index: 2,
        name: 'Bank Liaison',
        description: 'Submit documents to bank and coordinate with bank legal team for queries',
        estimatedDays: 3,
        agentActions: ['photo_evidence'],
      },
      {
        index: 3,
        name: 'Documentation Completion',
        description: 'Complete all bank documentation and ensure loan sanction',
        estimatedDays: 1,
        outputDocuments: [
          { code: 'LOAN_DOCS_COMPLETE', name: 'Completed Loan Documentation Set', isMandatory: true, source: 'agent' },
        ],
      },
      {
        index: 4,
        name: 'Customer Delivery',
        description: 'Deliver completed documentation and loan status update to customer',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'INCOME_PROOF', name: 'Income Proof / Salary Slips', isMandatory: true, source: 'customer' },
      { code: 'PROPERTY_DOCS', name: 'Property Documents', isMandatory: true, source: 'customer' },
      { code: 'AADHAAR_MASKED', name: 'Aadhaar (Masked)', isMandatory: true, source: 'customer' },
      { code: 'PAN_CARD', name: 'PAN Card', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 500000,
      govtFeeEstimatePaise: 0,
      totalEstimatePaise: 500000,
    },
    governmentOffices: [],
    estimatedDaysTotal: 10,
    slaBusinessDays: 14,
    tags: ['home-loan', 'documentation', 'bank', 'specialized'],
  },
  {
    serviceCode: 'property-insurance-assistance',
    serviceName: 'Property Insurance Assistance',
    category: 'specialized',
    description:
      'Assist property owners with property insurance including policy comparison, documentation, and claim filing assistance.',
    steps: [
      {
        index: 0,
        name: 'Property Assessment',
        description: 'Assess property details, value, and insurance requirements',
        estimatedDays: 1,
        requiredDocuments: [
          { code: 'PROPERTY_DOCS', name: 'Property Ownership Documents', isMandatory: true, source: 'customer' },
          { code: 'PROPERTY_PHOTOS', name: 'Property Photographs', isMandatory: true, source: 'customer' },
        ],
        agentActions: ['photo_evidence'],
      },
      {
        index: 1,
        name: 'Policy Comparison & Recommendation',
        description: 'Compare insurance policies from multiple providers and recommend best fit',
        estimatedDays: 2,
        outputDocuments: [
          { code: 'INSURANCE_COMPARISON', name: 'Insurance Policy Comparison Report', isMandatory: true, source: 'agent' },
        ],
      },
      {
        index: 2,
        name: 'Application & Documentation',
        description: 'Complete insurance application and submit required documents to insurer',
        estimatedDays: 2,
        agentActions: ['photo_evidence'],
      },
      {
        index: 3,
        name: 'Policy Issuance',
        description: 'Coordinate with insurer for policy issuance and collect policy document',
        estimatedDays: 1,
        outputDocuments: [
          { code: 'INSURANCE_POLICY', name: 'Property Insurance Policy', isMandatory: true, source: 'agent' },
        ],
      },
      {
        index: 4,
        name: 'Customer Delivery',
        description: 'Deliver insurance policy and explain coverage details to customer',
        estimatedDays: 1,
        customerActions: ['acknowledge_delivery'],
      },
    ],
    requiredDocuments: [
      { code: 'PROPERTY_DOCS', name: 'Property Ownership Documents', isMandatory: true, source: 'customer' },
      { code: 'AADHAAR_MASKED', name: 'Aadhaar (Masked)', isMandatory: true, source: 'customer' },
    ],
    estimatedFees: {
      serviceFeeBasePaise: 300000,
      govtFeeEstimatePaise: 0,
      totalEstimatePaise: 300000,
    },
    governmentOffices: [],
    estimatedDaysTotal: 7,
    slaBusinessDays: 10,
    tags: ['insurance', 'property', 'specialized'],
  },
];

// Full catalog array (add more services here as needed)
export const SERVICE_CATALOG: ServiceDefinitionJson[] = [
  ...PRE_PURCHASE_SERVICES,
  ...ADDITIONAL_PRE_PURCHASE_SERVICES,
  ...PURCHASE_SERVICES,
  ...ADDITIONAL_PURCHASE_SERVICES,
  ...POST_PURCHASE_SERVICES,
  ...ADDITIONAL_POST_PURCHASE_SERVICES,
  ...INHERITANCE_SERVICES,
  ...CONSTRUCTION_SERVICES,
  ...SPECIALIZED_SERVICES,
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
