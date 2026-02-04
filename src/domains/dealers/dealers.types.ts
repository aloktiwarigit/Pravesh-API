// Epic 9: Dealer Network Types
// All monetary values in paise (integer) per architecture.md

export interface DealerProfile {
  id: string;
  userId: string;
  dealerCode: string | null;
  businessName: string | null;
  dealerStatus: string;
  currentTier: string;
  qrCodeUrl: string | null;
  whitelabelEnabled: boolean;
  logoUrl: string | null;
  brandColor: string | null;
  displayNameOptIn: boolean;
  cityId: string;
  kyc: {
    status: string;
    fullName: string;
    rejectionReason: string | null;
    rejectionNotes: string | null;
  } | null;
}

export interface DealerReferralData {
  dealerCode: string;
  referralLink: string;
  qrCodeUrl: string | null;
}

export interface PipelineItem {
  referralId: string;
  customerFirstName: string;
  referralDate: string;
  attributionStatus: string;
  services: PipelineServiceItem[];
  hasActiveServices: boolean;
}

export interface PipelineServiceItem {
  serviceRequestId: string;
  serviceType: string;
  status: string;
  daysSinceRequest: number;
  projectedCommissionPaise: string;
}

export interface EarningsSummary {
  totalEarnedPaise: string;
  pendingPayoutPaise: string;
  paidThisMonthPaise: string;
  paidAllTimePaise: string;
}

export interface CommissionHistoryEntry {
  id: string;
  customerFirstName: string;
  serviceType: string;
  commissionAmountPaise: string;
  commissionRate: number;
  status: string;
  earnedDate: string;
  paidAt: string | null;
}

export interface TierProgress {
  currentTier: string;
  currentMonthReferrals: number;
  nextTierThreshold: number | null;
  referralsToNextTier: number;
}

export interface LeaderboardEntry {
  rank: number;
  displayName: string;
  referralCount: number;
  totalCommissionPaise: string;
  tier: string;
  isMe: boolean;
}

export interface LeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  myRank: {
    rank: number;
    referralCount: number;
    totalCommissionPaise: string;
  } | null;
}

export interface EarningsForecast {
  projections: ForecastProjection[];
  totalProjectedPaise: string;
  activeServiceCount: number;
  currentTier: string;
  commissionRatePercent: number;
  disclaimer: string;
}

export interface ForecastProjection {
  serviceRequestId: string;
  customerFirstName: string;
  serviceType: string;
  currentStage: string;
  serviceFeePaise: string;
  projectedCommissionPaise: string;
  hasExistingCommission: boolean;
  createdAt: string;
}

export interface BankAccountResponse {
  id: string;
  accountHolderName: string;
  bankName: string;
  ifscCode: string;
  accountNumberMasked: string;
  accountType: string;
  verified: boolean;
  isPrimary: boolean;
}

export interface PayoutHistoryEntry {
  id: string;
  payoutDate: string;
  totalAmountPaise: string;
  transactionId: string | null;
  status: string;
  bankAccountMasked: string;
  bankName: string;
}

export interface WhiteLabelSettings {
  enabled: boolean;
  businessName: string | null;
  logoUrl: string | null;
  brandColor: string | null;
}

export interface SenderBranding {
  senderName: string;
  logoUrl: string | null;
}
