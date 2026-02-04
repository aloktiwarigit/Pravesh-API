/**
 * Integration tests: Multi-tenant isolation
 *
 * Verifies that the Prisma tenant middleware correctly scopes all
 * read/write operations by cityId, that super admin bypasses scoping,
 * and that missing cityId fails closed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runWithTenantContext,
  getTenantContext,
  applyTenantMiddleware,
} from '../../shared/prisma/tenant-middleware';

// ---------------------------------------------------------------------------
// Reusable helpers
// ---------------------------------------------------------------------------
interface MockParams {
  model?: string;
  action: string;
  args?: {
    where?: Record<string, unknown>;
    data?: Record<string, unknown>;
    create?: Record<string, unknown>;
  };
}

type MockNext = (params: MockParams) => Promise<unknown>;

describe('[P0] Tenant Isolation Integration', () => {
  let mockPrisma: any;
  let middleware: (params: MockParams, next: MockNext) => Promise<unknown>;
  let mockNext: MockNext;

  beforeEach(() => {
    mockPrisma = {
      $use: vi.fn((fn) => {
        middleware = fn;
      }),
    };
    mockNext = vi.fn((params) => Promise.resolve({ id: 'result' }));
    applyTenantMiddleware(mockPrisma);
  });

  // -----------------------------------------------------------------------
  // 1. Request with cityId=lucknow only sees Lucknow data
  // -----------------------------------------------------------------------
  it('cityId=lucknow scopes Agent.findMany to Lucknow', async () => {
    // Given: tenant context for Lucknow
    await runWithTenantContext({ cityId: 'lucknow', isSuperAdmin: false }, async () => {
      // When: querying tenant-scoped model
      const params: MockParams = {
        model: 'Agent',
        action: 'findMany',
        args: { where: { active: true } },
      };
      await middleware(params, mockNext);

      // Then: cityId automatically injected
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({
            where: expect.objectContaining({
              active: true,
              cityId: 'lucknow',
            }),
          }),
        }),
      );
    });
  });

  it('cityId=lucknow scopes Dealer.findFirst to Lucknow', async () => {
    // Given: Lucknow context
    await runWithTenantContext({ cityId: 'lucknow' }, async () => {
      // When: findFirst on Dealer
      const params: MockParams = {
        model: 'Dealer',
        action: 'findFirst',
        args: {},
      };
      await middleware(params, mockNext);

      // Then: cityId injected
      expect(params.args?.where).toEqual({ cityId: 'lucknow' });
    });
  });

  // -----------------------------------------------------------------------
  // 2. Request with cityId=delhi only sees Delhi data
  // -----------------------------------------------------------------------
  it('cityId=delhi scopes Agent.findMany to Delhi', async () => {
    // Given: tenant context for Delhi
    await runWithTenantContext({ cityId: 'delhi', isSuperAdmin: false }, async () => {
      // When: querying agents
      const params: MockParams = {
        model: 'Agent',
        action: 'findMany',
        args: { where: { experience: 5 } },
      };
      await middleware(params, mockNext);

      // Then: cityId=delhi injected
      expect(mockNext).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.objectContaining({
            where: expect.objectContaining({
              experience: 5,
              cityId: 'delhi',
            }),
          }),
        }),
      );
    });
  });

  it('cityId=delhi scopes create operations to Delhi', async () => {
    // Given: Delhi context
    await runWithTenantContext({ cityId: 'delhi' }, async () => {
      // When: creating a new agent
      const params: MockParams = {
        model: 'Agent',
        action: 'create',
        args: { data: { name: 'Delhi Agent', active: true } },
      };
      await middleware(params, mockNext);

      // Then: cityId added to data
      expect(params.args?.data).toEqual({
        name: 'Delhi Agent',
        active: true,
        cityId: 'delhi',
      });
    });
  });

  // -----------------------------------------------------------------------
  // 3. Super admin sees all cities (no scoping applied)
  // -----------------------------------------------------------------------
  it('super admin bypasses tenant filtering on reads', async () => {
    // Given: super admin context
    await runWithTenantContext({ isSuperAdmin: true }, async () => {
      // When: querying all agents
      const params: MockParams = {
        model: 'Agent',
        action: 'findMany',
        args: { where: { active: true } },
      };
      await middleware(params, mockNext);

      // Then: NO cityId injected
      expect(mockNext).toHaveBeenCalledWith({
        model: 'Agent',
        action: 'findMany',
        args: { where: { active: true } },
      });
    });
  });

  it('super admin bypasses tenant filtering on writes', async () => {
    // Given: super admin context
    await runWithTenantContext({ isSuperAdmin: true }, async () => {
      // When: creating an agent without explicit cityId
      const params: MockParams = {
        model: 'Agent',
        action: 'create',
        args: { data: { name: 'Cross-City Agent' } },
      };
      await middleware(params, mockNext);

      // Then: data is untouched
      expect(params.args?.data).toEqual({ name: 'Cross-City Agent' });
    });
  });

  it('super admin can query across cities via aggregate', async () => {
    // Given: super admin context
    await runWithTenantContext({ isSuperAdmin: true }, async () => {
      // When: running aggregate on FranchiseRevenue (tenant-scoped)
      const params: MockParams = {
        model: 'FranchiseRevenue',
        action: 'aggregate',
        args: {},
      };
      await middleware(params, mockNext);

      // Then: no cityId filter applied
      expect(params.args?.where).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // 4. Missing cityId for non-admin returns error (fail-closed)
  // -----------------------------------------------------------------------
  it('non-admin without cityId fails on read (fail-closed)', async () => {
    // Given: non-super-admin context with no cityId
    await runWithTenantContext({ isSuperAdmin: false }, async () => {
      // When: attempting to query a tenant-scoped model
      const params: MockParams = {
        model: 'Agent',
        action: 'findMany',
        args: {},
      };

      // Then: throws a tenant isolation error
      await expect(middleware(params, mockNext)).rejects.toThrow(
        'Tenant isolation error: cityId is required for Agent.findMany',
      );
    });
  });

  it('empty context (no cityId, no isSuperAdmin) fails on create', async () => {
    // Given: empty context
    await runWithTenantContext({}, async () => {
      // When: attempting to create on tenant-scoped model
      const params: MockParams = {
        model: 'Dealer',
        action: 'create',
        args: { data: { name: 'Orphan Dealer' } },
      };

      // Then: blocked
      await expect(middleware(params, mockNext)).rejects.toThrow(
        'Tenant isolation error: cityId is required for Dealer.create',
      );
    });
  });

  it('non-admin without cityId fails on update', async () => {
    // Given: no cityId
    await runWithTenantContext({}, async () => {
      const params: MockParams = {
        model: 'CityServiceFee',
        action: 'update',
        args: { where: { id: 'fee-1' }, data: { amount: 500 } },
      };

      // Then: blocked
      await expect(middleware(params, mockNext)).rejects.toThrow(
        'cityId is required for CityServiceFee.update',
      );
    });
  });

  it('non-admin without cityId fails on delete', async () => {
    // Given: no cityId
    await runWithTenantContext({}, async () => {
      const params: MockParams = {
        model: 'ExportJob',
        action: 'delete',
        args: { where: { id: 'job-1' } },
      };

      // Then: blocked
      await expect(middleware(params, mockNext)).rejects.toThrow(
        'cityId is required for ExportJob.delete',
      );
    });
  });

  // -----------------------------------------------------------------------
  // 5. Prisma middleware auto-injects cityId on create
  // -----------------------------------------------------------------------
  it('auto-injects cityId into data on create', async () => {
    // Given: tenant context with cityId
    await runWithTenantContext({ cityId: 'mumbai' }, async () => {
      // When: creating a new record
      const params: MockParams = {
        model: 'TrainingModule',
        action: 'create',
        args: { data: { title: 'Module 1' } },
      };
      await middleware(params, mockNext);

      // Then: cityId is set in data
      expect(params.args?.data?.cityId).toBe('mumbai');
    });
  });

  it('preserves explicit cityId on create (does not override)', async () => {
    // Given: context says lucknow, but data says delhi
    await runWithTenantContext({ cityId: 'lucknow' }, async () => {
      const params: MockParams = {
        model: 'Agent',
        action: 'create',
        args: { data: { name: 'Special', cityId: 'delhi' } },
      };
      await middleware(params, mockNext);

      // Then: explicit cityId preserved
      expect(params.args?.data?.cityId).toBe('delhi');
    });
  });

  // -----------------------------------------------------------------------
  // 6. Prisma middleware auto-filters on findMany
  // -----------------------------------------------------------------------
  it('auto-filters findMany with cityId from context', async () => {
    // Given: bangalore context
    await runWithTenantContext({ cityId: 'bangalore' }, async () => {
      const params: MockParams = {
        model: 'CityDocumentRequirement',
        action: 'findMany',
        args: { where: { docType: 'AADHAAR' } },
      };
      await middleware(params, mockNext);

      // Then: cityId added to where clause
      expect(params.args?.where).toEqual({
        docType: 'AADHAAR',
        cityId: 'bangalore',
      });
    });
  });

  it('auto-creates args and where when missing on findMany', async () => {
    // Given: context with cityId, params with no args
    await runWithTenantContext({ cityId: 'pune' }, async () => {
      const params: MockParams = {
        model: 'FeatureUsageEvent',
        action: 'findMany',
      };
      await middleware(params, mockNext);

      // Then: args.where created with cityId
      expect(params.args?.where).toEqual({ cityId: 'pune' });
    });
  });

  // -----------------------------------------------------------------------
  // Non-tenant-scoped models pass through unmodified
  // -----------------------------------------------------------------------
  it('non-tenant-scoped model (User) passes through without cityId', async () => {
    // Given: tenant context
    await runWithTenantContext({ cityId: 'lucknow' }, async () => {
      const params: MockParams = {
        model: 'User',
        action: 'findMany',
        args: { where: { email: 'test@example.com' } },
      };
      await middleware(params, mockNext);

      // Then: no cityId injected
      expect(mockNext).toHaveBeenCalledWith({
        model: 'User',
        action: 'findMany',
        args: { where: { email: 'test@example.com' } },
      });
    });
  });

  // -----------------------------------------------------------------------
  // Cross-city isolation: Lucknow user cannot read Delhi data
  // -----------------------------------------------------------------------
  it('Lucknow user queries always have cityId=lucknow (cannot see Delhi)', async () => {
    // Given: Lucknow tenant context
    await runWithTenantContext({ cityId: 'lucknow' }, async () => {
      // When: querying agents
      const params: MockParams = {
        model: 'Agent',
        action: 'findMany',
        args: { where: {} },
      };
      await middleware(params, mockNext);

      // Then: only lucknow data is accessible
      expect(params.args?.where?.cityId).toBe('lucknow');
      // Delhi data is excluded by the filter
    });

    // Given: Delhi tenant context
    await runWithTenantContext({ cityId: 'delhi' }, async () => {
      const params: MockParams = {
        model: 'Agent',
        action: 'findMany',
        args: { where: {} },
      };
      await middleware(params, mockNext);

      // Then: only delhi data accessible
      expect(params.args?.where?.cityId).toBe('delhi');
    });
  });
});
