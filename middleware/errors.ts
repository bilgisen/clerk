export class AuthError extends Error {
  constructor(
    message: string,
    public readonly code: string = 'AUTH_ERROR',
    public readonly status: number = 401,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'AuthError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class TokenValidationError extends AuthError {
  constructor(
    message: string = 'Invalid or expired token',
    public readonly tokenType: string = 'unknown',
    details?: Record<string, unknown>
  ) {
    super(message, 'TOKEN_VALIDATION_ERROR', 401, { ...details, tokenType });
    this.name = 'TokenValidationError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RateLimitError extends AuthError {
  constructor(
    message: string = 'Too many requests',
    public readonly retryAfter?: number,
    details?: Record<string, unknown>
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED', 429, { ...details, retryAfter });
    this.name = 'RateLimitError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class PermissionError extends AuthError {
  constructor(
    message: string = 'Insufficient permissions',
    public readonly requiredPermissions: string[] = [],
    details?: Record<string, unknown>
  ) {
    super(message, 'PERMISSION_DENIED', 403, { ...details, requiredPermissions });
    this.name = 'PermissionError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
