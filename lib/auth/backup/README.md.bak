# Authentication System

This module provides authentication and authorization for the Clerko application. It supports multiple authentication methods including Clerk and GitHub OIDC.

## Authentication Methods

### 1. Clerk Authentication

Clerk is used for user authentication via email/password, social logins, and magic links.

**Configuration:**
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Public key for Clerk
- `CLERK_SECRET_KEY`: Secret key for server-side operations
- `JWT_ISSUER`: Issuer for JWT tokens (default: 'clerk.clerko.v1')
- `JWT_AUDIENCE`: Audience for JWT tokens (default: 'https://api.clerko.com')

**Usage:**
```typescript
import { verifyClerkToken } from '@/lib/auth/clerk';

// In your API route
const authContext = await verifyClerkToken();
```

### 2. GitHub OIDC Authentication

GitHub OIDC is used for GitHub Actions and other GitHub-based authentication flows.

**Configuration:**
- `GITHUB_OIDC_AUDIENCE`: Required audience for GitHub OIDC tokens
- `GHA_ALLOWED_REPO`: (Optional) Allowed GitHub repository (e.g., 'owner/repo')
- `GHA_ALLOWED_REF`: (Optional) Allowed Git reference (e.g., 'refs/heads/main')

**Usage:**
```typescript
import { verifyGitHubToken } from '@/lib/auth/github';

// In your API route
const authContext = await verifyGitHubToken(token, {
  audience: process.env.GITHUB_OIDC_AUDIENCE,
  allowedRepo: process.env.GHA_ALLOWED_REPO,
  allowedRef: process.env.GHA_ALLOWED_REF
});
```

## Middleware

The `withAuth` middleware can be used to protect API routes:

```typescript
import { withAuth, requireAuth, optionalAuth } from '@/lib/middleware/withAuth';

// Require authentication
export const GET = withAuth(async (req, context, auth) => {
  // auth is guaranteed to be defined here
  return NextResponse.json({ user: auth.userId });
}, requireAuth);

// Make authentication optional
export const POST = withAuth(async (req, context, auth) => {
  // auth might be null
  return NextResponse.json({ userId: auth?.userId || 'anonymous' });
}, optionalAuth);
```

## Error Handling

Authentication errors are handled by the `AuthError` class, which includes:
- `message`: Human-readable error message
- `code`: Machine-readable error code
- `status`: HTTP status code
- `details`: Additional error details

Common error codes:
- `UNAUTHORIZED`: No valid authentication provided
- `FORBIDDEN`: Insufficient permissions
- `TOKEN_EXPIRED`: Authentication token has expired
- `TOKEN_INVALID`: Invalid authentication token
- `RATE_LIMIT_EXCEEDED`: Too many requests
- `INTERNAL_SERVER_ERROR`: Unexpected server error

## Security Headers

The authentication middleware automatically adds the following security headers to responses:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`

## Best Practices

1. Always use the `withAuth` middleware for API routes that require authentication
2. Use `requireAuth` for endpoints that need authentication
3. Use `optionalAuth` for public endpoints that can work with or without authentication
4. Always validate user permissions before performing sensitive operations
5. Use environment variables for all sensitive configuration
6. Never expose sensitive information in error responses in production
