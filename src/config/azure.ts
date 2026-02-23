// Story 6.4: Azure Cognitive Services Configuration
// endpoint/apiKey are empty when env vars are not set; callers must check
// before using (the document-verify job logs a warning and skips).
export const azureDocIntelligenceConfig = {
  endpoint: process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT || '',
  apiKey: process.env.AZURE_DOC_INTELLIGENCE_KEY || '',
  apiVersion: '2024-11-30',
  get isConfigured(): boolean {
    return !!(this.endpoint && this.apiKey);
  },
};

export const azureAppInsightsConfig = {
  connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING || '',
  instrumentationKey: process.env.APPINSIGHTS_INSTRUMENTATIONKEY || '',
};
