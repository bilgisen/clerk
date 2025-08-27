# Combined Token System Implementation Plan

## 1. Environment Setup
- [ ] Add required environment variables to `.env.local`
  ```
  # Clerk
  CLERK_PUBLISHABLE_KEY=
  CLERK_SECRET_KEY=
  
  # JWT
  COMBINED_JWT_ALG=EdDSA
  COMBINED_JWT_PRIVATE_KEY=
  COMBINED_JWT_PUBLIC_KEY=
  COMBINED_JWT_AUD=clerko:publish
  
  # GitHub OIDC
  GITHUB_OIDC_ISSUER=https://token.actions.githubusercontent.com
  GITHUB_OIDC_AUD=clerko-backend
  
  # Redis
  REDIS_URL=
  ```

## 2. Dependencies
- [ ] Install required packages:
  ```bash
  pnpm add jose @clerk/nextjs ioredis zod
  ```

## 3. Directory Structure
```
lib/
  auth/
    clerk.ts
    github-oidc.ts
    combined.ts
    withPublishAuth.ts
  store/
    redis.ts
  types/
    publish.ts

app/
  api/
    publish/
      init/route.ts
      attest/route.ts
      combined/route.ts
      status/route.ts
      finalize/route.ts
```

## 4. Implementation Steps

### 4.1 Redis Session Store
- [ ] Implement `lib/store/redis.ts`
  - Session CRUD operations
  - TTL management
  - Type definitions

### 4.2 Authentication Utilities
- [ ] Implement `lib/auth/clerk.ts`
  - User verification helpers
  - Role/claim validation

- [ ] Implement `lib/auth/github-oidc.ts`
  - OIDC token verification
  - GitHub claims validation

- [ ] Implement `lib/auth/combined.ts`
  - JWT signing/verification
  - Token validation logic

### 4.3 API Routes
- [ ] `/api/publish/init` - Initialize publish session
- [ ] `/api/publish/attest` - GitHub runner attestation
- [ ] `/api/publish/combined` - Fetch combined token
- [ ] `/api/publish/status` - Update publish status
- [ ] `/api/publish/finalize` - Complete publish flow

### 4.4 GitHub Workflow
- [ ] Create `.github/workflows/publish.yml`
  - OIDC setup
  - Publish steps
  - Status updates

## 5. Client Integration
- [ ] Implement publish initialization
- [ ] Add token polling mechanism
- [ ] Handle publish status updates

## 6. Testing
- [ ] Unit tests for auth utilities
- [ ] Integration tests for API routes
- [ ] End-to-end test with GitHub Actions

## 7. Documentation
- [ ] API documentation
- [ ] Client usage guide
- [ ] Security considerations

## 8. Deployment
- [ ] Update deployment configuration
- [ ] Set up production secrets
- [ ] Monitor and log authentication events
