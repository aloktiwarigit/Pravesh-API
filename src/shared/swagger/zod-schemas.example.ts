// ============================================================
// EXAMPLE: How to Add More Zod Schemas to OpenAPI
// ============================================================
//
// This file shows examples of registering different types of Zod schemas
// for OpenAPI generation. Copy patterns from here into zod-schemas.ts
// when adding new auto-generated schemas.
//
// DO NOT import this file - it's for reference only.
// ============================================================

import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';
import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);
const registry = new OpenAPIRegistry();

// ============================================================
// EXAMPLE 1: Simple Request Body Schema
// ============================================================

const createDealerSchema = registry.register(
  'CreateDealer',  // Schema name in OpenAPI spec
  z
    .object({
      fullName: z.string().min(2).max(100).openapi({
        description: 'Full name of the dealer',
        example: 'Rajesh Kumar',
      }),
      phone: z.string().regex(/^\+?[1-9]\d{9,14}$/).openapi({
        description: 'Phone number with optional country code',
        example: '+919876543210',
      }),
      email: z.string().email().openapi({
        description: 'Email address for communications',
        example: 'rajesh.kumar@example.com',
      }),
      cityId: z.string().uuid().openapi({
        description: 'UUID of the city where dealer will operate',
        example: 'c7b3d8e0-5e0b-4b0f-8b3a-3b9f4b3d3b3d',
      }),
      aadhaarNumber: z.string().length(12).openapi({
        description: '12-digit Aadhaar number',
        example: '123456789012',
      }),
      panNumber: z.string().length(10).openapi({
        description: '10-character PAN number',
        example: 'ABCDE1234F',
      }),
    })
    .openapi({
      description: 'Request body for dealer registration',
    }),
);

// ============================================================
// EXAMPLE 2: Query Parameters Schema
// ============================================================

const listDealersQuerySchema = registry.register(
  'ListDealersQuery',
  z
    .object({
      page: z.coerce.number().int().positive().default(1).openapi({
        description: 'Page number (1-indexed)',
        example: 1,
      }),
      limit: z.coerce.number().int().min(1).max(100).default(10).openapi({
        description: 'Items per page (max 100)',
        example: 10,
      }),
      status: z.enum(['PENDING_KYC', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional().openapi({
        description: 'Filter by dealer status',
        example: 'ACTIVE',
      }),
      cityId: z.string().uuid().optional().openapi({
        description: 'Filter by city UUID',
        example: 'c7b3d8e0-5e0b-4b0f-8b3a-3b9f4b3d3b3d',
      }),
      searchTerm: z.string().optional().openapi({
        description: 'Search by name, phone, or dealer code',
        example: 'Rajesh',
      }),
    })
    .openapi({
      description: 'Query parameters for listing dealers',
    }),
);

// ============================================================
// EXAMPLE 3: Response Schema with Nested Objects
// ============================================================

const dealerProfileSchema = registry.register(
  'DealerProfile',
  z
    .object({
      id: z.string().uuid().openapi({
        description: 'Dealer UUID',
        example: 'd7e3c8f0-6f1c-4c1g-9c4b-4c0g5c4e4c4e',
      }),
      dealerCode: z.string().openapi({
        description: 'Unique dealer code',
        example: 'DLR-DEL-00123',
      }),
      fullName: z.string().openapi({
        description: 'Full name',
        example: 'Rajesh Kumar',
      }),
      phone: z.string().openapi({
        description: 'Phone number',
        example: '+919876543210',
      }),
      email: z.string().email().openapi({
        description: 'Email address',
        example: 'rajesh.kumar@example.com',
      }),
      status: z.enum(['PENDING_KYC', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED']).openapi({
        description: 'Current dealer status',
        example: 'ACTIVE',
      }),
      currentTier: z.enum(['BRONZE', 'SILVER', 'GOLD']).openapi({
        description: 'Current tier based on performance',
        example: 'SILVER',
      }),
      totalReferrals: z.number().int().nonnegative().openapi({
        description: 'Total lifetime referrals',
        example: 42,
      }),
      monthlyReferrals: z.number().int().nonnegative().openapi({
        description: 'Referrals this month',
        example: 7,
      }),
      whiteLabelEnabled: z.boolean().openapi({
        description: 'Whether white-label branding is enabled',
        example: false,
      }),
      city: z
        .object({
          id: z.string().uuid().openapi({ description: 'City UUID' }),
          cityName: z.string().openapi({ description: 'City name', example: 'Mumbai' }),
          state: z.string().openapi({ description: 'State name', example: 'Maharashtra' }),
        })
        .openapi({
          description: 'City information',
        }),
      createdAt: z.string().datetime().openapi({
        description: 'ISO 8601 timestamp of dealer creation',
        example: '2025-01-15T10:30:00.000Z',
      }),
      updatedAt: z.string().datetime().openapi({
        description: 'ISO 8601 timestamp of last update',
        example: '2026-02-14T14:20:00.000Z',
      }),
    })
    .openapi({
      description: 'Complete dealer profile with all details',
    }),
);

// ============================================================
// EXAMPLE 4: Array Response (Paginated List)
// ============================================================

const dealerListResponseSchema = registry.register(
  'DealerListResponse',
  z
    .object({
      success: z.literal(true).openapi({
        description: 'Indicates successful response',
      }),
      data: z.array(dealerProfileSchema).openapi({
        description: 'Array of dealer profiles',
      }),
      meta: z
        .object({
          page: z.number().int().positive().openapi({ description: 'Current page' }),
          limit: z.number().int().positive().openapi({ description: 'Items per page' }),
          total: z.number().int().nonnegative().openapi({ description: 'Total items' }),
          totalPages: z.number().int().nonnegative().openapi({ description: 'Total pages' }),
        })
        .openapi({
          description: 'Pagination metadata',
        }),
    })
    .openapi({
      description: 'Paginated list of dealers',
    }),
);

// ============================================================
// EXAMPLE 5: Enum Schema
// ============================================================

const dealerStatusSchema = registry.register(
  'DealerStatus',
  z.enum(['PENDING_KYC', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED']).openapi({
    description: 'Possible dealer account statuses',
    example: 'ACTIVE',
  }),
);

// ============================================================
// EXAMPLE 6: Optional Fields and Nullable Fields
// ============================================================

const updateDealerSchema = registry.register(
  'UpdateDealer',
  z
    .object({
      fullName: z.string().min(2).max(100).optional().openapi({
        description: 'Update dealer full name',
        example: 'Rajesh Kumar Sharma',
      }),
      phone: z.string().regex(/^\+?[1-9]\d{9,14}$/).optional().openapi({
        description: 'Update phone number',
        example: '+919876543210',
      }),
      whiteLabelBrandName: z.string().nullable().optional().openapi({
        description: 'White-label brand name (null to disable)',
        example: 'Kumar Properties',
      }),
      status: z.enum(['ACTIVE', 'SUSPENDED', 'DEACTIVATED']).optional().openapi({
        description: 'Update dealer status',
        example: 'ACTIVE',
      }),
    })
    .openapi({
      description: 'Request body for updating dealer profile (all fields optional)',
    }),
);

// ============================================================
// EXAMPLE 7: Union/Discriminated Union Schema
// ============================================================

const paymentMethodSchema = registry.register(
  'PaymentMethod',
  z
    .discriminatedUnion('type', [
      z.object({
        type: z.literal('UPI').openapi({ description: 'UPI payment method' }),
        vpa: z.string().openapi({ description: 'UPI VPA', example: 'rajesh@paytm' }),
      }),
      z.object({
        type: z.literal('BANK_TRANSFER').openapi({ description: 'Bank transfer method' }),
        accountNumber: z.string().openapi({ description: 'Bank account number', example: '12345678901' }),
        ifscCode: z.string().openapi({ description: 'IFSC code', example: 'SBIN0001234' }),
      }),
      z.object({
        type: z.literal('RAZORPAY').openapi({ description: 'Razorpay payment' }),
        orderId: z.string().openapi({ description: 'Razorpay order ID', example: 'order_123abc' }),
      }),
    ])
    .openapi({
      description: 'Payment method details (discriminated by type)',
    }),
);

// ============================================================
// EXAMPLE 8: Schema with Custom Refinements/Transformations
// ============================================================

const createPaymentSchema = registry.register(
  'CreatePayment',
  z
    .object({
      amountPaise: z.number().int().positive().openapi({
        description: 'Payment amount in paise (1 INR = 100 paise)',
        example: 50000,
      }),
      currency: z.literal('INR').default('INR').openapi({
        description: 'Currency code (currently only INR supported)',
        example: 'INR',
      }),
      serviceRequestId: z.string().uuid().openapi({
        description: 'UUID of the service request being paid for',
        example: 'e8f4d9g1-7g2d-5d2h-0d5c-5d1h6d5f5d5f',
      }),
      paymentMethod: paymentMethodSchema.openapi({
        description: 'Payment method details',
      }),
    })
    .openapi({
      description: 'Request body for initiating a payment',
    }),
);

// ============================================================
// EXAMPLE 9: Path Parameters Schema
// ============================================================

const dealerIdParamSchema = registry.register(
  'DealerIdParam',
  z
    .object({
      id: z.string().uuid().openapi({
        description: 'Dealer UUID from path parameter',
        example: 'd7e3c8f0-6f1c-4c1g-9c4b-4c0g5c4e4c4e',
      }),
    })
    .openapi({
      description: 'Path parameter containing dealer ID',
    }),
);

// ============================================================
// EXAMPLE 10: Generic Success/Error Wrappers
// ============================================================

const genericSuccessSchema = registry.register(
  'GenericSuccess',
  z
    .object({
      success: z.literal(true).openapi({
        description: 'Operation succeeded',
      }),
      message: z.string().openapi({
        description: 'Success message',
        example: 'Dealer created successfully',
      }),
    })
    .openapi({
      description: 'Generic success response',
    }),
);

const genericErrorSchema = registry.register(
  'GenericError',
  z
    .object({
      success: z.literal(false).openapi({
        description: 'Operation failed',
      }),
      error: z
        .object({
          code: z.string().openapi({
            description: 'Error code',
            example: 'DEALER_NOT_FOUND',
          }),
          message: z.string().openapi({
            description: 'Human-readable error message',
            example: 'The requested dealer could not be found',
          }),
          details: z.any().optional().openapi({
            description: 'Optional additional error details',
          }),
        })
        .openapi({
          description: 'Error information',
        }),
    })
    .openapi({
      description: 'Generic error response',
    }),
);

// ============================================================
// Usage in openapi-spec.ts paths:
// ============================================================

/*
paths: {
  '/api/v1/dealers': {
    get: {
      summary: 'List dealers',
      parameters: [
        { in: 'query', name: 'page', schema: { type: 'integer' } },
        { in: 'query', name: 'limit', schema: { type: 'integer' } },
        // ... or reference the query schema directly
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DealerListResponse' }
            }
          }
        }
      }
    },
    post: {
      summary: 'Create dealer',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateDealer' }
          }
        }
      },
      responses: {
        '201': {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DealerProfile' }
            }
          }
        },
        '400': {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationErrorResponse' }
            }
          }
        }
      }
    }
  },
  '/api/v1/dealers/{id}': {
    get: {
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string', format: 'uuid' }
        }
      ],
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DealerProfile' }
            }
          }
        },
        '404': {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/GenericError' }
            }
          }
        }
      }
    },
    patch: {
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UpdateDealer' }
          }
        }
      },
      responses: {
        '200': {
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DealerProfile' }
            }
          }
        }
      }
    }
  }
}
*/
