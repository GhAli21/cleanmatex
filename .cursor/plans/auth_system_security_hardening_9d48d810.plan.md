---
name: Auth System Security Hardening
overview: Implement high and medium priority security improvements identified in the authentication system evaluation, focusing on rate limiting, API authentication standardization, CSRF protection, and enhanced tenant validation.
todos:
  - id: rate-limit-setup
    content: Install rate limiting dependencies (@upstash/ratelimit, @upstash/redis) and configure Redis connection
    status: completed
  - id: rate-limit-middleware
    content: Create rate limiting middleware (web-admin/lib/middleware/rate-limit.ts) with limiters for login, password reset, and API endpoints
    status: completed
    dependencies:
      - rate-limit-setup
  - id: apply-rate-limit-auth
    content: Apply rate limiting to auth endpoints (signIn, resetPassword) in auth-context.tsx
    status: completed
    dependencies:
      - rate-limit-middleware
  - id: apply-rate-limit-api
    content: Apply rate limiting to API routes using withRateLimit wrapper
    status: completed
    dependencies:
      - rate-limit-middleware
  - id: audit-api-routes
    content: Audit all API routes to identify inconsistent authentication patterns (custom getAuthContext vs requirePermission)
    status: completed
  - id: standardize-customers-api
    content: Migrate web-admin/app/api/v1/customers/route.ts to use requirePermission middleware
    status: completed
    dependencies:
      - audit-api-routes
  - id: standardize-orders-api
    content: Migrate web-admin/app/api/v1/orders/[id]/batch-update/route.ts and other inconsistent routes to use requirePermission
    status: completed
    dependencies:
      - audit-api-routes
  - id: csrf-implementation
    content: "Implement CSRF protection: create csrf.ts utilities and csrf.ts middleware, integrate with forms and API routes"
    status: completed
  - id: password-requirements
    content: Update password validation to require special characters (validation.ts and supabase/config.toml)
    status: completed
  - id: tenant-metadata-sync
    content: Ensure ensureTenantInUserMetadata() is called after login and tenant switch in auth-context.tsx
    status: completed
  - id: security-tests
    content: Create tests for rate limiting, CSRF protection, and authentication standardization
    status: pending
    dependencies:
      - rate-limit-middleware
      - csrf-implementation
  - id: documentation-update
    content: Update security documentation with implementation status and create guides for rate limiting and CSRF
    status: pending
    dependencies:
      - rate-limit-middleware
      - csrf-implementation
---

# Auth System Security Hardening Plan

Based on the security evaluation (`docs/security/AUTH_SYSTEM_EVALUATION.md`), this plan addresses critical security gaps to strengthen the authentication system from B+ to A- rating.

## Current State Analysis

**Strengths:**

- Supabase Auth integration (industry-standard)
- Row-Level Security (RLS) policies
- Account lockout protection
- JWT tenant management utilities exist (`jwt-tenant-manager.ts`, `tenant-validation.ts`)

**Critical Gaps:**

- Rate limiting NOT implemented (HIGH PRIORITY)
- Inconsistent API authentication patterns (HIGH PRIORITY)
- CSRF protection missing (MEDIUM PRIORITY)
- Password requirements need strengthening (MEDIUM PRIORITY)

## Implementation Plan

### Phase 1: Rate Limiting (HIGH PRIORITY)

**Goal:** Prevent brute force attacks and API abuse**Tasks:**

1. **Install rate limiting library**

- Add `@upstash/ratelimit` and `@upstash/redis` to `web-admin/package.json`
- Configure Redis connection (use existing `ioredis` if available, or Upstash Redis)

2. **Create rate limiting middleware**

- File: `web-admin/lib/middleware/rate-limit.ts`
- Implement rate limiters for:
    - Login attempts: 5 per 15 minutes per IP
    - Password reset: 3 per hour per email
    - API endpoints: 1000 per hour per tenant
    - General API: 200 per minute per user

3. **Apply rate limiting to auth endpoints**

- Update `web-admin/lib/auth/auth-context.tsx`:
    - Wrap `signIn()` with rate limiter
    - Wrap `resetPassword()` with rate limiter
- Update auth API routes if any exist

4. **Apply rate limiting to API routes**

- Create wrapper: `withRateLimit(limiter, handler)`
- Apply to critical endpoints:
    - `web-admin/app/api/v1/orders/**`
    - `web-admin/app/api/v1/customers/**`
    - Other high-traffic endpoints

**Files to modify:**

- `web-admin/package.json` - Add dependencies
- `web-admin/lib/middleware/rate-limit.ts` - New file
- `web-admin/lib/auth/auth-context.tsx` - Add rate limiting
- `web-admin/app/api/**/*.ts` - Apply rate limiting middleware

### Phase 2: Standardize API Authentication (HIGH PRIORITY)

**Goal:** Ensure all API routes use consistent authentication pattern**Tasks:**

1. **Audit current API routes**

- Identify routes using custom `getAuthContext()`
- Identify routes using manual auth checks
- List: `web-admin/app/api/v1/customers/route.ts`, `web-admin/app/api/v1/orders/[id]/batch-update/route.ts`

2. **Enhance requirePermission middleware**

- File: `web-admin/lib/middleware/require-permission.ts`
- Ensure it uses JWT tenant validator (already references `validateJWTWithTenant`)
- Add tenant context validation guarantee

3. **Migrate inconsistent routes**

- Update `web-admin/app/api/v1/customers/route.ts`:
    - Replace custom `getAuthContext()` with `requirePermission('customers:read')` or `requirePermission('customers:create')`
- Update `web-admin/app/api/v1/orders/[id]/batch-update/route.ts`:
    - Replace manual auth check with `requirePermission('orders:update')`
- Update other routes found in audit

4. **Create migration guide**

- Document pattern: Always use `requirePermission()` or `requireTenantAuth()`
- Add to code review checklist

**Files to modify:**

- `web-admin/lib/middleware/require-permission.ts` - Enhance if needed
- `web-admin/app/api/v1/customers/route.ts` - Standardize auth
- `web-admin/app/api/v1/orders/[id]/batch-update/route.ts` - Standardize auth
- Other routes identified in audit

### Phase 3: CSRF Protection (MEDIUM PRIORITY)

**Goal:** Prevent cross-site request forgery attacks**Tasks:**

1. **Implement CSRF token generation**

- File: `web-admin/lib/security/csrf.ts`
- Generate tokens using crypto
- Store tokens in session/cookies

2. **Add CSRF middleware**

- File: `web-admin/lib/middleware/csrf.ts`
- Validate CSRF tokens on state-changing operations (POST, PUT, DELETE, PATCH)
- Skip validation for GET, HEAD, OPTIONS

3. **Integrate CSRF tokens in forms**

- Update form components to include CSRF token
- Add token to API requests via header: `X-CSRF-Token`

4. **Apply CSRF protection**

- Update Next.js middleware to generate tokens
- Apply CSRF middleware to API routes

**Files to create:**

- `web-admin/lib/security/csrf.ts` - CSRF token utilities
- `web-admin/lib/middleware/csrf.ts` - CSRF validation middleware

**Files to modify:**

- `web-admin/middleware.ts` - Add CSRF token generation
- `web-admin/app/api/**/*.ts` - Add CSRF validation for state-changing operations

### Phase 4: Strengthen Password Requirements (MEDIUM PRIORITY)

**Goal:** Require special characters in passwords**Tasks:**

1. **Update password validation**

- File: `web-admin/lib/auth/validation.ts`
- Change `requireSpecialChars: false` to `requireSpecialChars: true` (line 17)

2. **Update validation messages**

- Ensure UI shows special character requirement
- Update password strength indicator

3. **Update Supabase config**

- File: `supabase/config.toml`
- Set `password_requirements = "lower_upper_letters_digits_symbols"` (line 145)

**Files to modify:**

- `web-admin/lib/auth/validation.ts` - Enable special chars requirement
- `supabase/config.toml` - Update password requirements
- Password input components - Update validation messages

### Phase 5: Enhanced Tenant Validation (MEDIUM PRIORITY)

**Goal:** Ensure tenant context is always validated**Tasks:**

1. **Verify JWT tenant manager integration**

- File: `web-admin/lib/auth/jwt-tenant-manager.ts` (already exists)
- Ensure `ensureTenantInUserMetadata()` is called after login
- Ensure it's called after tenant switch

2. **Update auth context**

- File: `web-admin/lib/auth/auth-context.tsx`
- Call `ensureTenantInUserMetadata()` in `signIn()` after successful login
- Call it in `switchTenant()` after tenant switch

3. **Add database trigger (optional)**

- Create migration to auto-sync tenant_org_id to user_metadata
- Use trigger on `org_users_mst` updates

**Files to modify:**

- `web-admin/lib/auth/auth-context.tsx` - Add tenant metadata sync calls
- `supabase/migrations/XXXX_sync_tenant_metadata.sql` - Optional database trigger

### Phase 6: Security Monitoring (LOW PRIORITY - Optional)

**Goal:** Add alerting for security events**Tasks:**

1. **Create security event monitor**

- File: `web-admin/lib/monitoring/security-events.ts`
- Track: failed login attempts, account lockouts, permission denied events

2. **Add alerting logic**

- Threshold-based alerts
- Integration with logging system

**Files to create:**

- `web-admin/lib/monitoring/security-events.ts` - Security event monitoring

## Implementation Order

1. **Week 1:** Phase 1 (Rate Limiting) - Critical for production
2. **Week 1-2:** Phase 2 (API Standardization) - Security consistency
3. **Week 2:** Phase 3 (CSRF Protection) - OWASP requirement
4. **Week 2:** Phase 4 (Password Requirements) - Quick win
5. **Week 3:** Phase 5 (Tenant Validation) - Multi-tenant security
6. **Week 3+:** Phase 6 (Monitoring) - Nice to have

## Testing Strategy

1. **Rate Limiting Tests**

- Test login rate limits (5 attempts)
- Test API rate limits
- Verify proper error responses

2. **Authentication Tests**

- Verify all routes use standardized auth
- Test tenant context validation
- Test permission checks

3. **CSRF Tests**

- Test CSRF token validation
- Test token generation
- Test form submissions

4. **Integration Tests**

- Test complete auth flows
- Test tenant switching
- Test cross-tenant access prevention

## Success Criteria

- [ ] Rate limiting active on all auth and API endpoints
- [ ] All API routes use `requirePermission()` or `requireTenantAuth()`
- [ ] CSRF protection on all state-changing operations
- [ ] Password requirements include special characters
- [ ] Tenant context validated on all requests
- [ ] Security events logged and monitored

## Risk Mitigation

- Rate limiting: Use Redis for distributed rate limiting (Upstash recommended)
- API standardization: Gradual migration, test each route
- CSRF: Start with critical operations, expand gradually
- Password requirements: Grandfather existing passwords, enforce on change

## Documentation Updates