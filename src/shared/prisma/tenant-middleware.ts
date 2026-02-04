import { PrismaClient } from '@prisma/client';
import { AsyncLocalStorage } from 'node:async_hooks';

// Tables that require city_id scoping for multi-tenant isolation
const TENANT_SCOPED_MODELS = [
  'CityServiceFee',
  'CityProcessOverride',
  'CityDocumentRequirement',
  'Agent',
  'Dealer',
  'FranchiseRevenue',
  'TrainingModule',
  'CorporateAudit',
  'ExportJob',
  'FeatureUsageEvent',
];

interface TenantContext {
  cityId?: string;
  isSuperAdmin?: boolean;
}

// AsyncLocalStorage for request-scoped tenant context (thread-safe)
const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function setTenantContext(context: TenantContext) {
  // Only used as fallback; prefer runWithTenantContext
  const store = tenantStorage.getStore();
  if (store) {
    Object.assign(store, context);
  }
}

export function getTenantContext(): TenantContext {
  return tenantStorage.getStore() ?? {};
}

export function clearTenantContext() {
  const store = tenantStorage.getStore();
  if (store) {
    delete store.cityId;
    delete store.isSuperAdmin;
  }
}

/**
 * Runs the given function within a tenant context scope.
 * This is the primary API -- use this in the scope middleware.
 */
export function runWithTenantContext<T>(context: TenantContext, fn: () => T): T {
  return tenantStorage.run({ ...context }, fn);
}

export function applyTenantMiddleware(prisma: PrismaClient) {
  prisma.$use(async (params, next) => {
    const modelName = params.model;

    if (!modelName || !TENANT_SCOPED_MODELS.includes(modelName)) {
      return next(params);
    }

    const ctx = getTenantContext();

    // Super Admin bypasses tenant scoping
    if (ctx.isSuperAdmin) {
      return next(params);
    }

    const cityId = ctx.cityId;

    // Fail-closed: non-super-admin users without a cityId are blocked
    // on tenant-scoped models
    if (!cityId) {
      throw new Error(
        `Tenant isolation error: cityId is required for ${modelName}.${params.action} but was not provided.`
      );
    }

    // Auto-inject city_id filter for read operations
    if (
      params.action === 'findMany' ||
      params.action === 'findFirst' ||
      params.action === 'findUnique'
    ) {
      if (!params.args) params.args = {};
      if (!params.args.where) params.args.where = {};
      params.args.where.cityId = cityId;
    }

    // Auto-inject city_id filter for count and aggregate
    if (
      params.action === 'count' ||
      params.action === 'aggregate' ||
      params.action === 'groupBy'
    ) {
      if (!params.args) params.args = {};
      if (!params.args.where) params.args.where = {};
      params.args.where.cityId = cityId;
    }

    // Auto-inject city_id for create operations
    if (params.action === 'create' || params.action === 'createMany') {
      if (!params.args) params.args = {};
      if (params.action === 'create' && params.args.data) {
        params.args.data.cityId = params.args.data.cityId || cityId;
      }
    }

    // Auto-inject city_id filter for update operations
    if (params.action === 'update' || params.action === 'updateMany') {
      if (!params.args) params.args = {};
      if (!params.args.where) params.args.where = {};
      params.args.where.cityId = cityId;
    }

    // Auto-inject city_id filter for upsert
    if (params.action === 'upsert') {
      if (!params.args) params.args = {};
      if (!params.args.where) params.args.where = {};
      params.args.where.cityId = cityId;
      if (params.args.create) {
        params.args.create.cityId = params.args.create.cityId || cityId;
      }
    }

    // Auto-inject city_id filter for delete operations
    if (params.action === 'delete' || params.action === 'deleteMany') {
      if (!params.args) params.args = {};
      if (!params.args.where) params.args.where = {};
      params.args.where.cityId = cityId;
    }

    return next(params);
  });
}
