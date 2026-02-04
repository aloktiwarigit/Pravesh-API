// Support Domain Types — Story 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.10, 10.12

export interface CustomerSearchResult {
  customerId: string;
  name: string;
  phone: string;
  city: string;
  totalServices: number;
  activeServices: number;
  lastServiceDate: string | null;
  preferredLanguage: string;
}

export interface CustomerProfileDetail {
  customer: CustomerSearchResult;
  serviceRequests: ServiceSummary[];
  paymentHistory: PaymentSummary[];
  communicationTimeline: CommunicationEntry[];
  dealerAttribution: DealerInfo | null;
  assignedAgents: AgentHistory[];
}

export interface ServiceSummary {
  serviceId: string;
  serviceType: string;
  status: string;
  assignedAgent: { id: string; name: string } | null;
  slaStatus: 'on_track' | 'at_risk' | 'breached';
  paymentStatus: string;
  milestones: Milestone[];
  escalations: EscalationSummary[];
  createdAt: string;
}

export interface PaymentSummary {
  paymentId: string;
  amountPaise: number;
  status: string;
  method: string;
  paidAt: string | null;
  createdAt: string;
}

export interface CommunicationEntry {
  id: string;
  type: 'message' | 'notification' | 'escalation';
  sender: string;
  content: string;
  timestamp: string;
}

export interface DealerInfo {
  dealerId: string;
  dealerName: string;
  phone: string;
}

export interface AgentHistory {
  agentId: string;
  agentName: string;
  assignedAt: string;
  serviceId: string;
}

export interface Milestone {
  stepName: string;
  status: string;
  completedAt: string | null;
}

export interface EscalationSummary {
  escalationId: string;
  type: string;
  status: string;
  createdAt: string;
}

// Story 10.2: Messaging types
export interface SendMessageInput {
  recipientId: string;
  serviceId: string;
  messageText: string;
  attachmentUrl?: string;
  attachmentType?: string;
}

// Story 10.3: Template types
export interface CreateTemplateInput {
  category: string;
  templateTextEn: string;
  templateTextHi: string;
  placeholders: string[];
}

// Story 10.4: Reminder types
export interface CreateReminderInput {
  serviceId: string;
  reminderDatetime: string;
  reminderType: string;
  notes?: string;
}

export interface UpdateReminderInput {
  status: 'COMPLETED' | 'SNOOZED';
  snoozedUntil?: string;
}

// Story 10.5: Pattern types
export interface LogPatternInput {
  patternCategory: string;
  notes?: string;
}

// Story 10.6: Performance note types
export interface AddPerformanceNoteInput {
  agentId: string;
  serviceId: string;
  noteType: string;
  notes: string;
}

// Story 10.7: Escalation types
export interface CreateEscalationInput {
  serviceId: string;
  customerId: string;
  escalationType: string;
  escalationReason: string;
  severity?: string;
}

// Story 10.10: Customer message types
export interface SendCustomerMessageInput {
  serviceId: string;
  recipientId: string;
  subject?: string;
  messageText: string;
  attachmentUrl?: string;
  deliveryChannel: string;
}

// Story 10.12: Performance metrics types
export interface PerformanceFilterInput {
  cityId?: string;
  dateFrom?: string;
  dateTo?: string;
  tier?: 'top' | 'middle' | 'bottom';
  format?: 'json' | 'csv';
}

export interface AgentPerformanceSummary {
  agentId: string;
  agentName: string;
  city: string;
  casesHandled: number;
  avgFirstResponseMinutes: number;
  avgResolutionHours: number;
  firstResponseSlaPercent: number;
  resolutionSlaPercent: number;
  customerSatisfaction: number | null;
  periodStart: string;
  periodEnd: string;
}

export interface SupportOverviewMetrics {
  activeEscalations: number;
  resolvedToday: number;
  avgFirstResponseMinutes: number;
  avgResolutionHours: number;
}
