// ============================================================
// Epic 11: Builder Portal & Bulk Services — Type Definitions
// ============================================================

// Story 11-1: Builder Registration & Project Setup

export interface BuilderProfile {
  id: string;
  userId: string;
  companyName: string;
  reraNumber: string;
  gstNumber: string;
  contactPhone: string;
  contactEmail?: string | null;
  status: BuilderStatusType;
  cityId: string;
  verifiedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type BuilderStatusType =
  | 'PENDING_VERIFICATION'
  | 'VERIFIED'
  | 'REJECTED'
  | 'SUSPENDED';

export type ProjectTypeValue = 'RESIDENTIAL' | 'COMMERCIAL' | 'MIXED';
export type ProjectStatusValue = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export interface BuilderProjectResponse {
  id: string;
  builderId: string;
  name: string;
  totalUnits: number;
  location: string;
  projectType: ProjectTypeValue;
  cityId: string;
  status: ProjectStatusValue;
  createdAt: Date;
  updatedAt: Date;
}

// Story 11-2: Project Units

export type UnitStatusType = 'PENDING_SERVICES' | 'SERVICES_ACTIVE' | 'SERVICES_COMPLETED';

export interface ProjectUnitResponse {
  id: string;
  projectId: string;
  unitNumber: string;
  buyerName: string;
  buyerPhone: string;
  buyerEmail?: string | null;
  buyerUserId?: string | null;
  status: UnitStatusType;
  createdAt: Date;
  updatedAt: Date;
}

// Story 11-3: Bulk Service Selection

export type BulkServiceStatusType = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface BulkServiceRequestResponse {
  id: string;
  projectId: string;
  builderId: string;
  serviceIds: string[];
  packageIds: string[];
  unitIds: string[];
  allUnits: boolean;
  unitCount: number;
  status: BulkServiceStatusType;
  totalFeePaise: string; // BigInt serialized as string
  discountPct: number;
  discountedFeePaise: string;
  createdAt: Date;
}

// Story 11-5: Project Progress Dashboard

export interface ServiceProgressItem {
  service_id: string;
  service_name: string;
  completed: number;
  in_progress: number;
  pending: number;
  total: number;
}

export interface SlaComplianceResult {
  on_track: number;
  approaching_deadline: number;
  total: number;
}

export interface ProjectProgressResponse {
  project: BuilderProjectResponse;
  serviceProgress: ServiceProgressItem[];
  slaCompliance: SlaComplianceResult;
}

export interface TimelineEntry {
  service_name: string;
  week: Date;
  completed_count: number;
}

// Story 11-6: Pricing Engine

export type PricingTierStatusType = 'AUTO' | 'CUSTOM_PENDING' | 'CUSTOM_APPROVED' | 'CUSTOM_REJECTED';

export interface PricingLineItem {
  serviceId: string;
  serviceName: string;
  baseFeePaise: bigint;
  govtFeeEstimatePaise: bigint;
}

export interface BulkPricingBreakdown {
  unitCount: number;
  lineItems: PricingLineItem[];
  perUnitServiceFeePaise: bigint;
  perUnitGovtFeePaise: bigint;
  totalServiceFeePaise: bigint;
  totalGovtFeePaise: bigint;
  discountTierName: string;
  discountPct: number;
  discountAmountPaise: bigint;
  finalServiceFeePaise: bigint;
  grandTotalPaise: bigint;
}

// Story 11-7: Payment Tracking

export interface UnitPaymentInfo {
  unit_id: string;
  unit_number: string;
  buyer_name: string;
  paid_paise: bigint;
  total_due_paise: bigint;
  payment_status: 'paid' | 'pending' | 'overdue';
}

export interface PaymentTotals {
  totalCollectedPaise: string;
  totalDuePaise: string;
  pendingPaise: string;
}

export interface PaymentSummary {
  paid: number;
  pending: number;
  overdue: number;
}

export interface ProjectPaymentSummaryResponse {
  units: UnitPaymentInfo[];
  totals: PaymentTotals;
  summary: PaymentSummary;
}

// Story 11-8: Contracts

export type ContractStatusType =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'AMENDMENT_PENDING'
  | 'EXPIRED'
  | 'CANCELLED';

export interface ContractUtilization {
  contract: BuilderContractResponse;
  utilizationPct: number;
  remainingDays: number;
  remainingUnits: number;
}

export interface BuilderContractResponse {
  id: string;
  builderId: string;
  projectId?: string | null;
  contractNumber: string;
  serviceIds: string[];
  unitCount: number;
  discountPct: number;
  status: ContractStatusType;
  validFrom: Date;
  validTo: Date;
  autoRenew: boolean;
  totalValuePaise: string; // BigInt serialized
  utilizedUnits: number;
  approvedBy?: string | null;
  approvedAt?: Date | null;
  notes?: string | null;
  amendmentNotes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// Story 11-9: Communication

export type BroadcastStatusType =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'SENDING'
  | 'SENT'
  | 'REJECTED';

export type DeliveryStatusType = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';

export interface BroadcastDeliveryStats {
  total: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

export interface RecipientFilter {
  allUnits?: boolean;
  serviceStatus?: string;
  serviceId?: string;
}
