declare module '@azure/ai-form-recognizer' {
  export class AzureKeyCredential {
    constructor(key: string);
  }

  export class DocumentAnalysisClient {
    constructor(endpoint: string, credential: AzureKeyCredential);
    beginAnalyzeDocument(modelId: string, document: Buffer | ArrayBuffer): Promise<{
      pollUntilDone(): Promise<{
        pages?: Array<{
          words?: Array<{
            content: string;
            confidence?: number;
          }>;
        }>;
      }>;
    }>;
  }
}
