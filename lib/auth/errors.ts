export interface AuthErrorDetails extends Record<string, unknown> {
  retryAfter?: number;
  [key: string]: unknown;
}

/**
 * Base error class for authentication-related errors
 */
export class AuthError extends Error {
  public readonly details: AuthErrorDetails;
  public readonly retryAfter?: number;

  constructor(
    message: string,
    public readonly code: string = 'AUTH_ERROR',
    public readonly status: number = 401,
    details: AuthErrorDetails = {}
  ) {
    super(message);
    this.name = 'AuthError';
    this.details = details || {};
    this.retryAfter = details?.retryAfter;
    
    // Set the prototype explicitly for instanceof checks
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

/**
 * Error thrown when token validation fails
 */
export class TokenValidationError extends AuthError {
  constructor(
    message: string = 'Invalid or expired token',
    public readonly tokenType: string = 'unknown',
    details?: Record<string, unknown>
  ) {
    super(message, 'TOKEN_VALIDATION_ERROR', 401, details);
    this.name = 'TokenValidationError';
    Object.setPrototypeOf(this, TokenValidationError.prototype);
  }
}

/**
 * Error thrown when a required permission is missing
 */
export class PermissionDeniedError extends AuthError {
  constructor(
    message: string = 'Insufficient permissions',
    public readonly requiredPermissions: string[] = [],
    details?: Record<string, unknown>
  ) {
    super(message, 'PERMISSION_DENIED', 403, {
      ...details,
      requiredPermissions
    });
    this.name = 'PermissionDeniedError';
    Object.setPrototypeOf(this, PermissionDeniedError.prototype);
  }
}

/**
 * Error thrown when rate limiting is encountered
 */
export class RateLimitError extends AuthError {
  constructor(
    message: string = 'Too many requests',
    public readonly retryAfter?: number,
    details?: Record<string, unknown>
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, {
      ...details,
      retryAfter
    });
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Error thrown when authentication configuration is invalid
 */
export class ConfigurationError extends AuthError {
  constructor(
    message: string = 'Invalid authentication configuration',
    public readonly configKey?: string,
    details?: Record<string, unknown>
  ) {
    super(message, 'INVALID_CONFIGURATION', 500, {
      ...details,
      configKey
    });
    this.name = 'ConfigurationError';
    Object.setPrototypeOf(this, ConfigurationError.prototype);
  }
}

/**
 * Error thrown when a required authentication provider is not available
 */
export class ProviderError extends AuthError {
  constructor(
    message: string = 'Authentication provider error',
    public readonly provider: string = 'unknown',
    details?: Record<string, unknown>
  ) {
    super(message, 'PROVIDER_ERROR', 500, {
      ...details,
      provider
    });
    this.name = 'ProviderError';
    Object.setPrototypeOf(this, ProviderError.prototype);
  }
}
