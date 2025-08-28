# Combined Token Implementation Plan

## Phase 1: Core Token System

### 1.1 Fix TypeScript Errors
- [ ] Fix type imports and interfaces in `combined-token.ts`
- [ ] Update session handling types
- [ ] Ensure proper error type definitions
- [ ] Fix type mismatches in authentication flows

### 1.2 Token Generation
- [ ] Implement token generation with proper claims:
  - Session ID
  - User/CI context
  - Permissions
  - Expiration (15 minutes)
  - GitHub context for CI tokens
- [ ] Support both Clerk and GitHub OIDC flows
- [ ] Handle token refresh logic

### 1.3 Token Verification
- [ ] Implement signature validation
- [ ] Add expiration checks
- [ ] Verify audience and issuer
- [ ] Validate custom claims
- [ ] Handle token revocation

## Phase 2: Session Management

### 2.1 Redis Integration
- [ ] Set up Redis client
- [ ] Implement session CRUD operations
- [ ] Add TTL for automatic cleanup
- [ ] Handle connection errors and reconnections

### 2.2 Session Data Structure
```typescript
interface Session {
  id: string;
  userId: string;
  contentId?: string;
  status: PublishStatus;
  nonce?: string;
  permissions: {
    can_publish: boolean;
    can_generate: boolean;
    can_manage: boolean;
  };
  metadata: Record<string, any>;
  gh?: GitHubContext;
  createdAt: number;
  updatedAt: number;
}
```

## Phase 3: API Integration

### 3.1 Token Endpoints
- [ ] `/api/combined-token` - Issue new tokens
  - Handle Clerk authentication
  - Handle GitHub OIDC flow
  - Generate and return tokens

- [ ] `/api/verify-token` - Validate tokens
  - Verify token signature
  - Check session validity
  - Return token status

### 3.2 Protected Routes
- [ ] Update middleware for token verification
- [ ] Add permission checks
- [ ] Handle token refresh
- [ ] Add rate limiting

## Phase 4: Security & Error Handling

### 4.1 Security Measures
- [ ] Implement rate limiting
- [ ] Add token binding
- [ ] Set secure cookie settings
- [ ] Add CSRF protection
- [ ] Implement token blacklisting

### 4.2 Error Handling
- [ ] Create custom error classes
- [ ] Standardize error responses
- [ ] Add error logging
- [ ] Implement proper HTTP status codes

## Phase 5: Testing & Documentation

### 5.1 Unit Tests
- [ ] Token generation/verification
- [ ] Session management
- [ ] Error cases
- [ ] Edge cases

### 5.2 Integration Tests
- [ ] End-to-end authentication flow
- [ ] Session persistence
- [ ] Error scenarios

### 5.3 Documentation
- [ ] API documentation
- [ ] Authentication flow diagrams
- [ ] Example requests/responses
- [ ] Setup and configuration guide

## Phase 6: Deployment & Monitoring

### 6.1 Deployment
- [ ] Environment configuration
- [ ] Secrets management
- [ ] Deployment scripts

### 6.2 Monitoring
- [ ] Logging setup
- [ ] Metrics collection
- [ ] Alerting configuration

## Timeline

1. Week 1: Complete Phase 1 (Core Token System)
2. Week 2: Implement Phase 2 (Session Management)
3. Week 3: Finish Phase 3 (API Integration)
4. Week 4: Complete Phase 4 (Security & Error Handling)
5. Week 5: Finalize testing and documentation

## Dependencies

- Node.js 16+
- Redis 6+
- @clerk/nextjs
- jose (JWT)
- TypeScript 4.5+

## Environment Variables

```
# Required
REDIS_URL=redis://localhost:6379
COMBINED_JWT_PRIVATE_KEY=
COMBINED_JWT_PUBLIC_KEY=
COMBINED_JWT_AUD=clerk-actions

# GitHub OIDC
GITHUB_OIDC_ISSUER=https://token.actions.githubusercontent.com
GITHUB_OIDC_AUD=

# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
```
