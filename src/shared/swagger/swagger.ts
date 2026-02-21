// ============================================================
// Swagger UI Setup for Property Legal Agent API
// ============================================================
//
// Dependencies required (add to package.json):
//   npm install swagger-ui-express
//   npm install -D @types/swagger-ui-express
//
// ============================================================

import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './openapi-spec';
import { logger } from '../utils/logger';

/**
 * Mounts Swagger UI at /api-docs on the given Express app.
 *
 * The Swagger UI is publicly accessible (no authentication required)
 * so that developers and integrators can browse the API documentation
 * without needing a valid Bearer token.
 *
 * Call this BEFORE mounting authenticated API routes so the
 * /api-docs path is not intercepted by the auth middleware.
 */
export function setupSwagger(app: Express): void {
  const swaggerUiOptions: swaggerUi.SwaggerUiOptions = {
    explorer: true,
    customSiteTitle: 'Property Legal Agent API Docs',
    customCss: `
      .swagger-ui .topbar { background-color: #1a365d; }
      .swagger-ui .topbar .download-url-wrapper { display: none; }
    `,
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      tagsSorter: 'alpha',
      operationsSorter: 'method',
    },
  };

  // Serve the raw OpenAPI JSON spec at /api-docs/spec.json
  app.get('/api-docs/spec.json', (_req, res) => {
    res.json(openApiSpec);
  });

  // Mount Swagger UI
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(openApiSpec, swaggerUiOptions),
  );

  logger.info('Swagger UI available at /api-docs');
  logger.info('OpenAPI spec available at /api-docs/spec.json');
}
