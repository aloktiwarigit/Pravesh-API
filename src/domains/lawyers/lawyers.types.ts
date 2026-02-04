// Types for the Lawyers domain (Epic 12: Legal Opinion Marketplace)

export interface LawyerRegisterInput {
  barCouncilNumber: string;
  stateBarCouncil: string;
  admissionYear: number;
}

export interface LawyerVerifyInput {
  lawyerId: string;
  action: 'approve' | 'reject';
  rejectionReason?: string;
}

export interface AssignExpertiseInput {
  lawyerId: string;
  tags: string[];
}

export interface RequestExpertiseInput {
  requestedTag: string;
  supportingDocUrl?: string;
}

export interface ReviewExpertiseRequestInput {
  requestId: string;
  action: 'approve' | 'reject';
  rejectionReason?: string;
}

export interface CreateLegalCaseInput {
  serviceRequestId: string;
  requiredExpertise: string;
  lawyerId: string;
  issueSummary: string;
  caseFeeInPaise: number;
  casePriority?: 'NORMAL' | 'URGENT';
}

export interface DeclineCaseInput {
  caseId: string;
  reason: string;
  reasonText?: string;
}

export interface AcceptCaseInput {
  caseId: string;
}

export interface SubmitOpinionInput {
  caseId: string;
  opinionType: 'FAVORABLE' | 'ADVERSE' | 'CONDITIONAL';
  summary?: string;
  conditions?: string;
}

export interface ReviewOpinionInput {
  opinionId: string;
  action: 'approve' | 'reject';
  reviewNotes?: string;
}

export interface RateOpinionInput {
  caseId: string;
  rating: number;
  feedback?: string;
}

export interface BankAccountInput {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
  upiId?: string;
}

export interface ReassignCaseInput {
  caseId: string;
  newLawyerId: string;
}

export interface UpdateCommissionInput {
  lawyerId: string;
  commissionRate: number;
}

export interface DeactivateLawyerInput {
  lawyerId: string;
  reason: string;
}

export interface EarningsDashboard {
  month: number;
  year: number;
  summary: {
    completedPaidInPaise: number;
    pendingPayoutInPaise: number;
    estimatedInProgressInPaise: number;
    totalCasesCompleted: number;
  };
}

export interface PerformanceMetrics {
  totalCasesCompleted: number;
  avgCaseDurationDays: number;
  opinionTypeDistribution: Record<string, number>;
  ratingTrend: Array<{
    month: string;
    avgRating: number;
    count: number;
  }>;
}

export interface FeeBreakdown {
  grossFeeInPaise: number;
  commissionPercentage: number;
  commissionAmountInPaise: number;
  netPayoutInPaise: number;
}

export interface SuggestedLawyer {
  id: string;
  userId: string;
  barCouncilNumber: string;
  stateBarCouncil: string;
  totalCasesCompleted: number;
  avgRating: number | null;
  expertiseTags: string[];
  activeCaseCount: number;
}

export interface MarketplaceDashboard {
  assigned: number;
  inProgress: number;
  pendingReview: number;
  completedThisMonth: number;
}
