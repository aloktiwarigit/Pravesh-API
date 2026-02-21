// ============================================================
// Auto-generated OpenAPI Schemas from Zod Validation Schemas
// ============================================================
//
// This module uses @asteasolutions/zod-to-openapi to automatically
// generate OpenAPI 3.0 schemas from Zod validation schemas used
// throughout the codebase.
//
// DEPENDENCY REQUIRED (add to package.json):
//   npm install @asteasolutions/zod-to-openapi
//
// ============================================================

import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { OpenAPIRegistry, OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';

let _initialized = false;

function ensureInitialized() {
  if (_initialized) return;
  _initialized = true;
  extendZodWithOpenApi(z);
}

// ============================================================
// Generate OpenAPI Spec Component
// ============================================================

/**
 * Generates the OpenAPI components.schemas object from registered Zod schemas.
 * Lazily initializes zod-to-openapi to avoid import-order crashes.
 */
export function generateZodSchemas(): Record<string, any> {
  ensureInitialized();

  const registry = new OpenAPIRegistry();

  const submitRequestSchema = registry.register(
    'SubmitServiceRequest',
    z.object({
      serviceId: z.string().min(1).openapi({ description: 'Unique identifier of the service definition', example: 'svc_123abc' }),
      propertyType: z.string().min(1).openapi({ description: 'Type of property (e.g., residential, commercial)', example: 'residential' }),
      propertyLocation: z.string().min(1).openapi({ description: 'Full address or location of the property', example: 'Plot 123, Sector 45, Gurgaon, Haryana' }),
      ownershipStatus: z.string().min(1).openapi({ description: 'Ownership status (e.g., self, family, third-party)', example: 'self' }),
      packageId: z.string().optional().openapi({ description: 'Optional package/plan identifier for bundled services', example: 'pkg_premium_001' }),
      estimatedValuePaise: z.number().int().positive().optional().openapi({ description: 'Estimated property value in paise (1 INR = 100 paise)', example: 5000000000 }),
    }).openapi({ description: 'Request body for submitting a new service request from a customer' }),
  );

  const addServiceSchema = registry.register(
    'AddService',
    z.object({
      serviceId: z.string().min(1).openapi({ description: 'Unique identifier of the service to add', example: 'svc_456def' }),
    }).openapi({ description: 'Request body for adding a service to an existing service request' }),
  );

  const serviceRequestResponseSchema = registry.register(
    'ServiceRequestResponse',
    z.object({
      id: z.string().openapi({ description: 'Unique identifier of the service request', example: 'req_789ghi' }),
      requestNumber: z.string().openapi({ description: 'Human-readable request number', example: 'SR-2026-00123' }),
      serviceCode: z.string().openapi({ description: 'Service code', example: 'PROP_VERIFY' }),
      status: z.string().openapi({ description: 'Current status of the service request', example: 'PENDING_PAYMENT' }),
      paymentStatus: z.string().openapi({ description: 'Payment status', example: 'PENDING' }),
      createdAt: z.string().openapi({ description: 'ISO 8601 timestamp of request creation', example: '2026-02-14T10:30:00.000Z' }),
    }).openapi({ description: 'Service request creation response' }),
  );

  const serviceRequestListItemSchema = registry.register(
    'ServiceRequestListItem',
    z.object({
      id: z.string().openapi({ description: 'Service request ID' }),
      requestNumber: z.string().openapi({ description: 'Request number' }),
      serviceNameEn: z.string().nullable().openapi({ description: 'Service name in English' }),
      serviceNameHi: z.string().nullable().openapi({ description: 'Service name in Hindi' }),
      serviceCode: z.string().openapi({ description: 'Service code' }),
      status: z.string().openapi({ description: 'Request status' }),
      paymentStatus: z.string().openapi({ description: 'Payment status' }),
      propertyType: z.string().nullable().openapi({ description: 'Property type' }),
      propertyLocation: z.string().nullable().openapi({ description: 'Property location' }),
      createdAt: z.string().openapi({ description: 'Creation timestamp' }),
      updatedAt: z.string().openapi({ description: 'Last update timestamp' }),
    }).openapi({ description: 'Single service request in list view' }),
  );

  const validationErrorDetailSchema = registry.register(
    'ValidationErrorDetail',
    z.object({
      path: z.string().openapi({ description: 'Dot-separated path to the invalid field', example: 'serviceId' }),
      message: z.string().openapi({ description: 'Human-readable error message', example: 'String must contain at least 1 character(s)' }),
      code: z.string().openapi({ description: 'Zod error code', example: 'too_small' }),
    }).openapi({ description: 'Details of a single validation error' }),
  );

  const validationErrorResponseSchema = registry.register(
    'ValidationErrorResponse',
    z.object({
      success: z.literal(false).openapi({ description: 'Indicates the request was unsuccessful' }),
      error: z.object({
        code: z.literal('VALIDATION_ERROR').openapi({ description: 'Error code for validation failures' }),
        message: z.string().openapi({ description: 'High-level error message', example: 'Invalid body parameters' }),
        details: z.array(validationErrorDetailSchema).openapi({ description: 'Array of specific validation errors' }),
      }).openapi({ description: 'Error information' }),
    }).openapi({ description: 'Response returned when Zod validation fails' }),
  );

  const paginationMetaSchema = registry.register(
    'PaginationMeta',
    z.object({
      page: z.number().int().positive().openapi({ description: 'Current page number (1-indexed)', example: 1 }),
      limit: z.number().int().positive().openapi({ description: 'Number of items per page', example: 10 }),
      total: z.number().int().nonnegative().openapi({ description: 'Total number of items across all pages', example: 42 }),
      totalPages: z.number().int().nonnegative().openapi({ description: 'Total number of pages', example: 5 }),
    }).openapi({ description: 'Pagination metadata for list endpoints' }),
  );

  const generator = new OpenApiGeneratorV3(registry.definitions);
  const generatedSpec = generator.generateComponents();

  return generatedSpec.components?.schemas || {};
}

/**
 * List of schema names that were auto-generated from Zod.
 * Useful for documentation and debugging.
 */
export const autoGeneratedSchemaNames = [
  'SubmitServiceRequest',
  'AddService',
  'ServiceRequestResponse',
  'ServiceRequestListItem',
  'ValidationErrorDetail',
  'ValidationErrorResponse',
  'PaginationMeta',
];

/**
 * Export the registry for potential extension by other modules.
 */
export function getZodOpenApiRegistry(): OpenAPIRegistry {
  ensureInitialized();
  return new OpenAPIRegistry();
}
