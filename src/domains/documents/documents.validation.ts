// Story 6.2 + 6.6: Document Zod Validation Schemas
import { z } from 'zod';

// Story 6.2: Create document record after upload
export const createDocumentSchema = z.object({
  service_instance_id: z.string().uuid(),
  doc_type: z.string().min(1).max(100),
  storage_path: z.string().min(1)
    .refine((val) => !val.includes('..'), { message: 'Path must not contain ".."' })
    .refine((val) => !val.startsWith('/'), { message: 'Path must not start with "/"' })
    .refine(
      (val) => /^documents\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[a-z_]+\/[0-9a-f-]{36}\.\w+$/.test(val),
      { message: 'Path must match pattern: documents/{uuid}/{uuid}/{type}/{uuid}.{ext}' },
    ),
  download_url: z.string().url(),
  file_size: z.number().int().positive().max(10 * 1024 * 1024), // max 10MB
  uploaded_by: z.enum(['customer', 'agent']),
  stakeholder_id: z.string().uuid().optional(),
  agent_notes: z.string().max(500).optional(),
  gps_lat: z.number().min(-90).max(90).optional(),
  gps_lng: z.number().min(-180).max(180).optional(),
}).transform((data) => ({
  serviceInstanceId: data.service_instance_id,
  docType: data.doc_type,
  storagePath: data.storage_path,
  downloadUrl: data.download_url,
  fileSize: data.file_size,
  uploadedBy: data.uploaded_by,
  stakeholderId: data.stakeholder_id,
  agentNotes: data.agent_notes,
  gpsLat: data.gps_lat,
  gpsLng: data.gps_lng,
}));

// Query documents by service instance
export const queryDocumentsSchema = z.object({
  service_instance_id: z.string().uuid(),
});

// Story 6.6: Override verification schema
export const overrideSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason_category: z.enum([
    'incomplete_document',
    'wrong_document_type',
    'poor_quality',
    'expired_document',
    'tampered_document',
    'other',
  ]).optional(),
  notes: z.string().max(500).optional(),
  flag_ai_incorrect: z.boolean().default(false),
}).refine(
  (data) => data.action !== 'reject' || data.reason_category,
  { message: 'Rejection reason category is required when rejecting' },
);

// Story 6.13: Audit query schema
export const auditQuerySchema = z.object({
  user_id: z.string().uuid().optional(),
  document_id: z.string().uuid().optional(),
  service_instance_id: z.string().uuid().optional(),
  date_from: z.string().datetime().optional(),
  date_to: z.string().datetime().optional(),
  action: z.enum([
    'document_upload',
    'document_view',
    'document_download',
    'document_delete',
    'document_archived',
  ]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  format: z.enum(['json', 'csv']).default('json'),
});
