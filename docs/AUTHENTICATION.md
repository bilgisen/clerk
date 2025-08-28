# Authentication System

This document describes the authentication system used in the application.

## Overview

The authentication system supports two main authentication methods:
1. **Clerk Authentication** - For web users
2. **GitHub OIDC** - For GitHub Actions workflows

## Setup

### Environment Variables

Add these to your `.env.local` file:

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# GitHub OIDC
GITHUB_OIDC_ISSUER=https://token.actions.githubusercontent.com
GITHUB_OIDC_AUDIENCE=your_audience

# Optional: Restrict to specific repositories
GITHUB_ALLOWED_REPOSITORIES=owner1/repo1,owner2/repo2

# Optional: Restrict to specific environments
GITHUB_ALLOWED_ENVIRONMENTS=production,staging
```

## Usage

### Middleware

The authentication middleware provides several utility functions to protect your API routes:

```typescript
import { withClerkAuth, withGithubOidcAuth, withOptionalAuth } from '@/middleware/auth';

// Clerk-protected route
export const POST = withClerkAuth(async (request) => {
  const authContext = (request as any).authContext;
  // Your protected route logic here
});

// GitHub OIDC protected route
export const PUT = withGithubOidcAuth(async (request) => {
  const authContext = (request as any).authContext;
  // Your protected route logic here
});

// Optional auth route
export const GET = withOptionalAuth(async (request) => {
  const authContext = (request as any).authContext;
  // Your route logic here
});
```

### Accessing Authentication Context

In any protected route, you can access the authentication context from the request object:

```typescript
const authContext = (request as any).authContext;

// For Clerk authentication
authContext.authType; // 'clerk'
authContext.userId;   // Clerk user ID

// For GitHub OIDC authentication
authContext.authType; // 'github-oidc'
authContext.userId;   // GitHub OIDC subject (usually 'repo:owner/repo:environment:name')
authContext.claims;   // Full JWT claims
```

## Error Handling

The authentication middleware returns standardized error responses:

### 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "code": "UNAUTHORIZED",
  "message": "Authentication required. Please provide valid credentials."
}
```

### 403 Forbidden

```json
{
  "error": "Forbidden",
  "code": "FORBIDDEN",
  "message": "Authentication method 'github-oidc' is not allowed for this endpoint."
}
```

## Security Considerations

1. Always use HTTPS in production
2. Keep your Clerk secret keys secure
3. Restrict GitHub OIDC tokens to specific repositories and environments when possible
4. Validate all inputs from authenticated requests
5. Use the principle of least privilege when setting up permissions
