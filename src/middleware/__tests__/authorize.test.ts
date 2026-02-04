import { describe, test, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authorize } from '../authorize';

describe('[P0] Authorization Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    // Setup mock request
    mockRequest = {
      user: undefined,
    };

    // Setup mock response
    const jsonMock = vi.fn().mockReturnThis();
    const statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    // Setup mock next
    mockNext = vi.fn();
  });

  describe('[P0] Role-Based Authorization', () => {
    test('user with allowed role passes through', () => {
      // Given: User with AGENT role
      mockRequest.user = {
        id: 'user-123',
        role: 'AGENT',
        cityId: 'city-456',
        email: 'agent@example.com',
      };

      // When: Authorize middleware requires AGENT role
      const middleware = authorize('AGENT');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then: Request passes through
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('user with disallowed role returns 403', () => {
      // Given: User with CUSTOMER role
      mockRequest.user = {
        id: 'user-789',
        role: 'CUSTOMER',
        cityId: 'city-456',
      };

      // When: Authorize middleware requires AGENT role
      const middleware = authorize('AGENT');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then: Returns 403
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_INSUFFICIENT_ROLE',
          message: 'Required role: AGENT. Current role: CUSTOMER',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('multiple allowed roles - first role matches', () => {
      // Given: User with DEALER role
      mockRequest.user = {
        id: 'dealer-1',
        role: 'DEALER',
        cityId: 'city-789',
      };

      // When: Multiple roles allowed
      const middleware = authorize('DEALER', 'AGENT', 'SUPER_ADMIN');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then: Passes through
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('multiple allowed roles - middle role matches', () => {
      // Given: User with AGENT role
      mockRequest.user = {
        id: 'agent-1',
        role: 'AGENT',
      };

      // When: Multiple roles allowed, AGENT is in the middle
      const middleware = authorize('SUPER_ADMIN', 'AGENT', 'DEALER');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then: Passes through
      expect(mockNext).toHaveBeenCalled();
    });

    test('multiple allowed roles - last role matches', () => {
      // Given: User with CUSTOMER role
      mockRequest.user = {
        id: 'customer-1',
        role: 'CUSTOMER',
      };

      // When: Multiple roles, CUSTOMER is last
      const middleware = authorize('SUPER_ADMIN', 'AGENT', 'CUSTOMER');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then: Passes through
      expect(mockNext).toHaveBeenCalled();
    });

    test('multiple allowed roles - no match returns 403', () => {
      // Given: User with CUSTOMER role
      mockRequest.user = {
        id: 'customer-1',
        role: 'CUSTOMER',
      };

      // When: Multiple roles but none match
      const middleware = authorize('SUPER_ADMIN', 'AGENT', 'DEALER');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then: Returns 403 with all allowed roles listed
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_INSUFFICIENT_ROLE',
          message: 'Required role: SUPER_ADMIN or AGENT or DEALER. Current role: CUSTOMER',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('single role check - exact match', () => {
      // Given: User with SUPER_ADMIN role
      mockRequest.user = {
        id: 'admin-1',
        role: 'SUPER_ADMIN',
      };

      // When: Require SUPER_ADMIN
      const middleware = authorize('SUPER_ADMIN');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then: Passes
      expect(mockNext).toHaveBeenCalled();
    });

    test('role comparison is case-sensitive', () => {
      // Given: User with lowercase role
      mockRequest.user = {
        id: 'user-1',
        role: 'agent', // lowercase
      };

      // When: Require uppercase AGENT
      const middleware = authorize('AGENT');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then: Returns 403 (case-sensitive)
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('[P0] Missing Authentication', () => {
    test('missing req.user returns 401', () => {
      // Given: Request without user (not authenticated)
      mockRequest.user = undefined;

      // When: Authorize is called
      const middleware = authorize('AGENT');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then: Returns 401
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

    test('null req.user returns 401', () => {
      // Given: Request with null user
      (mockRequest as any).user = null;

      // When: Authorize is called
      const middleware = authorize('AGENT');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then: Returns 401
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });
  });

  describe('[P0] Edge Cases', () => {
    test('empty allowed roles list denies all requests', () => {
      // Given: Authenticated user
      mockRequest.user = {
        id: 'user-1',
        role: 'AGENT',
      };

      // When: No allowed roles specified
      const middleware = authorize();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then: Returns 403
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('user with empty string role is rejected', () => {
      // Given: User with empty role
      mockRequest.user = {
        id: 'user-1',
        role: '',
      };

      // When: Authorize requires any role
      const middleware = authorize('AGENT', 'CUSTOMER');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then: Returns 403
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_INSUFFICIENT_ROLE',
          message: 'Required role: AGENT or CUSTOMER. Current role: ',
        },
      });
    });

    test('whitespace in role name is significant', () => {
      // Given: User with role with trailing space
      mockRequest.user = {
        id: 'user-1',
        role: 'AGENT ',
      };

      // When: Require AGENT (no space)
      const middleware = authorize('AGENT');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then: Returns 403 (exact match required)
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    test('duplicate allowed roles work correctly', () => {
      // Given: User with AGENT role
      mockRequest.user = {
        id: 'agent-1',
        role: 'AGENT',
      };

      // When: AGENT specified multiple times
      const middleware = authorize('AGENT', 'DEALER', 'AGENT');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then: Still passes (first match)
      expect(mockNext).toHaveBeenCalled();
    });

    test('middleware can be reused for multiple requests', () => {
      // Given: Same middleware instance
      const middleware = authorize('AGENT', 'DEALER');

      // When: Used for multiple requests with different users
      // Request 1: AGENT
      mockRequest.user = { id: '1', role: 'AGENT' };
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Request 2: DEALER
      vi.clearAllMocks();
      mockRequest.user = { id: '2', role: 'DEALER' };
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Request 3: CUSTOMER (unauthorized)
      vi.clearAllMocks();
      mockRequest.user = { id: '3', role: 'CUSTOMER' };
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('special characters in role names', () => {
      // Given: User with role containing special chars
      mockRequest.user = {
        id: 'user-1',
        role: 'ROLE_WITH-SPECIAL.CHARS',
      };

      // When: Exact role required
      const middleware = authorize('ROLE_WITH-SPECIAL.CHARS');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then: Passes (exact match)
      expect(mockNext).toHaveBeenCalled();
    });

    test('numeric role names', () => {
      // Given: User with numeric-like role
      mockRequest.user = {
        id: 'user-1',
        role: '123',
      };

      // When: Numeric role required
      const middleware = authorize('123', '456');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then: Passes
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('[P0] Integration Scenarios', () => {
    test('super admin can access admin-only endpoint', () => {
      // Given: Super admin user
      mockRequest.user = {
        id: 'admin-1',
        role: 'SUPER_ADMIN',
        email: 'admin@example.com',
      };

      // When: Admin-only endpoint
      const middleware = authorize('SUPER_ADMIN');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then: Access granted
      expect(mockNext).toHaveBeenCalled();
    });

    test('agent cannot access admin-only endpoint', () => {
      // Given: Agent user
      mockRequest.user = {
        id: 'agent-1',
        role: 'AGENT',
        cityId: 'city-123',
      };

      // When: Admin-only endpoint
      const middleware = authorize('SUPER_ADMIN');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then: Access denied
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });

    test('agent and dealer can access shared endpoint', () => {
      // Given: Agent user
      mockRequest.user = {
        id: 'agent-1',
        role: 'AGENT',
        cityId: 'city-123',
      };

      // When: Shared endpoint for agents and dealers
      const middleware = authorize('AGENT', 'DEALER');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Then: Agent passes
      expect(mockNext).toHaveBeenCalled();

      // And: Dealer also passes
      vi.clearAllMocks();
      mockRequest.user = {
        id: 'dealer-1',
        role: 'DEALER',
        cityId: 'city-123',
      };
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();

      // But: Customer fails
      vi.clearAllMocks();
      mockRequest.user = {
        id: 'customer-1',
        role: 'CUSTOMER',
      };
      middleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockResponse.status).toHaveBeenCalledWith(403);
    });
  });
});
