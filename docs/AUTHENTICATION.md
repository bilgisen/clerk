# Authentication System

This document describes the authentication system used in the application.

## Overview

The authentication system is built on top of NextAuth.js with the following features:
- Email/password authentication
- OAuth providers (Google, GitHub)
- JWT-based session management
- Role-based access control
- API route protection

## Setup

### Environment Variables

Add these to your `.env.local` file:

```env
# Authentication
NEXTAUTH_SECRET=your_nextauth_secret
NEXTAUTH_URL=http://localhost:3000

# JWT Secret (for API authentication)
JWT_SECRET=your_jwt_secret_here

# OAuth Providers
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# Database
DATABASE_URL=your_database_url
```

## Usage

### Client Components

Use the `useAuth` hook to access the current user and authentication methods:

```typescript
import { useAuth } from '@/hooks/use-auth';

function MyComponent() {
  const { user, loading, signOut } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Not authenticated</div>;
  
  return (
    <div>
      <p>Welcome, {user.name}!</p>
      <button onClick={signOut}>Sign out</button>
    </div>
  );
}
```

### API Routes

Protect your API routes using the `requireAuth` utility:

```typescript
import { requireAuth } from '@/lib/auth/api-auth';

export async function GET(request: Request) {
  const { user, error } = await requireAuth();
  if (error) return error;
  
  // User is authenticated
  return Response.json({ message: 'Protected data', user });
}
```

### Middleware

The authentication middleware protects your pages and API routes. Add it to your `middleware.ts` file:

```typescript
import { auth } from '@/auth';

export default auth((req) => {
  // Your middleware logic here
});

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
```
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
