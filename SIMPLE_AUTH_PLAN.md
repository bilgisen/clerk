# Simplified Authentication System

## 1. Authentication Flow

1. **Clerk Authentication** for web users
   - Handled automatically by Clerk middleware
   - Protected routes require valid Clerk session

2. **GitHub OIDC** for GitHub Actions
   - Verify GitHub OIDC tokens in API routes
   - Validate required claims (repository, workflow, etc.)

## 2. Directory Structure

```
middleware/
  auth.ts          # Main authentication middleware
  github-oidc.ts   # GitHub OIDC verification
  clerk.ts         # Clerk authentication helpers
  types.ts         # Shared types

lib/
  auth/
    clerk.ts       # Clerk authentication utilities
    github-oidc.ts # GitHub OIDC verification logic
    types.ts       # Authentication types
```

## 3. Implementation Steps

### 3.1 Middleware

1. **auth.ts** - Main authentication middleware
   - Public/private route configuration
   - Route protection logic
   - Error handling

2. **github-oidc.ts**
   - GitHub OIDC token verification
   - Required claims validation
   - Error handling

3. **clerk.ts**
   - Clerk authentication helpers
   - Session validation
   - User role/permission checks

### 3.2 API Routes

1. Public routes - No authentication required
2. Clerk-protected routes - Require valid Clerk session
3. GitHub OIDC routes - Require valid GitHub OIDC token

### 3.3 Environment Variables

```
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# GitHub OIDC
GITHUB_OIDC_ISSUER=https://token.actions.githubusercontent.com
GITHUB_OIDC_AUDIENCE=clerko-backend

# Optional: Restrict to specific repositories
GITHUB_ALLOWED_REPOSITORIES=owner1/repo1,owner2/repo2
```

## 4. Security Considerations

1. Always validate all inputs
2. Use secure HTTP headers
3. Rate limiting for sensitive endpoints
4. Proper error handling without leaking sensitive information
5. Logging for security events

## 5. Testing

1. Unit tests for authentication logic
2. Integration tests for protected routes
3. E2E tests for complete flows

## 6. Documentation

1. API documentation for protected endpoints
2. Setup instructions for GitHub Actions
3. Troubleshooting guide
