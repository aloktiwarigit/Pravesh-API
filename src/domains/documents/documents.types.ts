// Story 6.2: Document Management TypeScript Types

export interface DocumentRecord {
  id: string;
  serviceInstanceId: string;
  docType: string;
  storagePath: string;
  downloadUrl: string;
  signedUrl: string | null;
  signedUrlExpiresAt: Date | null;
  fileSize: number;
  uploadedBy: 'customer' | 'agent';
  uploadedByUserId: string;
  uploadedAt: Date;
  verificationStatus: 'pending' | 'verified' | 'rejected' | 'needs_review';
  aiVerificationResult: AiVerificationResult | null;
  rejectionReason: string | null;
  verificationOverriddenBy: string | null;
  verificationOverriddenAt: Date | null;
  stakeholderId: string | null;
  agentNotes: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  archivedAt: Date | null;
  cityId: string;
}

export interface AiVerificationResult {
  doc_type_detected: string;
  confidence_score: number;
  completeness_check: boolean;
  legibility_check: boolean;
  overall_status: 'verified' | 'rejected' | 'needs_review';
  ocr_text?: string;
  rejection_reason?: string;
  keyword_matches?: string[];
  field_coverage?: number;
}

export interface DocumentChecklist {
  doc_type: string;
  name_en: string;
  name_hi: string;
  description_en: string;
  description_hi: string;
  example_thumbnail_url?: string;
  status: 'pending' | 'uploaded' | 'verified' | 'rejected';
  uploaded_files: UploadedFile[];
  rejection_reason?: string;
}

export interface UploadedFile {
  file_id: string;
  storage_path: string;
  download_url: string;
  file_size: number;
  uploaded_at: Date;
}

export interface CreateDocumentInput {
  serviceInstanceId: string;
  docType: string;
  storagePath: string;
  downloadUrl: string;
  fileSize: number;
  uploadedBy: 'customer' | 'agent';
  uploadedByUserId: string;
  cityId: string;
  stakeholderId?: string;
  agentNotes?: string;
  gpsLat?: number;
  gpsLng?: number;
}

export interface OverrideVerificationInput {
  documentId: string;
  action: 'approve' | 'reject';
  reasonCategory?: string;
  notes?: string;
  overriddenBy: string;
  flagAiIncorrect?: boolean;
}
