// property-legal-agent-api/src/domains/services/service-definition.types.ts
// Story 5-1: TypeScript types for the JSONB service definition config

export interface GovernmentOffice {
  officeName: string;
  department?: string;
  address?: string;
}

export interface RequiredDocument {
  code: string;
  name: string;
  description?: string;
  isMandatory: boolean;
  source: 'customer' | 'government' | 'agent';
}

export interface ServiceStep {
  index: number;
  name: string;
  description: string;
  estimatedDays: number;
  governmentOffice?: GovernmentOffice;
  requiredDocuments?: RequiredDocument[];
  outputDocuments?: RequiredDocument[];
  agentActions?: string[];
  customerActions?: string[];
}

export interface EstimatedFees {
  serviceFeeBasePaise: number;
  govtFeeEstimatePaise: number;
  totalEstimatePaise: number;
  stampDutyPercent?: number;
  registrationPercent?: number;
}

export interface ServiceDefinitionJson {
  serviceCode: string;
  serviceName: string;
  category: string;
  subcategory?: string;
  description: string;
  steps: ServiceStep[];
  requiredDocuments: RequiredDocument[];
  estimatedFees: EstimatedFees;
  governmentOffices: GovernmentOffice[];
  estimatedDaysTotal: number;
  slaBusinessDays: number;
  prerequisites?: string[];
  tags?: string[];
}
