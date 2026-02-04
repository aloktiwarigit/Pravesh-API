import { describe, test, expect, vi, beforeEach } from 'vitest';
import {
  runWithTenantContext,
  getTenantContext,
  applyTenantMiddleware,
} from '../tenant-middleware';

// Mock Prisma types
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

describe('[P0] Tenant Middleware - Multi-tenant Isolation', () => {
  let mockPrisma: any;
  let middleware: (params: MockParams, next: MockNext) => Promise<unknown>;
  let mockNext: MockNext;

  beforeEach(() => {
    // Reset middleware
    mockPrisma = {
      $use: vi.fn((fn) => {
        middleware = fn;
      }),
    };
    mockNext = vi.fn((params) => Promise.resolve({ id: 'test-result' }));

    applyTenantMiddleware(mockPrisma);
  });

  describe('[P0] Tenant Context Storage', () => {
    test('runWithTenantContext stores and retrieves context', () => {
      // Given: No context initially
      const initialContext = getTenantContext();
      expect(initialContext).toEqual({});

      // When: Running within tenant context
      const result = runWithTenantContext(
        { cityId: 'city-123', isSuperAdmin: false },
        () => {
          // Then: Context is available inside
          const ctx = getTenantContext();
          expect(ctx.cityId).toBe('city-123');
          expect(ctx.isSuperAdmin).toBe(false);
          return 'success';
        }
      );

      // Then: Function returns correctly
      expect(result).toBe('success');

      // And: Context is cleared outside
      const afterContext = getTenantContext();
      expect(afterContext).toEqual({});
    });

    test('getTenantContext returns empty object outside context', () => {
      // Given: No context set
      // When: Getting context
      const ctx = getTenantContext();

      // Then: Returns empty object
      expect(ctx).toEqual({});
      expect(ctx.cityId).toBeUndefined();
      expect(ctx.isSuperAdmin).toBeUndefined();
    });

    test('nested contexts are isolated', () => {
      // Given: Outer context
      runWithTenantContext({ cityId: 'outer-city' }, () => {
        const outerCtx = getTenantContext();
        expect(outerCtx.cityId).toBe('outer-city');

        // When: Inner context with different city
        runWithTenantContext({ cityId: 'inner-city' }, () => {
          // Then: Inner context takes precedence
          const innerCtx = getTenantContext();
          expect(innerCtx.cityId).toBe('inner-city');
        });

        // And: Outer context is restored
        const restoredCtx = getTenantContext();
        expect(restoredCtx.cityId).toBe('outer-city');
      });
    });
  });

  describe('[P0] Read Operations - Tenant Scoping', () => {
    test('findMany adds cityId filter on tenant-scoped models', async () => {
      // Given: Tenant context with cityId
      await runWithTenantContext({ cityId: 'city-123' }, async () => {
        // When: findMany on tenant-scoped model
        const params: MockParams = {
          model: 'Agent',
          action: 'findMany',
          args: { where: { name: 'John' } },
        };

        await middleware(params, mockNext);

        // Then: cityId is injected into where clause
        expect(mockNext).toHaveBeenCalledWith({
          model: 'Agent',
          action: 'findMany',
          args: {
            where: {
              name: 'John',
              cityId: 'city-123',
            },
          },
        });
      });
    });

    test('findFirst adds cityId filter', async () => {
      // Given: Tenant context
      await runWithTenantContext({ cityId: 'city-456' }, async () => {
        // When: findFirst
        const params: MockParams = {
          model: 'Dealer',
          action: 'findFirst',
          args: {},
        };

        await middleware(params, mockNext);

        // Then: cityId injected
        expect(params.args?.where).toEqual({ cityId: 'city-456' });
      });
    });

    test('findUnique adds cityId filter', async () => {
      // Given: Tenant context
      await runWithTenantContext({ cityId: 'city-789' }, async () => {
        // When: findUnique
        const params: MockParams = {
          model: 'CityServiceFee',
          action: 'findUnique',
          args: { where: { id: 'fee-1' } },
        };

        await middleware(params, mockNext);

        // Then: cityId added to where
        expect(params.args?.where).toEqual({
          id: 'fee-1',
          cityId: 'city-789',
        });
      });
    });

    test('count adds cityId filter', async () => {
      // Given: Tenant context
      await runWithTenantContext({ cityId: 'city-count' }, async () => {
        // When: count operation
        const params: MockParams = {
          model: 'Agent',
          action: 'count',
          args: { where: { active: true } },
        };

        await middleware(params, mockNext);

        // Then: cityId injected
        expect(params.args?.where).toEqual({
          active: true,
          cityId: 'city-count',
        });
      });
    });

    test('aggregate adds cityId filter', async () => {
      // Given: Tenant context
      await runWithTenantContext({ cityId: 'city-agg' }, async () => {
        // When: aggregate operation
        const params: MockParams = {
          model: 'FranchiseRevenue',
          action: 'aggregate',
          args: {},
        };

        await middleware(params, mockNext);

        // Then: cityId added
        expect(params.args?.where).toEqual({ cityId: 'city-agg' });
      });
    });

    test('groupBy adds cityId filter', async () => {
      // Given: Tenant context
      await runWithTenantContext({ cityId: 'city-group' }, async () => {
        // When: groupBy operation
        const params: MockParams = {
          model: 'FeatureUsageEvent',
          action: 'groupBy',
          args: { where: { eventType: 'click' } },
        };

        await middleware(params, mockNext);

        // Then: cityId injected
        expect(params.args?.where).toEqual({
          eventType: 'click',
          cityId: 'city-group',
        });
      });
    });
  });

  describe('[P0] Write Operations - Tenant Scoping', () => {
    test('create adds cityId to data', async () => {
      // Given: Tenant context
      await runWithTenantContext({ cityId: 'city-create' }, async () => {
        // When: create operation
        const params: MockParams = {
          model: 'Agent',
          action: 'create',
          args: { data: { name: 'New Agent' } },
        };

        await middleware(params, mockNext);

        // Then: cityId added to data
        expect(params.args?.data).toEqual({
          name: 'New Agent',
          cityId: 'city-create',
        });
      });
    });

    test('create preserves explicit cityId in data', async () => {
      // Given: Tenant context with different cityId
      await runWithTenantContext({ cityId: 'city-context' }, async () => {
        // When: create with explicit cityId
        const params: MockParams = {
          model: 'Agent',
          action: 'create',
          args: { data: { name: 'Agent', cityId: 'city-explicit' } },
        };

        await middleware(params, mockNext);

        // Then: Explicit cityId is preserved
        expect(params.args?.data?.cityId).toBe('city-explicit');
      });
    });

    test('update adds cityId filter to where clause', async () => {
      // Given: Tenant context
      await runWithTenantContext({ cityId: 'city-update' }, async () => {
        // When: update operation
        const params: MockParams = {
          model: 'Dealer',
          action: 'update',
          args: {
            where: { id: 'dealer-1' },
            data: { name: 'Updated' },
          },
        };

        await middleware(params, mockNext);

        // Then: cityId added to where
        expect(params.args?.where).toEqual({
          id: 'dealer-1',
          cityId: 'city-update',
        });
      });
    });

    test('updateMany adds cityId filter', async () => {
      // Given: Tenant context
      await runWithTenantContext({ cityId: 'city-multi' }, async () => {
        // When: updateMany
        const params: MockParams = {
          model: 'Agent',
          action: 'updateMany',
          args: {
            where: { active: false },
            data: { active: true },
          },
        };

        await middleware(params, mockNext);

        // Then: cityId injected
        expect(params.args?.where).toEqual({
          active: false,
          cityId: 'city-multi',
        });
      });
    });

    test('delete adds cityId filter', async () => {
      // Given: Tenant context
      await runWithTenantContext({ cityId: 'city-delete' }, async () => {
        // When: delete operation
        const params: MockParams = {
          model: 'TrainingModule',
          action: 'delete',
          args: { where: { id: 'module-1' } },
        };

        await middleware(params, mockNext);

        // Then: cityId added
        expect(params.args?.where).toEqual({
          id: 'module-1',
          cityId: 'city-delete',
        });
      });
    });

    test('deleteMany adds cityId filter', async () => {
      // Given: Tenant context
      await runWithTenantContext({ cityId: 'city-del-many' }, async () => {
        // When: deleteMany
        const params: MockParams = {
          model: 'ExportJob',
          action: 'deleteMany',
          args: { where: { status: 'completed' } },
        };

        await middleware(params, mockNext);

        // Then: cityId injected
        expect(params.args?.where).toEqual({
          status: 'completed',
          cityId: 'city-del-many',
        });
      });
    });

    test('upsert adds cityId to both where and create', async () => {
      // Given: Tenant context
      await runWithTenantContext({ cityId: 'city-upsert' }, async () => {
        // When: upsert operation
        const params: MockParams = {
          model: 'CityProcessOverride',
          action: 'upsert',
          args: {
            where: { id: 'override-1' },
            create: { processName: 'New Process' },
            data: {},
          },
        };

        await middleware(params, mockNext);

        // Then: cityId added to where and create
        expect(params.args?.where).toEqual({
          id: 'override-1',
          cityId: 'city-upsert',
        });
        expect(params.args?.create).toEqual({
          processName: 'New Process',
          cityId: 'city-upsert',
        });
      });
    });
  });

  describe('[P0] Super Admin Bypass', () => {
    test('super admin bypasses tenant filtering on reads', async () => {
      // Given: Super admin context (no cityId required)
      await runWithTenantContext({ isSuperAdmin: true }, async () => {
        // When: findMany on tenant-scoped model
        const params: MockParams = {
          model: 'Agent',
          action: 'findMany',
          args: { where: { name: 'John' } },
        };

        await middleware(params, mockNext);

        // Then: No cityId injected
        expect(mockNext).toHaveBeenCalledWith({
          model: 'Agent',
          action: 'findMany',
          args: {
            where: { name: 'John' }, // cityId NOT added
          },
        });
      });
    });

    test('super admin bypasses tenant filtering on writes', async () => {
      // Given: Super admin context
      await runWithTenantContext({ isSuperAdmin: true }, async () => {
        // When: create operation
        const params: MockParams = {
          model: 'CityDocumentRequirement',
          action: 'create',
          args: { data: { docType: 'ID_PROOF' } },
        };

        await middleware(params, mockNext);

        // Then: No cityId injected
        expect(params.args?.data).toEqual({ docType: 'ID_PROOF' });
      });
    });

    test('super admin with cityId still bypasses filtering', async () => {
      // Given: Super admin with cityId (has access to all cities)
      await runWithTenantContext(
        { isSuperAdmin: true, cityId: 'city-123' },
        async () => {
          // When: Query executes
          const params: MockParams = {
            model: 'Agent',
            action: 'findMany',
            args: {},
          };

          await middleware(params, mockNext);

          // Then: cityId not injected (super admin sees all)
          expect(params.args?.where).toBeUndefined();
        }
      );
    });
  });

  describe('[P0] Fail-Closed Security', () => {
    test('non-super-admin without cityId throws error on read', async () => {
      // Given: Non-super-admin without cityId
      await runWithTenantContext({ isSuperAdmin: false }, async () => {
        // When: Attempting to query tenant-scoped model
        const params: MockParams = {
          model: 'Agent',
          action: 'findMany',
          args: {},
        };

        // Then: Throws error (fail-closed)
        await expect(middleware(params, mockNext)).rejects.toThrow(
          'Tenant isolation error: cityId is required for Agent.findMany but was not provided.'
        );
      });
    });

    test('non-super-admin without cityId throws error on create', async () => {
      // Given: No context
      await runWithTenantContext({}, async () => {
        // When: Attempting to create
        const params: MockParams = {
          model: 'Dealer',
          action: 'create',
          args: { data: { name: 'New Dealer' } },
        };

        // Then: Throws error
        await expect(middleware(params, mockNext)).rejects.toThrow(
          'Tenant isolation error: cityId is required for Dealer.create'
        );
      });
    });

    test('non-super-admin without cityId throws error on update', async () => {
      // Given: Empty context
      await runWithTenantContext({}, async () => {
        // When: Attempting to update
        const params: MockParams = {
          model: 'CityServiceFee',
          action: 'update',
          args: { where: { id: '1' }, data: {} },
        };

        // Then: Blocked
        await expect(middleware(params, mockNext)).rejects.toThrow(
          'cityId is required for CityServiceFee.update'
        );
      });
    });

    test('non-super-admin without cityId throws error on delete', async () => {
      // Given: No cityId
      await runWithTenantContext({}, async () => {
        // When: delete operation
        const params: MockParams = {
          model: 'CorporateAudit',
          action: 'delete',
          args: { where: { id: '1' } },
        };

        // Then: Blocked
        await expect(middleware(params, mockNext)).rejects.toThrow(
          'cityId is required for CorporateAudit.delete'
        );
      });
    });
  });

  describe('[P0] Non-Tenant-Scoped Models', () => {
    test('non-tenant models pass through without filtering', async () => {
      // Given: Tenant context
      await runWithTenantContext({ cityId: 'city-123' }, async () => {
        // When: Querying non-tenant-scoped model
        const params: MockParams = {
          model: 'User', // Not in TENANT_SCOPED_MODELS
          action: 'findMany',
          args: { where: { email: 'test@example.com' } },
        };

        await middleware(params, mockNext);

        // Then: No cityId injected
        expect(mockNext).toHaveBeenCalledWith({
          model: 'User',
          action: 'findMany',
          args: {
            where: { email: 'test@example.com' }, // cityId NOT added
          },
        });
      });
    });

    test('models without model name pass through', async () => {
      // Given: Tenant context
      await runWithTenantContext({ cityId: 'city-123' }, async () => {
        // When: Operation without model (e.g., raw query)
        const params: MockParams = {
          action: 'executeRaw',
          args: {},
        };

        await middleware(params, mockNext);

        // Then: Passes through unchanged
        expect(mockNext).toHaveBeenCalledWith(params);
      });
    });

    test('all tenant-scoped models are filtered', async () => {
      // Given: List of all tenant-scoped models
      const tenantModels = [
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

      // When/Then: Each model gets cityId filter
      for (const model of tenantModels) {
        await runWithTenantContext({ cityId: 'test-city' }, async () => {
          const params: MockParams = {
            model,
            action: 'findMany',
            args: {},
          };

          await middleware(params, mockNext);

          expect(params.args?.where?.cityId).toBe('test-city');
        });
      }
    });
  });

  describe('[P0] Edge Cases', () => {
    test('handles missing args object', async () => {
      // Given: Tenant context
      await runWithTenantContext({ cityId: 'city-123' }, async () => {
        // When: Operation with no args
        const params: MockParams = {
          model: 'Agent',
          action: 'findMany',
        };

        await middleware(params, mockNext);

        // Then: args and where are created
        expect(params.args).toBeDefined();
        expect(params.args?.where).toEqual({ cityId: 'city-123' });
      });
    });

    test('handles missing where clause', async () => {
      // Given: Tenant context
      await runWithTenantContext({ cityId: 'city-456' }, async () => {
        // When: args exists but no where
        const params: MockParams = {
          model: 'Dealer',
          action: 'findFirst',
          args: {},
        };

        await middleware(params, mockNext);

        // Then: where is created with cityId
        expect(params.args?.where).toEqual({ cityId: 'city-456' });
      });
    });

    test('preserves existing where conditions', async () => {
      // Given: Tenant context and existing where conditions
      await runWithTenantContext({ cityId: 'city-preserve' }, async () => {
        // When: findMany with multiple conditions
        const params: MockParams = {
          model: 'Agent',
          action: 'findMany',
          args: {
            where: {
              active: true,
              role: 'SENIOR',
              experience: { gte: 5 },
            },
          },
        };

        await middleware(params, mockNext);

        // Then: All conditions preserved, cityId added
        expect(params.args?.where).toEqual({
          active: true,
          role: 'SENIOR',
          experience: { gte: 5 },
          cityId: 'city-preserve',
        });
      });
    });
  });
});
