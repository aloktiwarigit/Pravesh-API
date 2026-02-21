/**
 * Tests for Document domain validation schemas.
 * Covers: createDocumentSchema, queryDocumentsSchema, overrideSchema, auditQuerySchema
 * Stories 6.2, 6.6, 6.13
 */
import { describe, test, expect } from 'vitest';
import {
  createDocumentSchema,
  queryDocumentsSchema,
  overrideSchema,
  auditQuerySchema,
} from '../documents.validation';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_STORAGE_PATH = `documents/${VALID_UUID}/${VALID_UUID}/aadhaar/${VALID_UUID}.pdf`;

describe('Documents Validation Schemas', () => {
  // ============================================================
  // createDocumentSchema
  // ============================================================

  describe('createDocumentSchema', () => {
    const validPayload = {
      service_instance_id: VALID_UUID,
      doc_type: 'aadhaar_card',
      storage_path: VALID_STORAGE_PATH,
      download_url: 'https://storage.example.com/documents/file.pdf',
      file_size: 1024 * 100, // 100KB
      uploaded_by: 'customer' as const,
    };

    test('accepts valid document payload and transforms field names', () => {
      const result = createDocumentSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        // Verify snake_case transformed to camelCase
        expect(result.data.serviceInstanceId).toBe(VALID_UUID);
        expect(result.data.docType).toBe('aadhaar_card');
        expect(result.data.uploadedBy).toBe('customer');
      }
    });

    test('accepts agent as uploaded_by', () => {
      const result = createDocumentSchema.safeParse({
        ...validPayload,
        uploaded_by: 'agent',
      });
      expect(result.success).toBe(true);
    });

    test('accepts with optional fields', () => {
      const result = createDocumentSchema.safeParse({
        ...validPayload,
        agent_notes: 'Document appears legible.',
        gps_lat: 26.8467,
        gps_lng: 80.9462,
        stakeholder_id: VALID_UUID,
      });
      expect(result.success).toBe(true);
    });

    test('rejects storage_path containing ".."', () => {
      const result = createDocumentSchema.safeParse({
        ...validPayload,
        storage_path: `documents/../etc/passwd`,
      });
      expect(result.success).toBe(false);
    });

    test('rejects storage_path starting with "/"', () => {
      const result = createDocumentSchema.safeParse({
        ...validPayload,
        storage_path: `/documents/${VALID_UUID}/${VALID_UUID}/aadhaar/${VALID_UUID}.pdf`,
      });
      expect(result.success).toBe(false);
    });

    test('rejects storage_path not matching expected pattern', () => {
      const result = createDocumentSchema.safeParse({
        ...validPayload,
        storage_path: 'wrong/path/format.pdf',
      });
      expect(result.success).toBe(false);
    });

    test('rejects file_size over 10MB', () => {
      const result = createDocumentSchema.safeParse({
        ...validPayload,
        file_size: 10 * 1024 * 1024 + 1, // 10MB + 1 byte
      });
      expect(result.success).toBe(false);
    });

    test('rejects file_size of 0', () => {
      const result = createDocumentSchema.safeParse({
        ...validPayload,
        file_size: 0,
      });
      expect(result.success).toBe(false);
    });

    test('rejects non-UUID service_instance_id', () => {
      const result = createDocumentSchema.safeParse({
        ...validPayload,
        service_instance_id: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid download_url', () => {
      const result = createDocumentSchema.safeParse({
        ...validPayload,
        download_url: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    test('rejects agent_notes exceeding 500 characters', () => {
      const result = createDocumentSchema.safeParse({
        ...validPayload,
        agent_notes: 'a'.repeat(501),
      });
      expect(result.success).toBe(false);
    });

    test('rejects gps_lat out of range', () => {
      const result = createDocumentSchema.safeParse({
        ...validPayload,
        gps_lat: 91,
      });
      expect(result.success).toBe(false);
    });

    test('rejects gps_lng out of range', () => {
      const result = createDocumentSchema.safeParse({
        ...validPayload,
        gps_lng: 181,
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid uploaded_by value', () => {
      const result = createDocumentSchema.safeParse({
        ...validPayload,
        uploaded_by: 'admin',
      });
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // queryDocumentsSchema
  // ============================================================

  describe('queryDocumentsSchema', () => {
    test('accepts valid UUID service_instance_id', () => {
      const result = queryDocumentsSchema.safeParse({
        service_instance_id: VALID_UUID,
      });
      expect(result.success).toBe(true);
    });

    test('rejects non-UUID service_instance_id', () => {
      const result = queryDocumentsSchema.safeParse({
        service_instance_id: 'not-a-uuid',
      });
      expect(result.success).toBe(false);
    });

    test('rejects missing service_instance_id', () => {
      const result = queryDocumentsSchema.safeParse({});
      expect(result.success).toBe(false);
    });
  });

  // ============================================================
  // overrideSchema
  // ============================================================

  describe('overrideSchema', () => {
    test('accepts approve action without reason_category', () => {
      const result = overrideSchema.safeParse({
        action: 'approve',
      });
      expect(result.success).toBe(true);
    });

    test('accepts approve with optional notes', () => {
      const result = overrideSchema.safeParse({
        action: 'approve',
        notes: 'Document looks good.',
      });
      expect(result.success).toBe(true);
    });

    test('accepts reject with required reason_category', () => {
      const result = overrideSchema.safeParse({
        action: 'reject',
        reason_category: 'poor_quality',
        notes: 'Image is too blurry to read.',
      });
      expect(result.success).toBe(true);
    });

    test('rejects reject action without reason_category', () => {
      const result = overrideSchema.safeParse({
        action: 'reject',
        notes: 'Some issue.',
      });
      expect(result.success).toBe(false);
    });

    test('accepts all valid reason_category values', () => {
      const categories = [
        'incomplete_document',
        'wrong_document_type',
        'poor_quality',
        'expired_document',
        'tampered_document',
        'other',
      ] as const;

      for (const reason_category of categories) {
        const result = overrideSchema.safeParse({
          action: 'reject',
          reason_category,
        });
        expect(result.success).toBe(true);
      }
    });

    test('rejects invalid action', () => {
      const result = overrideSchema.safeParse({
        action: 'delete',
      });
      expect(result.success).toBe(false);
    });

    test('rejects invalid reason_category', () => {
      const result = overrideSchema.safeParse({
        action: 'reject',
        reason_category: 'not_real_category',
      });
      expect(result.success).toBe(false);
    });

    test('defaults flag_ai_incorrect to false', () => {
      const result = overrideSchema.safeParse({ action: 'approve' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.flag_ai_incorrect).toBe(false);
      }
    });

    test('accepts flag_ai_incorrect true', () => {
      const result = overrideSchema.safeParse({
        action: 'reject',
        reason_category: 'poor_quality',
        flag_ai_incorrect: true,
      });
      expect(result.success).toBe(true);
    });
  });

  // ============================================================
  // auditQuerySchema
  // ============================================================

  describe('auditQuerySchema', () => {
    test('accepts empty object (all optional)', () => {
      const result = auditQuerySchema.safeParse({});
      expect(result.success).toBe(true);
    });

    test('defaults page to 1, limit to 50, and format to json', () => {
      const result = auditQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(50);
        expect(result.data.format).toBe('json');
      }
    });

    test('accepts all valid action values', () => {
      const actions = [
        'document_upload',
        'document_view',
        'document_download',
        'document_delete',
        'document_archived',
      ] as const;

      for (const action of actions) {
        const result = auditQuerySchema.safeParse({ action });
        expect(result.success).toBe(true);
      }
    });

    test('accepts UUID filters', () => {
      const result = auditQuerySchema.safeParse({
        user_id: VALID_UUID,
        document_id: VALID_UUID,
        service_instance_id: VALID_UUID,
      });
      expect(result.success).toBe(true);
    });

    test('rejects non-UUID user_id', () => {
      const result = auditQuerySchema.safeParse({ user_id: 'not-a-uuid' });
      expect(result.success).toBe(false);
    });

    test('accepts csv format', () => {
      const result = auditQuerySchema.safeParse({ format: 'csv' });
      expect(result.success).toBe(true);
    });

    test('rejects invalid format', () => {
      const result = auditQuerySchema.safeParse({ format: 'xml' });
      expect(result.success).toBe(false);
    });

    test('rejects limit over 100', () => {
      const result = auditQuerySchema.safeParse({ limit: 101 });
      expect(result.success).toBe(false);
    });

    test('accepts valid date range', () => {
      const result = auditQuerySchema.safeParse({
        date_from: new Date().toISOString(),
        date_to: new Date().toISOString(),
      });
      expect(result.success).toBe(true);
    });

    test('rejects invalid date_from format', () => {
      const result = auditQuerySchema.safeParse({ date_from: 'not-a-date' });
      expect(result.success).toBe(false);
    });

    test('rejects invalid action', () => {
      const result = auditQuerySchema.safeParse({ action: 'document_edit' });
      expect(result.success).toBe(false);
    });
  });
});
