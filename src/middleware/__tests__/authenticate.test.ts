import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authenticate } from '../authenticate';
import admin from 'firebase-admin';

// Mock firebase-admin
vi.mock('firebase-admin', () => ({
  default: {
    auth: vi.fn(),
  },
}));

describe('[P0] Authentication Middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockVerifyIdToken: ReturnType<typeof vi.fn>;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Store original environment
    originalEnv = { ...process.env };

    // Setup mock request
    mockRequest = {
      headers: {},
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

    // Setup Firebase mock
    mockVerifyIdToken = vi.fn();
    (admin.auth as any).mockReturnValue({
      verifyIdToken: mockVerifyIdToken,
    });
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe('[P0] Production Authentication', () => {
    beforeEach(() => {
      // Ensure production mode (DEV_AUTH_BYPASS not set)
      delete process.env.DEV_AUTH_BYPASS;
      process.env.NODE_ENV = 'production';
    });

    test('missing Authorization header returns 401', async () => {
      // Given: Request without Authorization header
      mockRequest.headers = {};

      // When: Authenticate is called
      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Then: Returns 401 with proper error
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_TOKEN_INVALID',
          message: 'Missing or invalid authorization header',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('non-Bearer token returns 401', async () => {
      // Given: Request with wrong auth scheme
      mockRequest.headers = {
        authorization: 'Basic dXNlcjpwYXNz',
      };

      // When: Authenticate is called
      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Then: Returns 401
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_TOKEN_INVALID',
          message: 'Missing or invalid authorization header',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('invalid Firebase token returns 401', async () => {
      // Given: Invalid token
      mockRequest.headers = {
        authorization: 'Bearer invalid-token-xyz',
      };
      mockVerifyIdToken.mockRejectedValue(new Error('Token verification failed'));

      // When: Authenticate is called
      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Then: Returns 401
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_TOKEN_INVALID',
          message: 'Token verification failed',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockVerifyIdToken).toHaveBeenCalledWith('invalid-token-xyz');
    });

    test('valid token sets req.user with all fields', async () => {
      // Given: Valid Firebase token
      mockRequest.headers = {
        authorization: 'Bearer valid-firebase-token',
      };
      mockVerifyIdToken.mockResolvedValue({
        uid: 'user-123',
        email: 'agent@example.com',
        role: 'AGENT',
        cityId: 'city-456',
        permissions: ['read:services', 'create:requests'],
      });

      // When: Authenticate is called
      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Then: req.user is populated
      expect(mockRequest.user).toEqual({
        id: 'user-123',
        email: 'agent@example.com',
        role: 'AGENT',
        cityId: 'city-456',
        permissions: ['read:services', 'create:requests'],
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    test('valid token without cityId sets undefined', async () => {
      // Given: Token without cityId (e.g., super admin)
      mockRequest.headers = {
        authorization: 'Bearer token-no-city',
      };
      mockVerifyIdToken.mockResolvedValue({
        uid: 'admin-001',
        email: 'admin@example.com',
        role: 'SUPER_ADMIN',
        permissions: ['*'],
      });

      // When: Authenticate is called
      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Then: cityId is undefined
      expect(mockRequest.user).toEqual({
        id: 'admin-001',
        email: 'admin@example.com',
        role: 'SUPER_ADMIN',
        cityId: undefined,
        permissions: ['*'],
      });
      expect(mockNext).toHaveBeenCalled();
    });

    test('user with no role returns 403', async () => {
      // Given: Valid token but no role assigned
      mockRequest.headers = {
        authorization: 'Bearer token-no-role',
      };
      mockVerifyIdToken.mockResolvedValue({
        uid: 'user-no-role',
        email: 'newuser@example.com',
        // role is missing or empty
      });

      // When: Authenticate is called
      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Then: Returns 403
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_NO_ROLE',
          message: 'User has no assigned role',
        },
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('user with empty string role returns 403', async () => {
      // Given: Token with empty role
      mockRequest.headers = {
        authorization: 'Bearer token-empty-role',
      };
      mockVerifyIdToken.mockResolvedValue({
        uid: 'user-empty-role',
        email: 'user@example.com',
        role: '', // Empty string
      });

      // When: Authenticate is called
      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Then: Returns 403
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_NO_ROLE',
          message: 'User has no assigned role',
        },
      });
    });

    test('token without email sets undefined', async () => {
      // Given: Token without email claim
      mockRequest.headers = {
        authorization: 'Bearer token-no-email',
      };
      mockVerifyIdToken.mockResolvedValue({
        uid: 'user-anonymous',
        role: 'CUSTOMER',
      });

      // When: Authenticate is called
      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Then: email is undefined but auth succeeds
      expect(mockRequest.user?.email).toBeUndefined();
      expect(mockRequest.user?.id).toBe('user-anonymous');
      expect(mockNext).toHaveBeenCalled();
    });

    test('token without permissions defaults to empty array', async () => {
      // Given: Token without permissions
      mockRequest.headers = {
        authorization: 'Bearer token-no-perms',
      };
      mockVerifyIdToken.mockResolvedValue({
        uid: 'user-basic',
        email: 'basic@example.com',
        role: 'CUSTOMER',
      });

      // When: Authenticate is called
      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Then: permissions defaults to empty array
      expect(mockRequest.user?.permissions).toEqual([]);
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('[P0] Development Mode - DEV_AUTH_BYPASS', () => {
    test('DEV_AUTH_BYPASS requires both development mode AND explicit flag', async () => {
      // Given: Development mode but DEV_AUTH_BYPASS not set
      process.env.NODE_ENV = 'development';
      delete process.env.DEV_AUTH_BYPASS;
      mockRequest.headers = {
        'x-dev-user-id': 'dev-user',
        'x-dev-role': 'AGENT',
      };

      // When: Authenticate is called
      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Then: Falls through to production auth (fails without Bearer token)
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('DEV_AUTH_BYPASS works in development when explicitly enabled', async () => {
      // Given: Development mode with DEV_AUTH_BYPASS=true
      process.env.NODE_ENV = 'development';
      process.env.DEV_AUTH_BYPASS = 'true';
      mockRequest.headers = {
        'x-dev-user-id': 'dev-user-123',
        'x-dev-role': 'DEALER',
        'x-dev-city-id': 'dev-city-456',
        'x-dev-email': 'dealer@dev.local',
      };

      // When: Authenticate is called
      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Then: User is authenticated from dev headers
      expect(mockRequest.user).toEqual({
        id: 'dev-user-123',
        role: 'DEALER',
        cityId: 'dev-city-456',
        email: 'dealer@dev.local',
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockVerifyIdToken).not.toHaveBeenCalled();
    });

    test('DEV_AUTH_BYPASS works in test mode when enabled', async () => {
      // Given: Test mode with DEV_AUTH_BYPASS
      process.env.NODE_ENV = 'test';
      process.env.DEV_AUTH_BYPASS = 'true';
      mockRequest.headers = {
        'x-dev-user-id': 'test-user',
        'x-dev-role': 'AGENT',
      };

      // When: Authenticate is called
      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Then: Succeeds
      expect(mockRequest.user?.id).toBe('test-user');
      expect(mockNext).toHaveBeenCalled();
    });

    test('DEV_AUTH_BYPASS requires both user-id and role', async () => {
      // Given: DEV_AUTH_BYPASS enabled but missing role
      process.env.NODE_ENV = 'development';
      process.env.DEV_AUTH_BYPASS = 'true';
      mockRequest.headers = {
        'x-dev-user-id': 'dev-user',
        // x-dev-role is missing
      };

      // When: Authenticate is called
      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Then: Falls through to production auth (fails)
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('DEV_AUTH_BYPASS cityId is optional', async () => {
      // Given: DEV_AUTH_BYPASS without cityId
      process.env.NODE_ENV = 'development';
      process.env.DEV_AUTH_BYPASS = 'true';
      mockRequest.headers = {
        'x-dev-user-id': 'admin-dev',
        'x-dev-role': 'SUPER_ADMIN',
        // No x-dev-city-id
      };

      // When: Authenticate is called
      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Then: cityId is undefined
      expect(mockRequest.user).toEqual({
        id: 'admin-dev',
        role: 'SUPER_ADMIN',
        cityId: undefined,
        email: undefined,
      });
      expect(mockNext).toHaveBeenCalled();
    });

    test('DEV_AUTH_BYPASS disabled in production even if flag set', async () => {
      // Given: Production mode (DEV_AUTH_BYPASS should not work)
      process.env.NODE_ENV = 'production';
      process.env.DEV_AUTH_BYPASS = 'true';
      mockRequest.headers = {
        'x-dev-user-id': 'hacker',
        'x-dev-role': 'SUPER_ADMIN',
      };

      // When: Authenticate is called
      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Then: Fails (production always requires Firebase token)
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRequest.user).toBeUndefined();
    });

    test('DEV_AUTH_BYPASS=false is treated as disabled', async () => {
      // Given: Development mode but DEV_AUTH_BYPASS=false
      process.env.NODE_ENV = 'development';
      process.env.DEV_AUTH_BYPASS = 'false';
      mockRequest.headers = {
        'x-dev-user-id': 'dev-user',
        'x-dev-role': 'AGENT',
      };

      // When: Authenticate is called
      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Then: Falls through to production auth
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('[P0] Edge Cases', () => {
    beforeEach(() => {
      process.env.NODE_ENV = 'production';
      delete process.env.DEV_AUTH_BYPASS;
    });

    test('malformed Bearer token (no space) returns 401', async () => {
      // Given: Bearer token without space
      mockRequest.headers = {
        authorization: 'Bearertoken123',
      };

      // When: Authenticate is called
      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Then: Returns 401
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    test('Bearer with empty token returns 401', async () => {
      // Given: Bearer with no token
      mockRequest.headers = {
        authorization: 'Bearer ',
      };
      mockVerifyIdToken.mockRejectedValue(new Error('Empty token'));

      // When: Authenticate is called
      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Then: Returns 401
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    test('Firebase throws non-error exception', async () => {
      // Given: Firebase throws non-Error object
      mockRequest.headers = {
        authorization: 'Bearer weird-error-token',
      };
      mockVerifyIdToken.mockRejectedValue('String error');

      // When: Authenticate is called
      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Then: Returns 401
      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: {
          code: 'AUTH_TOKEN_INVALID',
          message: 'Token verification failed',
        },
      });
    });

    test('case-sensitive Bearer prefix', async () => {
      // Given: Wrong case for Bearer
      mockRequest.headers = {
        authorization: 'bearer valid-token',
      };

      // When: Authenticate is called
      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Then: Returns 401 (case-sensitive check)
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });

    test('extra whitespace after Bearer', async () => {
      // Given: Multiple spaces after Bearer
      mockRequest.headers = {
        authorization: 'Bearer  token-with-extra-space',
      };
      mockVerifyIdToken.mockResolvedValue({
        uid: 'user-123',
        role: 'CUSTOMER',
      });

      // When: Authenticate is called
      await authenticate(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Then: Second element after split is empty, third is token
      // This will fail verification since we take split(' ')[1]
      expect(mockVerifyIdToken).toHaveBeenCalledWith('');
    });
  });
});
