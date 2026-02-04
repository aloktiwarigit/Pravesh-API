/**
 * Analytics domain types for Stories 14-9 through 14-14
 */

export interface CityKpis {
  cityId: string;
  period: { start: string; end: string };
  totalServices: number;
  revenuePaise: number;
  franchiseSharePaise: number;
  agentCount: number;
  dealerCount: number;
}

export interface PlatformKpis {
  totalCities: number;
  totalAgents: number;
  totalDealers: number;
  currentMonth: {
    month: string;
    serviceCount: number;
    revenuePaise: number;
  };
  allTime: {
    serviceCount: number;
    revenuePaise: number;
  };
}

export interface CityComparisonEntry {
  cityId: string;
  cityName: string;
  state: string;
  servicesThisMonth: number;
  revenueThisMonthPaise: number;
  agentCount: number;
  dealerCount: number;
}

export interface CityComparisonResult {
  cityA: CityKpis & { cityName?: string; state?: string };
  cityB: CityKpis & { cityName?: string; state?: string };
  comparison: {
    revenueVariancePercent: number | null;
    serviceCountVariance: number;
    agentCountVariance: number;
    dealerCountVariance: number;
  };
}

export interface HeatmapDataPoint {
  cityId: string;
  cityName: string;
  state: string;
  lat: number | null;
  lng: number | null;
  serviceVolume: number;
  revenuePaise: number;
}

export interface TrendDataPoint {
  month: string;
  serviceCount: number;
  revenuePaise: number;
}

export interface MarketIntelligenceReport {
  cityId: string;
  cityName: string | undefined;
  state: string | undefined;
  generatedAt: string;
  totalTransactions: number;
  averageFee: {
    cityAvgPaise: number;
    platformAvgPaise: number;
  };
  revenueRange: {
    minPaise: number;
    maxPaise: number;
  };
  totalRevenuePaise: number;
  monthlyTrends: TrendDataPoint[];
}

export interface FeatureAdoptionMetric {
  eventName: string;
  usageCount: number;
}

export interface ExportJobResult {
  id: string;
  exportType: string;
  format: string;
  status: string;
  fileUrl: string | null;
  expiresAt: string | null;
  rowCount: number | null;
  async: boolean;
}

export interface BigQuerySyncHealth {
  status: 'healthy' | 'degraded';
  lastSync: string | null;
  tablesMonitored: number;
  failedTables: string[];
}
