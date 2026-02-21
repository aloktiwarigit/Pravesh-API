# Installation Instructions for Zod-to-OpenAPI

## Required Package

To enable auto-generation of OpenAPI schemas from Zod validation schemas, install:

```bash
npm install @asteasolutions/zod-to-openapi
```

## Package.json Addition

Add to your `dependencies`:

```json
{
  "dependencies": {
    "@asteasolutions/zod-to-openapi": "^8.0.0"
  }
}
```

## Verification

After installation, verify the Swagger UI loads correctly:

1. Start the server:
   ```bash
   npm run dev
   ```

2. Open Swagger UI:
   ```
   http://localhost:3000/api-docs
   ```

3. Check that the following auto-generated schemas appear under **Components > Schemas**:
   - `SubmitServiceRequest`
   - `AddService`
   - `ServiceRequestResponse`
   - `ServiceRequestListItem`
   - `ValidationErrorResponse`
   - `ValidationErrorDetail`
   - `PaginationMeta`

4. Verify the `/api/v1/service-requests` endpoints reference these schemas in their request/response bodies.

## Troubleshooting

### Import Error: Cannot find module '@asteasolutions/zod-to-openapi'

**Solution**: Run `npm install @asteasolutions/zod-to-openapi`

### TypeScript Error: Property 'openapi' does not exist on type 'ZodString'

**Solution**: Make sure `extendZodWithOpenApi(z)` is called at the top of `zod-schemas.ts`

### Schemas Not Appearing in Swagger UI

**Solution**:
1. Check console for errors
2. Verify `generateZodSchemas()` is called in `openapi-spec.ts`
3. Restart the server
4. Clear browser cache

## Testing the Auto-Generated Schemas

### Test Validation Error Response

```bash
curl -X POST http://localhost:3000/api/v1/service-requests \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected response (400 Bad Request):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid body parameters",
    "details": [
      {
        "path": "serviceId",
        "message": "Required",
        "code": "invalid_type"
      }
    ]
  }
}
```

This validates that the `ValidationErrorResponse` schema matches the actual error structure.

### Test Success Response

```bash
curl -X POST http://localhost:3000/api/v1/service-requests \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "serviceId": "svc_property_verification",
    "propertyType": "residential",
    "propertyLocation": "123 Main St, Mumbai",
    "ownershipStatus": "self"
  }'
```

Expected response (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "req_...",
    "requestNumber": "SR-2026-00001",
    "serviceCode": "PROP_VERIFY",
    "status": "PENDING_PAYMENT",
    "paymentStatus": "PENDING",
    "createdAt": "2026-02-14T10:30:00.000Z"
  }
}
```

This validates that the `ServiceRequestResponse` schema matches the actual response structure.

## Next Steps

After successful installation and verification:

1. **Extend Coverage**: Add more Zod schemas from other controllers
   - See `README-ZOD-SCHEMAS.md` for instructions
   - See `zod-schemas.example.ts` for code examples

2. **Update API Paths**: Reference auto-generated schemas in `openapi-spec.ts` paths
   - Replace manual schema definitions with `$ref` to auto-generated schemas
   - Ensure consistency between code and documentation

3. **Maintain**: When adding new endpoints, register their Zod schemas in `zod-schemas.ts`

## Benefits Achieved

- **Single Source of Truth**: Validation + docs from one Zod schema
- **Type Safety**: TypeScript types and OpenAPI stay in sync
- **Less Maintenance**: Changes to validation auto-update docs
- **Better DX**: Swagger UI shows accurate request/response examples
