# Pravesh API — Property Legal Agent

## Project Overview
Node.js/Express/Prisma REST API for property legal services. Deployed on Azure App Service (Linux B1).

## Tech Stack
- **Runtime**: Node 22, TypeScript 5 (strict mode), CommonJS output
- **Framework**: Express 4 with domain-based architecture
- **ORM**: Prisma 5 (100+ models, 3000+ line schema)
- **Auth**: Firebase Admin SDK (`DEV_AUTH_BYPASS=true` in dev only)
- **Logging**: Pino + pino-http (structured JSON to stdout)
- **Background Jobs**: pg-boss (PostgreSQL-backed)
- **Tests**: Vitest + Supertest

## Key Commands
```bash
npm run dev          # Local dev with nodemon + ts-node
npm run build        # tsc (always runs full compile)
npm run test         # vitest run
npm run test:unit    # Excludes integration tests
npm start            # node dist/server.js
npx prisma generate  # MUST run after any schema change
npx prisma studio    # Visual DB browser
```

## Project Structure
```
src/
  server.ts              # Entry point
  config/                # App config, env vars
  core/                  # App setup, middleware wiring
  domains/               # Feature modules (auth, builders, dealers, documents, payments, etc.)
    <domain>/
      <domain>.controller.ts
      <domain>.service.ts
      <domain>.routes.ts
      <domain>.schema.ts    # Zod validation schemas
  middleware/             # Auth, error handling, rate limiting
  routes/                # Route registration
  shared/                # Shared utils (logger, encryption, etc.)
  types/                 # Ambient declarations (modules.d.ts, zod-openapi.d.ts)
prisma/
  schema.prisma          # Database schema (very large — 100+ models)
```

## Critical Rules

### TypeScript
- Strict mode is ON. All code must compile with `npx tsc` (zero errors).
- Ambient type declarations live in `src/types/`. If adding a dependency without types, add a `.d.ts` there.
- Path aliases: `@/*`, `@shared/*`, `@domains/*`, `@middleware/*` (defined in tsconfig.json).

### Prisma
- Always run `npx prisma generate` after changing `prisma/schema.prisma`.
- `postinstall` script runs `prisma generate` automatically on `npm install`.
- Schema is large — be targeted with changes, don't reformat the whole file.

### Error Handling
- Controllers use `next(error)` pattern — do NOT use a custom `handleError()` helper.
- Empty catches are forbidden — at minimum `logger.warn()` with context.

### Dependencies
- Every import must have a corresponding entry in `package.json`. Transitive deps are NOT reliable for production (the deploy zip uses `npm ci --omit=dev`).
- If you add a new import, add it to `dependencies` in package.json.

## Azure Deployment (IMPORTANT — read before deploying)

### Method: WEBSITE_RUN_FROM_PACKAGE=1 with fat zip
This is the ONLY method that works reliably on B1 Linux. Do NOT attempt Oryx builds or slim zips.

### Why other methods fail
- **Slim zip + Oryx build**: Oryx installs node_modules via symlink to SCM container's `/node_modules`, which the runtime container can't resolve.
- **`az webapp deploy --type zip` without WEBSITE_RUN_FROM_PACKAGE**: OneDeploy stores zips in `/home/data/SitePackages/` but does NOT extract to wwwroot.
- **SCM_DO_BUILD_DURING_DEPLOYMENT=false**: Disables extraction entirely.

### Deploy Steps
```bash
# 1. Build
rm -rf dist && npx prisma generate && npx tsc

# 2. Create fat zip (dist + node_modules + prisma + package.json)
node create-deploy-zip.js    # ~91MB output

# 3. (Optional) Clean old zips from Azure to save disk
#    Use Kudu API with full file paths (glob * doesn't work through the API)

# 4. Deploy
az webapp deploy --resource-group rg-property-legal --name pla-api-server \
  --src-path deploy.zip --type zip --async true

# 5. Restart + verify
az webapp restart -n pla-api-server -g rg-property-legal
# Wait ~90s, then:
curl https://pla-api-server.azurewebsites.net/health/live
curl https://pla-api-server.azurewebsites.net/health/ready
```

### Required App Settings (already set, don't change)
```
WEBSITE_RUN_FROM_PACKAGE=1
SCM_DO_BUILD_DURING_DEPLOYMENT=false
ENABLE_ORYX_BUILD=false
```

### The CLI may report "site failed to start" — check health endpoints before panicking
The `az webapp deploy` polling often times out on B1 tier even when the app is running fine. Always verify with curl before assuming failure.

### Logs
```bash
az webapp log download -n pla-api-server -g rg-property-legal --log-file logs.zip
# Check LogFiles/*_default_docker.log for runtime logs
```

## Don't Commit (build artifacts)
`deploy.zip`, `deploy-slim.zip`, `create-deploy-zip.js`, `verify-zip.js`, `build/`, `logs.zip`, `logs-extracted/`, `dist/`

## Azure Infrastructure
- **App Service**: `pla-api-server` in `rg-property-legal`, B1 Linux, Node 22
- **Database**: PostgreSQL at `pla-db-server.postgres.database.azure.com`
- **Health**: `/health/live` (liveness), `/health/ready` (DB check)
