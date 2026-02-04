// Story 6.4: Azure Cognitive Services Configuration
export const azureDocIntelligenceConfig = {
  endpoint: process.env.AZURE_DOC_INTELLIGENCE_ENDPOINT || 'https://placeholder.cognitiveservices.azure.com/',
  apiKey: process.env.AZURE_DOC_INTELLIGENCE_KEY || '',
  apiVersion: '2024-11-30',
};

export const azureAppInsightsConfig = {
  connectionString: process.env.APPLICATIONINSIGHTS_CONNECTION_STRING || '',
  instrumentationKey: process.env.APPINSIGHTS_INSTRUMENTATIONKEY || '',
};
