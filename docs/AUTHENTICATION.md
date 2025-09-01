# Authentication System

This document describes the authentication system used in the application, built with Better Auth and Google SSO.

## Overview

The authentication system provides the following features:
- Google Single Sign-On (SSO)
- Session-based authentication
- JWT token generation for API access
- Protected API routes
- Secure HTTP-only cookies
- Role-based access control

## Setup

### Environment Variables

Add these to your `.env.local` file:

```env
# Authentication
AUTH_SECRET=your_auth_secret_here
AUTH_URL=http://localhost:3000

# JWT Secret (for API authentication)
JWT_SECRET=your_jwt_secret_here

# Google OAuth (required for SSO)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Database
DATABASE_URL=your_database_url
```

## Usage

### Client Components

Use the `useAuth` hook to access the current user and authentication methods:

```typescript
import { useAuth } from '@/lib/auth/use-auth';

function MyComponent() {
  const { user, isLoading, signOut } = useAuth();
  
  if (isLoading) return <div>Loading...</div>;
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

Protect your API routes using the `withSessionAuth` middleware:

```typescript
import { withSessionAuth } from '@/middleware/auth';

export const GET = withSessionAuth(async (request: NextRequest, { authContext }) => {
  // User is authenticated
  return NextResponse.json({ 
    message: 'Protected data', 
    userId: authContext.userId 
  });
});
```

### Middleware

The authentication middleware protects your pages and API routes. Add it to your `middleware.ts` file:

```typescript
import { withSessionAuth } from './middleware/auth';

export default withSessionAuth((req) => {
  // Your middleware logic here
});

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
```

### Accessing Authentication Context

In any protected route, you can access the authentication context:

```typescript
// In API routes
const authContext = (request as any).authContext;

// Type-safe access
authContext.userId;   // Authenticated user ID
authContext.email;    // User's email (if available)
authContext.sessionId; // Current session ID
```

## Error Handling

The authentication middleware returns standardized error responses:

### 401 Unauthorized

```json
{
  "error": "Unauthorized",
  "code": "UNAUTHORIZED",
  "message": "Authentication required. Please log in."
}
```

### 500 Internal Server Error

```json
{
  "error": "Internal Server Error",
  "code": "INTERNAL_SERVER_ERROR",
  "message": "An error occurred during authentication."
}
```

## Security Considerations

1. Always use HTTPS in production
2. Keep your authentication secrets secure
3. Use secure, HTTP-only cookies for session storage
4. Validate all inputs from authenticated requests
5. Use the principle of least privilege when setting up permissions
6. Implement proper session expiration and rotation
7. Regularly rotate your JWT secrets
