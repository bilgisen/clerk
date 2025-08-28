// Core authentication exports
export * from './clerk';
export * from './github-oidc';

// Export types
export type { AuthContext } from '../types/auth';

// Export errors
export { 
  AuthError, 
  TokenValidationError, 
  PermissionDeniedError,
  RateLimitError,
  ConfigurationError,
  ProviderError 
} from './errors';
