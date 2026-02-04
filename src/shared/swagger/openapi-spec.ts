// ============================================================
// OpenAPI 3.0 Specification for Property Legal Agent API
// ============================================================

export const openApiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'Property Legal Agent API',
    version: '1.0.0',
    description:
      'Comprehensive API for property legal services including franchise management, dealer networks, builder portal, NRI services, POA management, court tracking, analytics, and more.',
    contact: {
      name: 'Property Legal Agent Engineering',
    },
    license: {
      name: 'Proprietary',
    },
  },
  servers: [
    {
      url: 'http://localhost:3000',
      description: 'Local development server',
    },
    {
      url: 'https://api.propertylegalagent.com',
      description: 'Production server',
    },
  ],

  // ============================================================
  // Security Schemes
  // ============================================================
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http' as const,
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          'Firebase JWT token. Obtain via Firebase Authentication and pass as Authorization: Bearer <token>',
      },
    },
    schemas: {
      // -- Shared response wrappers --
      SuccessResponse: {
        type: 'object' as const,
        properties: {
          success: { type: 'boolean' as const, example: true },
          data: { type: 'object' as const },
        },
      },
      ErrorResponse: {
        type: 'object' as const,
        properties: {
          success: { type: 'boolean' as const, example: false },
          error: {
            type: 'object' as const,
            properties: {
              code: { type: 'string' as const, example: 'VALIDATION_ERROR' },
              message: { type: 'string' as const, example: 'Validation failed' },
              details: { type: 'array' as const, items: { type: 'object' as const } },
            },
          },
        },
      },
      PaginationMeta: {
        type: 'object' as const,
        properties: {
          nextCursor: { type: 'string' as const, nullable: true },
          limit: { type: 'integer' as const },
        },
      },

      // -- City --
      CityConfig: {
        type: 'object' as const,
        properties: {
          id: { type: 'string' as const, format: 'uuid' },
          cityName: { type: 'string' as const, example: 'Mumbai' },
          state: { type: 'string' as const, example: 'Maharashtra' },
          isActive: { type: 'boolean' as const },
          configData: { type: 'object' as const },
          createdAt: { type: 'string' as const, format: 'date-time' },
        },
      },
      CreateCityRequest: {
        type: 'object' as const,
        required: ['cityName', 'state', 'configData'],
        properties: {
          cityName: { type: 'string' as const, minLength: 2, maxLength: 100 },
          state: { type: 'string' as const, minLength: 2, maxLength: 100 },
          configData: { type: 'object' as const, description: 'City configuration JSON' },
        },
      },

      // -- Dealer --
      DealerProfile: {
        type: 'object' as const,
        properties: {
          id: { type: 'string' as const, format: 'uuid' },
          dealerCode: { type: 'string' as const },
          status: { type: 'string' as const, enum: ['PENDING_KYC', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED'] },
          currentTier: { type: 'string' as const, enum: ['BRONZE', 'SILVER', 'GOLD'] },
          totalReferrals: { type: 'integer' as const },
          monthlyReferrals: { type: 'integer' as const },
          whiteLabelEnabled: { type: 'boolean' as const },
          whiteLabelBrandName: { type: 'string' as const, nullable: true },
          kycStatus: { type: 'string' as const, nullable: true },
          cityId: { type: 'string' as const, format: 'uuid' },
          createdAt: { type: 'string' as const, format: 'date-time' },
        },
      },
      DealerKycSubmit: {
        type: 'object' as const,
        required: ['fullName', 'phone', 'aadhaarNumber', 'panNumber'],
        properties: {
          fullName: { type: 'string' as const },
          phone: { type: 'string' as const },
          aadhaarNumber: { type: 'string' as const },
          panNumber: { type: 'string' as const },
          cityId: { type: 'string' as const, format: 'uuid' },
        },
      },

      // -- Builder --
      BuilderRegistration: {
        type: 'object' as const,
        required: ['companyName', 'reraNumber', 'contactEmail', 'contactPhone'],
        properties: {
          companyName: { type: 'string' as const },
          reraNumber: { type: 'string' as const },
          contactEmail: { type: 'string' as const, format: 'email' },
          contactPhone: { type: 'string' as const },
          gstNumber: { type: 'string' as const },
        },
      },
      ProjectCreate: {
        type: 'object' as const,
        required: ['projectName', 'cityId'],
        properties: {
          projectName: { type: 'string' as const },
          cityId: { type: 'string' as const, format: 'uuid' },
          address: { type: 'string' as const },
          totalUnits: { type: 'integer' as const },
        },
      },

      // -- Export --
      ExportRequest: {
        type: 'object' as const,
        required: ['exportType', 'format'],
        properties: {
          exportType: {
            type: 'string' as const,
            enum: ['revenue', 'agent_performance', 'dealer_commissions', 'service_list', 'sla_report', 'referral_history', 'pipeline_forecast'],
          },
          format: { type: 'string' as const, enum: ['pdf', 'csv', 'xlsx'] },
          cityId: { type: 'string' as const, format: 'uuid' },
          filters: { type: 'object' as const },
        },
      },

      // -- Franchise Application --
      FranchiseApplication: {
        type: 'object' as const,
        properties: {
          id: { type: 'string' as const, format: 'uuid' },
          applicantName: { type: 'string' as const },
          status: { type: 'string' as const },
          cityId: { type: 'string' as const, format: 'uuid' },
          createdAt: { type: 'string' as const, format: 'date-time' },
        },
      },

      // -- Training Module --
      TrainingModule: {
        type: 'object' as const,
        properties: {
          id: { type: 'string' as const, format: 'uuid' },
          moduleName: { type: 'string' as const },
          contentType: { type: 'string' as const, enum: ['video', 'pdf', 'quiz'] },
          isMandatory: { type: 'boolean' as const },
        },
      },
      CreateTrainingModule: {
        type: 'object' as const,
        required: ['moduleName', 'contentType'],
        properties: {
          cityId: { type: 'string' as const, format: 'uuid' },
          moduleName: { type: 'string' as const },
          description: { type: 'string' as const },
          contentType: { type: 'string' as const, enum: ['video', 'pdf', 'quiz'] },
          contentUrl: { type: 'string' as const, format: 'uri' },
          quizData: { type: 'object' as const },
          learningPath: { type: 'string' as const },
          isMandatory: { type: 'boolean' as const, default: false },
          sortOrder: { type: 'integer' as const },
        },
      },

      // -- Health --
      HealthCheck: {
        type: 'object' as const,
        properties: {
          status: { type: 'string' as const, enum: ['healthy', 'unhealthy'] },
          timestamp: { type: 'string' as const, format: 'date-time' },
          version: { type: 'string' as const },
          checks: {
            type: 'object' as const,
            properties: {
              database: {
                type: 'object' as const,
                properties: {
                  status: { type: 'string' as const },
                  message: { type: 'string' as const },
                },
              },
            },
          },
        },
      },
    },

    // -- Reusable Responses --
    responses: {
      BadRequest: {
        description: 'Validation error or malformed request',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
        },
      },
      Unauthorized: {
        description: 'Missing or invalid authentication token',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
        },
      },
      Forbidden: {
        description: 'Insufficient permissions for this operation',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
        },
      },
      NotFound: {
        description: 'Requested resource not found',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
        },
      },
      InternalError: {
        description: 'Internal server error',
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
        },
      },
    },
  },

  // ============================================================
  // Tags
  // ============================================================
  tags: [
    { name: 'Health & Metrics', description: 'Server health checks and performance metrics' },
    { name: 'Cities', description: 'City configuration and management (Epic 14)' },
    { name: 'City Service Fees', description: 'City-level service fee schedules' },
    { name: 'City Process Overrides', description: 'City-specific process configuration overrides' },
    { name: 'City Document Requirements', description: 'City-specific document requirements' },
    { name: 'Franchise Applications', description: 'Franchise application lifecycle management' },
    { name: 'Franchise Agents', description: 'Agent management within franchise cities' },
    { name: 'Franchise Dealers', description: 'Dealer management within franchise network' },
    { name: 'Franchise Revenue', description: 'Franchise revenue tracking and reporting' },
    { name: 'Training Modules', description: 'Agent training content and quiz management' },
    { name: 'Corporate Audits', description: 'Corporate audit trail and compliance' },
    { name: 'Analytics', description: 'City-level, platform-level, and market intelligence analytics' },
    { name: 'Exports', description: 'Report export requests (PDF, CSV, XLSX)' },
    { name: 'Feature Usage', description: 'Feature usage tracking for analytics' },
    { name: 'BigQuery Pipeline', description: 'BigQuery data pipeline management' },
    { name: 'Dealers', description: 'Dealer network: KYC, referrals, pipeline, tiers, badges, bank accounts (Epic 9)' },
    { name: 'Dealer Commissions', description: 'Dealer earnings, commission history, payouts, and forecasts (Epic 9)' },
    { name: 'Builders', description: 'Builder registration, projects, units, bulk services, contracts, broadcasts (Epic 11)' },
    { name: 'NRI Payments', description: 'International UPI and wire transfers for NRI customers (Epic 13)' },
    { name: 'Exchange Rates', description: 'Currency exchange rate management' },
    { name: 'Ops NRI Payments', description: 'Ops dashboard for NRI payment reconciliation' },
    { name: 'POA', description: 'Power of Attorney templates, execution, and verification (Epic 13)' },
    { name: 'Court Tracking', description: 'Court hearings, adjournments, orders, and event notifications (Epic 13)' },
    { name: 'Consultations', description: 'Legal consultation booking and management' },
    { name: 'NRI Documents', description: 'NRI document coordination and apostille tracking' },
  ],

  // ============================================================
  // Paths
  // ============================================================
  paths: {
    // ==================== Health & Metrics ====================
    '/health': {
      get: {
        tags: ['Health & Metrics'],
        summary: 'Health check',
        description: 'Returns server health status including database connectivity. No authentication required.',
        responses: {
          '200': {
            description: 'All systems healthy',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean' },
                    data: { $ref: '#/components/schemas/HealthCheck' },
                  },
                },
              },
            },
          },
          '503': { description: 'One or more subsystems unhealthy' },
        },
      },
    },
    '/metrics': {
      get: {
        tags: ['Health & Metrics'],
        summary: 'Application metrics',
        description: 'Returns request count, duration, and error metrics. No authentication required.',
        responses: {
          '200': {
            description: 'Metrics snapshot',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SuccessResponse' },
              },
            },
          },
        },
      },
    },

    // ==================== Cities ====================
    '/api/v1/cities': {
      get: {
        tags: ['Cities'],
        summary: 'List active cities',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': {
            description: 'List of active cities',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
        },
      },
      post: {
        tags: ['Cities'],
        summary: 'Create a new city (Super Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/CreateCityRequest' } },
          },
        },
        responses: {
          '201': {
            description: 'City created',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/v1/cities/all': {
      get: {
        tags: ['Cities'],
        summary: 'List all cities including inactive (Super Admin)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'All cities', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/v1/cities/{id}': {
      get: {
        tags: ['Cities'],
        summary: 'Get city configuration by ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'City config', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/v1/cities/{id}/config': {
      put: {
        tags: ['Cities'],
        summary: 'Update city configuration (Super Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { configData: { type: 'object' } } } } },
        },
        responses: {
          '200': { description: 'Updated config', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/v1/cities/{id}/deactivate': {
      patch: {
        tags: ['Cities'],
        summary: 'Deactivate a city (Super Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'City deactivated', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/v1/cities/{id}/activate': {
      patch: {
        tags: ['Cities'],
        summary: 'Activate a city (Super Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'City activated', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '403': { $ref: '#/components/responses/Forbidden' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ==================== City Service Fees ====================
    '/api/v1/city-service-fees': {
      get: {
        tags: ['City Service Fees'],
        summary: 'List city service fee schedules',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'cityId', in: 'query', schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Fee schedules', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
        },
      },
      post: {
        tags: ['City Service Fees'],
        summary: 'Create a service fee schedule',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } },
        },
        responses: {
          '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },

    // ==================== City Process Overrides ====================
    '/api/v1/city-process-overrides': {
      get: {
        tags: ['City Process Overrides'],
        summary: 'List city process overrides',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'cityId', in: 'query', schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Overrides list', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
        },
      },
      post: {
        tags: ['City Process Overrides'],
        summary: 'Create a process override',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },

    // ==================== City Document Requirements ====================
    '/api/v1/city-document-requirements': {
      get: {
        tags: ['City Document Requirements'],
        summary: 'List city document requirements',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'cityId', in: 'query', schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Requirements list', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
        },
      },
      post: {
        tags: ['City Document Requirements'],
        summary: 'Create a document requirement',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          '201': { description: 'Created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },

    // ==================== Franchise Applications ====================
    '/api/v1/franchise-applications': {
      post: {
        tags: ['Franchise Applications'],
        summary: 'Submit a franchise application',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          '201': { description: 'Application submitted', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
        },
      },
      get: {
        tags: ['Franchise Applications'],
        summary: 'List franchise applications (Super Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'cityId', in: 'query', schema: { type: 'string', format: 'uuid' } },
        ],
        responses: {
          '200': { description: 'Applications list', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/v1/franchise-applications/{id}': {
      get: {
        tags: ['Franchise Applications'],
        summary: 'Get application details (Super Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Application details', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/v1/franchise-applications/{id}/status': {
      patch: {
        tags: ['Franchise Applications'],
        summary: 'Update application status (Super Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['pending_review', 'info_requested', 'interview_scheduled', 'approved', 'rejected', 'agreement_sent', 'onboarded'] },
                  reviewNotes: { type: 'string' },
                  reviewChecklist: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Status updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/v1/franchise-applications/{id}/send-agreement': {
      post: {
        tags: ['Franchise Applications'],
        summary: 'Send franchise agreement document (Super Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { agreementDocUrl: { type: 'string', format: 'uri' } } } } },
        },
        responses: {
          '200': { description: 'Agreement sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/v1/franchise-applications/{id}/onboard': {
      post: {
        tags: ['Franchise Applications'],
        summary: 'Complete franchise onboarding (Super Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['signedAgreementUrl', 'ownerUserId', 'contractTerms'],
                properties: {
                  signedAgreementUrl: { type: 'string', format: 'uri' },
                  ownerUserId: { type: 'string' },
                  contractTerms: { type: 'object' },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Onboarding complete', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },

    // ==================== Franchise Agents ====================
    '/api/v1/franchise-agents': {
      get: {
        tags: ['Franchise Agents'],
        summary: 'List franchise agents',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Agents list', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
      post: {
        tags: ['Franchise Agents'],
        summary: 'Register a new franchise agent',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          '201': { description: 'Agent created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
        },
      },
    },

    // ==================== Franchise Dealers ====================
    '/api/v1/franchise-dealers': {
      get: {
        tags: ['Franchise Dealers'],
        summary: 'List franchise dealers',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Dealers list', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
      post: {
        tags: ['Franchise Dealers'],
        summary: 'Register a new franchise dealer',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          '201': { description: 'Dealer created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
        },
      },
    },

    // ==================== Franchise Revenue ====================
    '/api/v1/franchise-revenue': {
      get: {
        tags: ['Franchise Revenue'],
        summary: 'Get franchise revenue summary',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'cityId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'period', in: 'query', schema: { type: 'string', enum: ['daily', 'weekly', 'monthly'] } },
        ],
        responses: { '200': { description: 'Revenue data', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },

    // ==================== Training Modules ====================
    '/api/v1/training-modules': {
      post: {
        tags: ['Training Modules'],
        summary: 'Create a training module (Franchise Owner / Super Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateTrainingModule' } } },
        },
        responses: {
          '201': { description: 'Module created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/v1/training-modules/{cityId}': {
      get: {
        tags: ['Training Modules'],
        summary: 'Get training modules for a city',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'cityId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Modules list', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/training-modules/{cityId}/paths': {
      get: {
        tags: ['Training Modules'],
        summary: 'Get learning paths for a city',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'cityId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Learning paths', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/training-modules/{moduleId}/quiz-submit': {
      post: {
        tags: ['Training Modules'],
        summary: 'Submit quiz answers for a training module',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'moduleId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { agentId: { type: 'string', format: 'uuid' }, score: { type: 'integer', minimum: 0, maximum: 100 } } } } },
        },
        responses: { '200': { description: 'Quiz result', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/training-modules/{moduleId}/complete': {
      post: {
        tags: ['Training Modules'],
        summary: 'Mark a training module as completed',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'moduleId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { agentId: { type: 'string', format: 'uuid' } } } } },
        },
        responses: { '200': { description: 'Module completed', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/training-modules/progress/{agentId}/{cityId}': {
      get: {
        tags: ['Training Modules'],
        summary: 'Get agent training progress',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'agentId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'cityId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': { description: 'Training progress', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/training-modules/dashboard/{cityId}': {
      get: {
        tags: ['Training Modules'],
        summary: 'Training dashboard for a city (Franchise Owner / Super Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'cityId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Training dashboard', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },

    // ==================== Corporate Audits ====================
    '/api/v1/corporate-audits': {
      get: {
        tags: ['Corporate Audits'],
        summary: 'List corporate audit records',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Audit records', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
      post: {
        tags: ['Corporate Audits'],
        summary: 'Create an audit record',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          '201': { description: 'Audit created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
        },
      },
    },

    // ==================== Analytics ====================
    '/api/v1/analytics/city/{cityId}/kpis': {
      get: {
        tags: ['Analytics'],
        summary: 'Get city-level KPIs (Franchise Owner / Super Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'cityId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'start', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'end', in: 'query', schema: { type: 'string', format: 'date' } },
        ],
        responses: {
          '200': { description: 'City KPIs', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/v1/analytics/city/{cityId}/agent-leaderboard': {
      get: {
        tags: ['Analytics'],
        summary: 'Agent leaderboard for a city',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'cityId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
        ],
        responses: { '200': { description: 'Agent leaderboard', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/analytics/city/{cityId}/dealer-leaderboard': {
      get: {
        tags: ['Analytics'],
        summary: 'Dealer leaderboard for a city',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'cityId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
        ],
        responses: { '200': { description: 'Dealer leaderboard', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/analytics/platform/kpis': {
      get: {
        tags: ['Analytics'],
        summary: 'Platform-wide KPIs (Super Admin)',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Platform KPIs', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/v1/analytics/platform/city-comparison': {
      get: {
        tags: ['Analytics'],
        summary: 'City comparison table (Super Admin)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Comparison data', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/analytics/compare-cities': {
      get: {
        tags: ['Analytics'],
        summary: 'Side-by-side city comparison (Super Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'cityIdA', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'cityIdB', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { '200': { description: 'Comparison result', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/analytics/platform/heatmap': {
      get: {
        tags: ['Analytics'],
        summary: 'Geographic heatmap data (Super Admin)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Heatmap data', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/analytics/platform/trends': {
      get: {
        tags: ['Analytics'],
        summary: 'Platform-wide trend data (Super Admin)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'months', in: 'query', schema: { type: 'integer', default: 12 } }],
        responses: { '200': { description: 'Trend data', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/analytics/market-intelligence/{cityId}': {
      get: {
        tags: ['Analytics'],
        summary: 'Market intelligence report for a city',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'cityId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Market intelligence report', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },

    // ==================== Exports ====================
    '/api/v1/exports': {
      post: {
        tags: ['Exports'],
        summary: 'Request an export (Ops Manager / Franchise Owner / Super Admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ExportRequest' } } },
        },
        responses: {
          '201': { description: 'Export job created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
      get: {
        tags: ['Exports'],
        summary: 'List user export jobs',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Export list', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/exports/{id}': {
      get: {
        tags: ['Exports'],
        summary: 'Get export job status',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          '200': { description: 'Export status', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ==================== Feature Usage ====================
    '/api/v1/feature-usage': {
      get: {
        tags: ['Feature Usage'],
        summary: 'Get feature usage analytics',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Feature usage data', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
      post: {
        tags: ['Feature Usage'],
        summary: 'Track a feature usage event',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '201': { description: 'Event tracked', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },

    // ==================== BigQuery Pipeline ====================
    '/api/v1/bigquery': {
      get: {
        tags: ['BigQuery Pipeline'],
        summary: 'Get BigQuery pipeline status',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Pipeline status', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
      post: {
        tags: ['BigQuery Pipeline'],
        summary: 'Trigger a BigQuery pipeline sync',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '201': { description: 'Pipeline triggered', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },

    // ==================== Dealers (Epic 9) ====================
    '/api/v1/dealers/kyc': {
      post: {
        tags: ['Dealers'],
        summary: 'Submit dealer KYC',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/DealerKycSubmit' } } },
        },
        responses: {
          '201': { description: 'KYC submitted', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/api/v1/dealers/kyc/status': {
      get: {
        tags: ['Dealers'],
        summary: 'Check dealer KYC status',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'KYC status', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/dealers/ops/kyc-queue': {
      get: {
        tags: ['Dealers'],
        summary: 'Ops: list pending KYC applications',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'cityId', in: 'query', schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'KYC queue', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/dealers/ops/{dealerId}/approve': {
      post: {
        tags: ['Dealers'],
        summary: 'Ops: approve dealer KYC',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'dealerId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'KYC approved', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/dealers/ops/{dealerId}/reject': {
      post: {
        tags: ['Dealers'],
        summary: 'Ops: reject dealer KYC',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'dealerId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string' } } } } },
        },
        responses: { '200': { description: 'KYC rejected', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/dealers/ops/active': {
      get: {
        tags: ['Dealers'],
        summary: 'Ops: list active dealers',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'cityId', in: 'query', schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Active dealers', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/dealers/referral-data': {
      get: {
        tags: ['Dealers'],
        summary: 'Get dealer referral link and QR code URL',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Referral data', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/v1/dealers/track-click': {
      post: {
        tags: ['Dealers'],
        summary: 'Track referral link click',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['dealerCode'], properties: { dealerCode: { type: 'string' }, source: { type: 'string' }, metadata: { type: 'object' } } } } },
        },
        responses: { '200': { description: 'Click tracked', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/dealers/attribute': {
      post: {
        tags: ['Dealers'],
        summary: 'Attribute customer to dealer via deep link',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['customerId', 'dealerCode'], properties: { customerId: { type: 'string' }, dealerCode: { type: 'string' }, source: { type: 'string' } } } } },
        },
        responses: { '200': { description: 'Attribution result (always succeeds for customer)', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/dealers/pipeline': {
      get: {
        tags: ['Dealers'],
        summary: 'Dealer referral pipeline with privacy controls',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
        ],
        responses: { '200': { description: 'Pipeline data', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/dealers/tier-progress': {
      get: {
        tags: ['Dealers'],
        summary: 'Get dealer tier progress for current month',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Tier progress', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/dealers/leaderboard': {
      get: {
        tags: ['Dealers'],
        summary: 'City-scoped dealer leaderboard',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'period', in: 'query', schema: { type: 'string', enum: ['weekly', 'monthly', 'all_time'] } }],
        responses: { '200': { description: 'Leaderboard', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/dealers/badges': {
      get: {
        tags: ['Dealers'],
        summary: 'Get dealer gamification badges',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Badges', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/dealers/badges/progress': {
      get: {
        tags: ['Dealers'],
        summary: 'Get progress toward next badge',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Badge progress', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/dealers/white-label': {
      get: {
        tags: ['Dealers'],
        summary: 'Get white-label settings',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'White-label settings', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
      put: {
        tags: ['Dealers'],
        summary: 'Update white-label settings (Gold tier only)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { brandName: { type: 'string' }, logoUrl: { type: 'string', format: 'uri' }, enabled: { type: 'boolean' } } } } },
        },
        responses: {
          '200': { description: 'Updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '403': { $ref: '#/components/responses/Forbidden' },
        },
      },
    },
    '/api/v1/dealers/bank-accounts': {
      get: {
        tags: ['Dealers'],
        summary: 'List dealer bank accounts (masked)',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Bank accounts', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
      post: {
        tags: ['Dealers'],
        summary: 'Add a bank account',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '201': { description: 'Bank account added', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/dealers/bank-accounts/{accountId}/verify': {
      post: {
        tags: ['Dealers'],
        summary: 'Verify a bank account',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'accountId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { verificationCode: { type: 'string' } } } } } },
        responses: { '200': { description: 'Verified', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/dealers/bank-accounts/{accountId}/set-primary': {
      post: {
        tags: ['Dealers'],
        summary: 'Set a bank account as primary',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'accountId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Primary set', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/dealers/profile': {
      get: {
        tags: ['Dealers'],
        summary: 'Get current dealer profile',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'Dealer profile', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { $ref: '#/components/schemas/DealerProfile' } } } } } },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },

    // ==================== Dealer Commissions (Epic 9) ====================
    '/api/v1/dealer-commissions/earnings': {
      get: {
        tags: ['Dealer Commissions'],
        summary: 'Get dealer earnings summary',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Earnings summary', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/dealer-commissions/history': {
      get: {
        tags: ['Dealer Commissions'],
        summary: 'Get commission history (cursor-paginated)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string' } },
          { name: 'startDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'endDate', in: 'query', schema: { type: 'string', format: 'date' } },
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: { '200': { description: 'Commission history with pagination meta', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/dealer-commissions/export': {
      get: {
        tags: ['Dealer Commissions'],
        summary: 'Export commissions as CSV',
        security: [{ bearerAuth: [] }],
        responses: {
          '200': { description: 'CSV file stream', content: { 'text/csv': { schema: { type: 'string' } } } },
        },
      },
    },
    '/api/v1/dealer-commissions/forecast': {
      get: {
        tags: ['Dealer Commissions'],
        summary: 'Get projected earnings forecast',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Earnings forecast', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/dealer-commissions/pending': {
      get: {
        tags: ['Dealer Commissions'],
        summary: 'Get approved commissions awaiting payout',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Pending commissions', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/dealer-commissions/payouts': {
      get: {
        tags: ['Dealer Commissions'],
        summary: 'Get payout history',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 100 } },
        ],
        responses: { '200': { description: 'Payout history', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/dealer-commissions/ops/payout-dashboard': {
      get: {
        tags: ['Dealer Commissions'],
        summary: 'Ops: payout reconciliation dashboard',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'cityId', in: 'query', schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Payout dashboard', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },

    // ==================== Builders (Epic 11) ====================
    '/api/v1/builders/register': {
      post: {
        tags: ['Builders'],
        summary: 'Register a new builder',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/BuilderRegistration' } } },
        },
        responses: {
          '201': { description: 'Builder registered', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/api/v1/builders/{builderId}/approve': {
      post: {
        tags: ['Builders'],
        summary: 'Ops: approve or reject builder registration',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'builderId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['action'], properties: { action: { type: 'string', enum: ['approve', 'reject'] }, notes: { type: 'string' } } } } },
        },
        responses: { '200': { description: 'Builder approved/rejected', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/pending': {
      get: {
        tags: ['Builders'],
        summary: 'Ops: list pending builder verifications',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Pending builders', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/profile': {
      get: {
        tags: ['Builders'],
        summary: 'Get current builder profile',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Builder profile', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/projects': {
      post: {
        tags: ['Builders'],
        summary: 'Create a new project',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProjectCreate' } } } },
        responses: { '201': { description: 'Project created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
      get: {
        tags: ['Builders'],
        summary: 'List builder projects',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Projects list', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/projects/{projectId}': {
      get: {
        tags: ['Builders'],
        summary: 'Get project details',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Project details', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/projects/{projectId}/units': {
      get: {
        tags: ['Builders'],
        summary: 'List project units',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Units list', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
      post: {
        tags: ['Builders'],
        summary: 'Add a single unit to a project',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '201': { description: 'Unit added', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/projects/{projectId}/units/upload': {
      post: {
        tags: ['Builders'],
        summary: 'Upload buyer list CSV',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { csvData: { type: 'string' } } } } } },
        responses: { '200': { description: 'Upload result', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/projects/{projectId}/units/{unitId}': {
      put: {
        tags: ['Builders'],
        summary: 'Update a project unit',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
          { name: 'unitId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '200': { description: 'Unit updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/projects/{projectId}/bulk-services': {
      post: {
        tags: ['Builders'],
        summary: 'Create a bulk service request for a project',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '201': { description: 'Bulk service request created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/projects/{projectId}/bulk-services/preview': {
      post: {
        tags: ['Builders'],
        summary: 'Preview bulk service pricing',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { serviceIds: { type: 'array', items: { type: 'string' } }, unitCount: { type: 'integer' } } } } } },
        responses: { '200': { description: 'Pricing preview', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/projects/{projectId}/progress': {
      get: {
        tags: ['Builders'],
        summary: 'Get project-level progress dashboard',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Project progress', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/projects/{projectId}/timeline': {
      get: {
        tags: ['Builders'],
        summary: 'Get project timeline',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Project timeline', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/projects/{projectId}/pricing-tier': {
      get: {
        tags: ['Builders'],
        summary: 'Get project pricing tier',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Pricing tier', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/pricing-tiers/{tierId}': {
      put: {
        tags: ['Builders'],
        summary: 'Ops: override pricing tier discount',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'tierId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { discountPct: { type: 'number' }, notes: { type: 'string' } } } } } },
        responses: { '200': { description: 'Pricing tier updated', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/pricing-tiers/{tierId}/request-custom': {
      post: {
        tags: ['Builders'],
        summary: 'Request custom pricing for a tier',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'tierId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { requestedPct: { type: 'number' }, notes: { type: 'string' } } } } } },
        responses: { '200': { description: 'Custom pricing requested', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/projects/{projectId}/payments': {
      get: {
        tags: ['Builders'],
        summary: 'Get project payment summary',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Payment summary', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/units/{unitId}/payments': {
      get: {
        tags: ['Builders'],
        summary: 'Get unit payment details',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'unitId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Payment details', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/units/{unitId}/payment-reminder': {
      post: {
        tags: ['Builders'],
        summary: 'Send payment reminder for a unit',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'unitId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Reminder sent', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/contracts': {
      post: {
        tags: ['Builders'],
        summary: 'Create a builder contract',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '201': { description: 'Contract created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
      get: {
        tags: ['Builders'],
        summary: 'List builder contracts',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Contracts list', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/contracts/{contractId}': {
      get: {
        tags: ['Builders'],
        summary: 'Get contract details',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'contractId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Contract details', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/contracts/{contractId}/submit': {
      post: {
        tags: ['Builders'],
        summary: 'Submit contract for approval',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'contractId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Contract submitted', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/contracts/{contractId}/approve': {
      post: {
        tags: ['Builders'],
        summary: 'Ops: approve a contract',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'contractId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Contract approved', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/contracts/{contractId}/amend': {
      post: {
        tags: ['Builders'],
        summary: 'Request a contract amendment',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'contractId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { amendmentNotes: { type: 'string' } } } } } },
        responses: { '200': { description: 'Amendment requested', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/contracts/{contractId}/cancel-renewal': {
      post: {
        tags: ['Builders'],
        summary: 'Cancel contract auto-renewal',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'contractId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Renewal cancelled', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/projects/{projectId}/broadcasts': {
      post: {
        tags: ['Builders'],
        summary: 'Create a project broadcast',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '201': { description: 'Broadcast created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
      get: {
        tags: ['Builders'],
        summary: 'List project broadcasts',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Broadcasts list', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/broadcasts/{broadcastId}/approve': {
      post: {
        tags: ['Builders'],
        summary: 'Ops: approve a broadcast',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'broadcastId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Broadcast approved', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/broadcasts/{broadcastId}/reject': {
      post: {
        tags: ['Builders'],
        summary: 'Ops: reject a broadcast',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'broadcastId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Broadcast rejected', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/broadcasts/{broadcastId}/status': {
      get: {
        tags: ['Builders'],
        summary: 'Get broadcast delivery status',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'broadcastId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Delivery status', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/projects/{projectId}/inbox': {
      get: {
        tags: ['Builders'],
        summary: 'Get project inbox messages',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Inbox messages', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/inbox/{messageId}/read': {
      put: {
        tags: ['Builders'],
        summary: 'Mark inbox message as read',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'messageId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { '200': { description: 'Message marked read', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/builders/inbox/unread-count': {
      get: {
        tags: ['Builders'],
        summary: 'Get unread inbox message count',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Unread count', content: { 'application/json': { schema: { type: 'object', properties: { success: { type: 'boolean' }, data: { type: 'object', properties: { unreadCount: { type: 'integer' } } } } } } } } },
      },
    },

    // ==================== NRI Payments (Epic 13) ====================
    '/api/v1/payments/international-upi': {
      post: {
        tags: ['NRI Payments'],
        summary: 'Initiate an international UPI payment',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: {
          '201': { description: 'Payment initiated', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
          '400': { $ref: '#/components/responses/BadRequest' },
        },
      },
      get: {
        tags: ['NRI Payments'],
        summary: 'List international UPI payments',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Payments list', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/payments/wire-transfer': {
      post: {
        tags: ['NRI Payments'],
        summary: 'Initiate a wire transfer',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '201': { description: 'Wire transfer initiated', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
      get: {
        tags: ['NRI Payments'],
        summary: 'List wire transfers',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Wire transfers', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },

    // ==================== Exchange Rates ====================
    '/api/v1/exchange-rates': {
      get: {
        tags: ['Exchange Rates'],
        summary: 'Get current exchange rates',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Exchange rates', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },

    // ==================== Ops NRI Payments ====================
    '/api/v1/ops/nri-payments': {
      get: {
        tags: ['Ops NRI Payments'],
        summary: 'Ops: NRI payment dashboard and reconciliation',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'NRI payment dashboard', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },

    // ==================== POA (Epic 13) ====================
    '/api/v1/poa': {
      get: {
        tags: ['POA'],
        summary: 'List POA templates',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'POA templates', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
      post: {
        tags: ['POA'],
        summary: 'Create a POA template',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '201': { description: 'POA template created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/poa/execution': {
      post: {
        tags: ['POA'],
        summary: 'Initiate POA execution',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '201': { description: 'Execution started', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/poa/verification': {
      post: {
        tags: ['POA'],
        summary: 'Submit POA for verification',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '200': { description: 'Verification result', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/agents/poa': {
      get: {
        tags: ['POA'],
        summary: 'Agent: list POA handoff tasks',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'POA handoffs', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },

    // ==================== Court Tracking (Epic 13) ====================
    '/api/v1/court-hearings': {
      get: {
        tags: ['Court Tracking'],
        summary: 'List court hearings',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Hearings list', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
      post: {
        tags: ['Court Tracking'],
        summary: 'Schedule a court hearing',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '201': { description: 'Hearing scheduled', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/court-hearings/adjournments': {
      post: {
        tags: ['Court Tracking'],
        summary: 'Record a court adjournment',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '201': { description: 'Adjournment recorded', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/court-orders': {
      get: {
        tags: ['Court Tracking'],
        summary: 'List court orders',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Court orders', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
      post: {
        tags: ['Court Tracking'],
        summary: 'Upload a court order',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '201': { description: 'Court order uploaded', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
    '/api/v1/court-events': {
      get: {
        tags: ['Court Tracking'],
        summary: 'List court event notifications',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Court events', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },

    // ==================== Consultations ====================
    '/api/v1/consultations': {
      get: {
        tags: ['Consultations'],
        summary: 'List consultations',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'Consultations list', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
      post: {
        tags: ['Consultations'],
        summary: 'Book a legal consultation',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '201': { description: 'Consultation booked', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },

    // ==================== NRI Documents ====================
    '/api/v1/nri-documents': {
      get: {
        tags: ['NRI Documents'],
        summary: 'List NRI document coordination requests',
        security: [{ bearerAuth: [] }],
        responses: { '200': { description: 'NRI documents', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
      post: {
        tags: ['NRI Documents'],
        summary: 'Create an NRI document coordination request',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { '201': { description: 'Document request created', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } } },
      },
    },
  },

  // Default security for all endpoints (can be overridden per-operation)
  security: [{ bearerAuth: [] }],
};
