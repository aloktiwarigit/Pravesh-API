// Story 6.4: Azure Cognitive Services AI Document Verification
import { DocumentAnalysisClient, AzureKeyCredential } from '@azure/ai-form-recognizer';
import { getStorage } from 'firebase-admin/storage';
import { azureDocIntelligenceConfig } from '../../config/azure.js';

export interface VerificationResult {
  doc_type_detected: string;
  confidence_score: number;
  completeness_check: boolean;
  legibility_check: boolean;
  overall_status: 'verified' | 'rejected' | 'needs_review';
  ocr_text: string;
  rejection_reason?: string;
  keyword_matches: string[];
  field_coverage: number;
}

// Document type keyword mappings for Indian property documents (Hindi + English)
const DOCUMENT_TYPE_KEYWORDS: Record<string, string[]> = {
  aadhaar: ['aadhaar', 'unique identification', 'uid', 'आधार', 'uidai', 'enrolment'],
  pan: ['permanent account number', 'income tax', 'pan', 'पैन', 'nsdl'],
  sale_deed: ['sale deed', 'conveyance', 'bainama', 'बैनामा', 'vendor', 'vendee', 'registry', 'sub-registrar'],
  encumbrance_certificate: ['encumbrance', 'non-encumbrance', 'ec', 'एन्कम्ब्रेंस', 'charge', 'mortgage'],
  mutation_order: ['mutation', 'intiqal', 'इंतकाल', 'म्यूटेशन', 'revenue record', 'land record'],
  property_tax_receipt: ['property tax', 'house tax', 'municipal', 'नगरपालिका', 'ghar ka tax'],
  noc: ['no objection', 'noc', 'अनापत्ति', 'clearance certificate'],
  power_of_attorney: ['power of attorney', 'poa', 'मुख्तारनामा', 'attorney'],
  death_certificate: ['death certificate', 'मृत्यु प्रमाणपत्र', 'registrar of deaths'],
  succession_certificate: ['succession', 'उत्तराधिकार', 'legal heir'],
  completion_certificate: ['completion certificate', 'occupancy certificate', 'oc', 'cc'],
};

// Required fields per document type for completeness check
const REQUIRED_FIELDS: Record<string, string[]> = {
  aadhaar: ['name', 'number', 'address', 'date of birth'],
  pan: ['name', 'number', 'date of birth'],
  sale_deed: ['vendor', 'vendee', 'property description', 'consideration', 'registration number'],
  encumbrance_certificate: ['property', 'period', 'encumbrance details'],
  mutation_order: ['property', 'transferor', 'transferee', 'order number'],
};

/**
 * Redact PII (Aadhaar and PAN numbers) from OCR text before storage.
 * Aadhaar: 12-digit number (with optional spaces/hyphens between groups of 4)
 * PAN: 5 uppercase letters + 4 digits + 1 uppercase letter
 */
function redactPii(text: string): string {
  // Redact Aadhaar numbers: 12 consecutive digits or groups of 4 separated by spaces/hyphens
  let redacted = text.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, 'XXXX-XXXX-XXXX');
  // Redact PAN numbers: AAAAA1234A pattern
  redacted = redacted.replace(/\b[A-Za-z]{5}\d{4}[A-Za-z]\b/g, 'XXXXX0000X');
  return redacted;
}

export class AiVerificationService {
  private client: DocumentAnalysisClient;

  constructor() {
    this.client = new DocumentAnalysisClient(
      azureDocIntelligenceConfig.endpoint,
      new AzureKeyCredential(azureDocIntelligenceConfig.apiKey),
    );
  }

  async verifyDocument(document: {
    id: string;
    storagePath: string;
    docType: string;
  }): Promise<VerificationResult> {
    // 1. Download document from Firebase Storage
    const bucket = getStorage().bucket();
    const file = bucket.file(document.storagePath);
    const [buffer] = await file.download();

    // 2. Send to Azure Document Intelligence OCR (AC1)
    const poller = await this.client.beginAnalyzeDocument(
      'prebuilt-read',
      buffer,
    );
    const analyzeResult = await poller.pollUntilDone();

    // 3. Extract text and confidence
    const pages = analyzeResult.pages || [];
    let fullText = '';
    let totalConfidence = 0;
    let wordCount = 0;

    for (const page of pages) {
      for (const word of page.words || []) {
        fullText += word.content + ' ';
        totalConfidence += word.confidence || 0;
        wordCount++;
      }
    }

    const avgConfidence = wordCount > 0 ? totalConfidence / wordCount : 0;
    const ocrText = fullText.toLowerCase().trim();

    // 4. Document type classification via keyword matching (AC2)
    const { detectedType, keywordMatches } = this.classifyDocumentType(
      ocrText,
      document.docType,
    );

    // 5. Completeness check (AC3)
    const completenessCheck = this.checkCompleteness(ocrText, document.docType);

    // 6. Legibility check — OCR confidence > 70% (AC4)
    const legibilityCheck = avgConfidence > 0.70;

    // 7. Determine overall status
    const confidenceScore = Math.round(avgConfidence * 100);
    const typeMatch = detectedType === document.docType;

    let overallStatus: 'verified' | 'rejected' | 'needs_review';
    let rejectionReason: string | undefined;

    if (typeMatch && completenessCheck && legibilityCheck && confidenceScore >= 70) {
      overallStatus = 'verified';
    } else if (!legibilityCheck || confidenceScore < 40) {
      overallStatus = 'rejected';
      rejectionReason = 'Document is not legible. Please upload a clearer photo.';
    } else if (!typeMatch && keywordMatches.length === 0) {
      overallStatus = 'rejected';
      rejectionReason = `Expected ${document.docType} but document does not match. Please upload the correct document.`;
    } else if (!completenessCheck) {
      overallStatus = 'rejected';
      rejectionReason = 'Document appears incomplete or cut off. Please upload a full photo.';
    } else {
      overallStatus = 'needs_review';
      rejectionReason = 'Document needs manual review for verification.';
    }

    return {
      doc_type_detected: detectedType,
      confidence_score: confidenceScore,
      completeness_check: completenessCheck,
      legibility_check: legibilityCheck,
      overall_status: overallStatus,
      ocr_text: redactPii(ocrText.substring(0, 2000)), // Redact PII before storing
      rejection_reason: rejectionReason,
      keyword_matches: keywordMatches,
      field_coverage: completenessCheck ? 1.0 : 0.5,
    };
  }

  private classifyDocumentType(
    ocrText: string,
    expectedType: string,
  ): { detectedType: string; keywordMatches: string[] } {
    let bestMatch = '';
    let bestScore = 0;
    let bestKeywords: string[] = [];

    for (const [docType, keywords] of Object.entries(DOCUMENT_TYPE_KEYWORDS)) {
      const matches = keywords.filter((kw) => ocrText.includes(kw.toLowerCase()));
      const score = matches.length / keywords.length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = docType;
        bestKeywords = matches;
      }
    }

    return {
      detectedType: bestMatch || expectedType,
      keywordMatches: bestKeywords,
    };
  }

  private checkCompleteness(ocrText: string, docType: string): boolean {
    const requiredFields = REQUIRED_FIELDS[docType];
    if (!requiredFields) return true; // Unknown doc type — pass by default

    const foundFields = requiredFields.filter((field) =>
      ocrText.includes(field.toLowerCase()),
    );

    // At least 60% of required fields must be present
    return foundFields.length / requiredFields.length >= 0.6;
  }
}
