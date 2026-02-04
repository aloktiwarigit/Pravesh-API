/**
 * Tests for city-scope middleware covering city isolation,
 * role bypass, and entity-level scoping.
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { cityScope, cityScopeByEntity } from '../city-scope';

describe('cityScope middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockRequest = {
      params: {},
      body: {},
      user: undefined,
    };

    const jsonMock = vi.fn().mockReturnThis();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    mockNext = vi.fn();
  });

  describe('cityScope()', () => {
    test('allows request when user cityId matches route param cityId', () => {
      // Given: user's cityId matches the :cityId route param
      mockRequest.user = {
        id: 'user-001',
        role: 'AGENT',
        cityId: 'city-lucknow',
      };
      mockRequest.params = { cityId: 'city-lucknow' };

      // When
      const middleware = cityScope();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('blocks request with 403 when cityId mismatch', () => {
      // Given: user's cityId does NOT match route param
      mockRequest.user = {
        id: 'user-001',
        role: 'AGENT',
        cityId: 'city-lucknow',
      };
      mockRequest.params = { cityId: 'city-delhi' };

      // When
      const middleware = cityScope();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_CITY_MISMATCH',
          message: 'Access denied: city does not match your assignment',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('bypasses check for super_admin role', () => {
      // Given: user is super_admin
      mockRequest.user = {
        id: 'admin-001',
        role: 'super_admin',
        cityId: undefined, // super_admin may not have cityId
      };
      mockRequest.params = { cityId: 'city-delhi' };

      // When
      const middleware = cityScope();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('bypasses check for ops role', () => {
      // Given: user has ops role
      mockRequest.user = {
        id: 'ops-001',
        role: 'ops',
        cityId: 'city-lucknow',
      };
      mockRequest.params = { cityId: 'city-delhi' };

      // When
      const middleware = cityScope();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('bypasses check when user has bypass role in roles array', () => {
      // Given: user has roles array with super_admin
      mockRequest.user = {
        id: 'user-001',
        role: 'AGENT',
        roles: ['AGENT', 'super_admin'],
        cityId: 'city-lucknow',
      } as any;
      mockRequest.params = { cityId: 'city-delhi' };

      // When
      const middleware = cityScope();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then
      expect(mockNext).toHaveBeenCalled();
    });

    test('reads cityId from body when bodyField specified', () => {
      // Given: cityId is in the request body
      mockRequest.user = {
        id: 'user-001',
        role: 'AGENT',
        cityId: 'city-lucknow',
      };
      mockRequest.params = {}; // No cityId in route
      mockRequest.body = { cityId: 'city-lucknow' };

      // When
      const middleware = cityScope({ bodyField: 'cityId' });
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('blocks when body cityId mismatches user cityId', () => {
      // Given: body cityId does not match user's cityId
      mockRequest.user = {
        id: 'user-001',
        role: 'AGENT',
        cityId: 'city-lucknow',
      };
      mockRequest.params = {};
      mockRequest.body = { cityId: 'city-delhi' };

      // When
      const middleware = cityScope({ bodyField: 'cityId' });
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_CITY_MISMATCH',
          message: 'Access denied: city in request body does not match your assignment',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('returns 401 when user is not authenticated', () => {
      // Given: no user on request
      mockRequest.user = undefined;
      mockRequest.params = { cityId: 'city-001' };

      // When
      const middleware = cityScope();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_TOKEN_INVALID',
          message: 'Not authenticated',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('returns 403 when user has no cityId assigned', () => {
      // Given: authenticated user without cityId
      mockRequest.user = {
        id: 'user-001',
        role: 'AGENT',
        cityId: undefined,
      };
      mockRequest.params = { cityId: 'city-001' };

      // When
      const middleware = cityScope();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_CITY_MISSING',
          message: 'User does not have a city assignment',
        },
      });
    });

    test('passes through when no cityId in route and no bodyField specified', () => {
      // Given: no cityId param, no bodyField option
      mockRequest.user = {
        id: 'user-001',
        role: 'AGENT',
        cityId: 'city-lucknow',
      };
      mockRequest.params = {}; // No cityId param

      // When
      const middleware = cityScope();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then: passes through (no param to check against)
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('cityScopeByEntity()', () => {
    test('allows when entity cityId matches user cityId', async () => {
      // Given
      mockRequest.user = {
        id: 'user-001',
        role: 'AGENT',
        cityId: 'city-lucknow',
      };
      mockRequest.params = { id: 'entity-001' };

      const lookupCityId = vi.fn().mockResolvedValue('city-lucknow');

      // When
      const middleware = cityScopeByEntity(lookupCityId);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(lookupCityId).toHaveBeenCalledWith('entity-001', mockRequest);
    });

    test('blocks when entity cityId mismatches user cityId', async () => {
      // Given
      mockRequest.user = {
        id: 'user-001',
        role: 'AGENT',
        cityId: 'city-lucknow',
      };
      mockRequest.params = { id: 'entity-001' };

      const lookupCityId = vi.fn().mockResolvedValue('city-delhi');

      // When
      const middleware = cityScopeByEntity(lookupCityId);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_CITY_MISMATCH',
          message: 'Access denied: entity belongs to a different city',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('bypasses check for super_admin role', async () => {
      // Given
      mockRequest.user = {
        id: 'admin-001',
        role: 'super_admin',
        cityId: undefined,
      };
      mockRequest.params = { id: 'entity-001' };

      const lookupCityId = vi.fn().mockResolvedValue('city-delhi');

      // When
      const middleware = cityScopeByEntity(lookupCityId);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then
      expect(mockNext).toHaveBeenCalled();
      expect(lookupCityId).not.toHaveBeenCalled(); // Should not even look up
    });

    test('bypasses check for ops role', async () => {
      // Given
      mockRequest.user = {
        id: 'ops-001',
        role: 'ops',
        cityId: 'city-lucknow',
      };
      mockRequest.params = { id: 'entity-001' };

      const lookupCityId = vi.fn().mockResolvedValue('city-delhi');

      // When
      const middleware = cityScopeByEntity(lookupCityId);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then
      expect(mockNext).toHaveBeenCalled();
      expect(lookupCityId).not.toHaveBeenCalled();
    });

    test('returns 401 when user is not authenticated', async () => {
      // Given
      mockRequest.user = undefined;
      mockRequest.params = { id: 'entity-001' };

      const lookupCityId = vi.fn();

      // When
      const middleware = cityScopeByEntity(lookupCityId);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('returns 403 when user has no cityId', async () => {
      // Given
      mockRequest.user = {
        id: 'user-001',
        role: 'AGENT',
        cityId: undefined,
      };
      mockRequest.params = { id: 'entity-001' };

      const lookupCityId = vi.fn();

      // When
      const middleware = cityScopeByEntity(lookupCityId);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_CITY_MISSING',
          message: 'User does not have a city assignment',
        },
      });
    });

    test('passes through when no entity id param is provided', async () => {
      // Given
      mockRequest.user = {
        id: 'user-001',
        role: 'AGENT',
        cityId: 'city-lucknow',
      };
      mockRequest.params = {}; // No :id param

      const lookupCityId = vi.fn();

      // When
      const middleware = cityScopeByEntity(lookupCityId);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then
      expect(mockNext).toHaveBeenCalled();
      expect(lookupCityId).not.toHaveBeenCalled();
    });

    test('passes through when lookup function throws (entity not found)', async () => {
      // Given
      mockRequest.user = {
        id: 'user-001',
        role: 'AGENT',
        cityId: 'city-lucknow',
      };
      mockRequest.params = { id: 'nonexistent-entity' };

      const lookupCityId = vi.fn().mockRejectedValue(new Error('Not found'));

      // When
      const middleware = cityScopeByEntity(lookupCityId);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then: lets the handler deal with the 404
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('allows when entity cityId is null (lookup returns null)', async () => {
      // Given
      mockRequest.user = {
        id: 'user-001',
        role: 'AGENT',
        cityId: 'city-lucknow',
      };
      mockRequest.params = { id: 'entity-001' };

      const lookupCityId = vi.fn().mockResolvedValue(null);

      // When
      const middleware = cityScopeByEntity(lookupCityId);
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then: null entityCityId does not block (entityCityId && ... is falsy)
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
