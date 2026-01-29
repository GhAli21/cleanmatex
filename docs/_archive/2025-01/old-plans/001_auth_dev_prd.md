# Authentication & Authorization - Implementation Plan

**PRD ID**: 001_auth_dev_prd
**Phase**: MVP
**Priority**: Must Have
**Estimated Duration**: 2 weeks
**Dependencies**: None (Foundation)

---

## Overview

Implement a secure, multi-tenant authentication and authorization system using Supabase Auth with PostgreSQL Row-Level Security (RLS). This module establishes the security foundation for the entire CleanMateX platform, ensuring proper tenant isolation and role-based access control.

---

## Business Value

- **Security**: Database-level tenant isolation prevents accidental or malicious cross-tenant data access
- **Scalability**: Supabase Auth handles authentication complexity, allowing team to focus on business logic
- **Compliance**: Audit trails and secure authentication meet enterprise security requirements
- **Developer Experience**: Simplified auth flow with JWT tokens and automatic RLS policy enforcement

---

## Requirements

### Functional Requirements

- **FR-AUTH-001**: User registration with email/password via Supabase Auth
- **FR-AUTH-002**: User login with JWT token generation
- **FR-AUTH-003**: Password reset via email link
- **FR-AUTH-004**: Email verification for new accounts
- **FR-AUTH-005**: Session management with automatic token refresh
- **FR-AUTH-006**: User profile creation linked to tenant
- **FR-AUTH-007**: Role assignment (Admin, Operator, Viewer) per tenant
- **FR-AUTH-008**: Tenant context injection in JWT custom claims
- **FR-AUTH-009**: RLS policy enforcement on all org\_\* tables
- **FR-AUTH-010**: Multi-tenant user support (same user, multiple tenants)
- **FR-AUTH-011**: Logout and session invalidation
- **FR-AUTH-012**: User impersonation (admin only) for support purposes

### Non-Functional Requirements

- **NFR-AUTH-001**: Authentication response time < 500ms (p95)
- **NFR-AUTH-002**: Token expiration: 1 hour access token, 7 days refresh token
- **NFR-AUTH-003**: Password requirements: min 8 chars, 1 uppercase, 1 lowercase, 1 number
- **NFR-AUTH-004**: Failed login attempts: lock account after 5 attempts (15min cooldown)
- **NFR-AUTH-005**: All auth operations logged to audit trail
- **NFR-AUTH-006**: RLS policies must filter by tenant*org_id for 100% of org*\* queries
- **NFR-AUTH-007**: Support for 10,000+ concurrent authenticated sessions

---

## Database Schema

### User & Tenant Linking

```sql
-- Supabase auth.users (managed by Supabase)
-- Extended with metadata

-- Tenant-User association
CREATE TABLE IF NOT EXISTS org_users_mst (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_org_id     UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  role              VARCHAR(50) NOT NULL DEFAULT 'viewer',
  display_name      VARCHAR(255),
  is_active         BOOLEAN NOT NULL DEFAULT true,
  last_login_at     TIMESTAMP,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(user_id, tenant_org_id)
);

-- Indexes
CREATE INDEX idx_org_users_tenant ON org_users_mst(tenant_org_id);
CREATE INDEX idx_org_users_user ON org_users_mst(user_id);

-- Audit Log
CREATE TABLE IF NOT EXISTS sys_audit_log (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES auth.users(id),
  tenant_org_id     UUID REFERENCES org_tenants_mst(id),
  action            VARCHAR(100) NOT NULL,
  entity_type       VARCHAR(100),
  entity_id         UUID,
  old_values        JSONB,
  new_values        JSONB,
  ip_address        INET,
  user_agent        TEXT,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_user ON sys_audit_log(user_id);
CREATE INDEX idx_audit_tenant ON sys_audit_log(tenant_org_id);
CREATE INDEX idx_audit_created ON sys_audit_log(created_at DESC);
```

### RLS Policies (Core Pattern)

```sql
-- Enable RLS on all org_* tables
ALTER TABLE org_tenants_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_users_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_customers_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_orders_mst ENABLE ROW LEVEL SECURITY;
-- ... (all other org_* tables)

-- Helper function to get current tenant from JWT
CREATE OR REPLACE FUNCTION auth.current_tenant_id()
RETURNS UUID AS $$
  SELECT NULLIF(current_setting('request.jwt.claims', true)::json->>'tenant_id', '')::UUID;
$$ LANGUAGE SQL STABLE;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN AS $$
  SELECT current_setting('request.jwt.claims', true)::json->>'role' = 'admin';
$$ LANGUAGE SQL STABLE;

-- Example RLS Policy for org_orders_mst
CREATE POLICY tenant_isolation_orders ON org_orders_mst
  USING (tenant_org_id = auth.current_tenant_id());

CREATE POLICY admin_all_access_orders ON org_orders_mst
  USING (auth.is_admin());

-- Example RLS Policy for org_users_mst
CREATE POLICY tenant_isolation_users ON org_users_mst
  USING (tenant_org_id = auth.current_tenant_id());

-- Tenant admins can see all users in their tenant
CREATE POLICY tenant_admin_users ON org_users_mst
  USING (
    tenant_org_id = auth.current_tenant_id()
    AND EXISTS (
      SELECT 1 FROM org_users_mst u
      WHERE u.user_id = auth.uid()
      AND u.tenant_org_id = auth.current_tenant_id()
      AND u.role = 'admin'
    )
  );
```

---

## API Endpoints

### Authentication Endpoints

#### POST /v1/auth/register

Register a new user account.

**Request**:

```json
{
  "email": "admin@laundry.com",
  "password": "SecurePass123!",
  "displayName": "John Admin",
  "tenantSlug": "laundry-plus" // Optional: for invite flow
}
```

**Response** (201):

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@laundry.com",
    "emailVerified": false,
    "displayName": "John Admin"
  },
  "message": "Registration successful. Please check your email to verify your account."
}
```

#### POST /v1/auth/login

Authenticate user and return tokens.

**Request**:

```json
{
  "email": "admin@laundry.com",
  "password": "SecurePass123!",
  "tenantId": "tenant-uuid" // Optional: for multi-tenant users
}
```

**Response** (200):

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "v1.MRjeFG...",
  "expiresIn": 3600,
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "admin@laundry.com",
    "displayName": "John Admin",
    "tenantId": "tenant-uuid",
    "role": "admin"
  }
}
```

#### POST /v1/auth/logout

Invalidate current session.

**Headers**: `Authorization: Bearer {token}`

**Response** (200):

```json
{
  "message": "Logout successful"
}
```

#### POST /v1/auth/refresh

Refresh access token using refresh token.

**Request**:

```json
{
  "refreshToken": "v1.MRjeFG..."
}
```

**Response** (200):

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600
}
```

#### POST /v1/auth/forgot-password

Request password reset email.

**Request**:

```json
{
  "email": "admin@laundry.com"
}
```

**Response** (200):

```json
{
  "message": "Password reset email sent if account exists"
}
```

#### POST /v1/auth/reset-password

Reset password with token from email.

**Request**:

```json
{
  "token": "reset-token-from-email",
  "newPassword": "NewSecurePass123!"
}
```

**Response** (200):

```json
{
  "message": "Password reset successful"
}
```

#### GET /v1/auth/me

Get current authenticated user profile.

**Headers**: `Authorization: Bearer {token}`

**Response** (200):

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "admin@laundry.com",
  "displayName": "John Admin",
  "emailVerified": true,
  "tenants": [
    {
      "tenantId": "tenant-uuid-1",
      "tenantName": "Laundry Plus",
      "role": "admin",
      "isActive": true
    },
    {
      "tenantId": "tenant-uuid-2",
      "tenantName": "Clean Express",
      "role": "operator",
      "isActive": true
    }
  ],
  "currentTenant": {
    "tenantId": "tenant-uuid-1",
    "role": "admin"
  }
}
```

#### POST /v1/auth/switch-tenant

Switch active tenant context (for multi-tenant users).

**Headers**: `Authorization: Bearer {token}`

**Request**:

```json
{
  "tenantId": "tenant-uuid-2"
}
```

**Response** (200):

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...", // New token with updated tenant claim
  "tenant": {
    "tenantId": "tenant-uuid-2",
    "tenantName": "Clean Express",
    "role": "operator"
  }
}
```

### User Management Endpoints

#### POST /v1/users (Admin Only)

Create a new user within tenant.

**Headers**: `Authorization: Bearer {token}`

**Request**:

```json
{
  "email": "operator@laundry.com",
  "password": "TempPass123!",
  "displayName": "Jane Operator",
  "role": "operator",
  "sendInviteEmail": true
}
```

**Response** (201):

```json
{
  "id": "user-uuid",
  "email": "operator@laundry.com",
  "displayName": "Jane Operator",
  "role": "operator",
  "tenantId": "tenant-uuid",
  "isActive": true,
  "inviteEmailSent": true
}
```

#### GET /v1/users (Admin Only)

List all users in tenant.

**Headers**: `Authorization: Bearer {token}`

**Query Parameters**:

- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `role`: Filter by role (optional)
- `isActive`: Filter by active status (optional)

**Response** (200):

```json
{
  "users": [
    {
      "id": "user-uuid-1",
      "email": "admin@laundry.com",
      "displayName": "John Admin",
      "role": "admin",
      "isActive": true,
      "lastLoginAt": "2025-10-10T10:30:00Z",
      "createdAt": "2025-10-01T08:00:00Z"
    },
    {
      "id": "user-uuid-2",
      "email": "operator@laundry.com",
      "displayName": "Jane Operator",
      "role": "operator",
      "isActive": true,
      "lastLoginAt": "2025-10-10T09:15:00Z",
      "createdAt": "2025-10-05T12:00:00Z"
    }
  ],
  "pagination": {
    "total": 15,
    "page": 1,
    "limit": 20,
    "totalPages": 1
  }
}
```

#### PATCH /v1/users/:userId (Admin Only)

Update user details or role.

**Headers**: `Authorization: Bearer {token}`

**Request**:

```json
{
  "displayName": "Jane Senior Operator",
  "role": "admin",
  "isActive": true
}
```

**Response** (200):

```json
{
  "id": "user-uuid-2",
  "email": "operator@laundry.com",
  "displayName": "Jane Senior Operator",
  "role": "admin",
  "isActive": true,
  "updatedAt": "2025-10-10T11:00:00Z"
}
```

#### DELETE /v1/users/:userId (Admin Only)

Deactivate user (soft delete).

**Headers**: `Authorization: Bearer {token}`

**Response** (200):

```json
{
  "message": "User deactivated successfully",
  "userId": "user-uuid-2"
}
```

---

## UI/UX Requirements

### Login Screen

- **Fields**: Email, Password
- **Actions**: Login, Forgot Password, Sign Up (if enabled)
- **Validation**: Real-time email format, password strength indicator
- **Error Messages**: Invalid credentials, account locked, email not verified
- **Bilingual**: All labels in EN/AR

### Registration Screen

- **Fields**: Email, Password, Confirm Password, Display Name
- **Validation**: Email uniqueness, password match, password strength
- **Success**: Redirect to email verification notice
- **Bilingual**: All labels in EN/AR

### Forgot Password Screen

- **Fields**: Email
- **Process**: Send reset link → Check email message → Reset password form
- **Expiry**: Reset link valid for 1 hour

### User Management (Admin)

- **List View**: Table with email, name, role, status, last login
- **Actions**: Add User, Edit Role, Deactivate/Activate
- **Filters**: Role, Status
- **Search**: By email or name

### Tenant Switcher (Multi-Tenant Users)

- **Location**: Header dropdown
- **Display**: Current tenant name + role
- **Action**: Click to see list of accessible tenants, select to switch
- **Transition**: Smooth context switch with loading state

---

## Technical Implementation

### Backend Tasks

1. **Supabase Configuration**

   - Set up Supabase project
   - Configure email templates (verification, reset password)
   - Set up JWT secret and expiration
   - Configure SMTP for email delivery

2. **Database Setup**

   - Run migration: `0002_rls_core.sql` (RLS policies)
   - Create `org_users_mst` table
   - Create `sys_audit_log` table
   - Set up helper functions for RLS

3. **NestJS Auth Module**

   - Install dependencies: `@supabase/supabase-js`, `@nestjs/passport`, `passport-jwt`
   - Create `AuthService` with Supabase client
   - Implement JWT strategy with tenant extraction
   - Create auth guards: `JwtAuthGuard`, `RolesGuard`
   - Create decorators: `@CurrentUser()`, `@Roles()`, `@CurrentTenant()`

4. **Auth Controllers**

   - Implement all auth endpoints (login, register, logout, etc.)
   - Add request validation DTOs
   - Add error handling and proper HTTP status codes

5. **RLS Integration**

   - Create middleware to set `request.jwt.claims` in PostgreSQL session
   - Ensure all database queries include tenant context
   - Add RLS verification tests

6. **Audit Logging**
   - Create interceptor to log all auth actions
   - Log login attempts, password changes, role changes
   - Include IP address and user agent

### Frontend Tasks (Next.js Admin)

1. **Auth Context**

   - Create `AuthContext` with React Context API
   - Manage auth state (user, token, tenant)
   - Handle token refresh automatically
   - Persist auth state to localStorage

2. **Auth API Client**

   - Create API service with Axios/Fetch
   - Add interceptor for Authorization header
   - Handle 401 (redirect to login) and token refresh

3. **Auth Screens**

   - Login page with form validation
   - Registration page (if public signup enabled)
   - Forgot/Reset password pages
   - Email verification notice

4. **Protected Routes**

   - Create `PrivateRoute` component
   - Redirect to login if not authenticated
   - Check roles for admin-only routes

5. **User Management UI**

   - User list page with table
   - Add/Edit user modal
   - Role assignment dropdown
   - Activate/Deactivate toggle

6. **Tenant Switcher**
   - Header dropdown component
   - Tenant list with current indicator
   - Switch tenant action with loading state

### Database Migrations

```sql
-- Migration: 0002_rls_core.sql (already exists)
-- Additional migration: 0004_auth_enhancements.sql

-- Add org_users_mst table
CREATE TABLE IF NOT EXISTS org_users_mst (
  -- schema as defined above
);

-- Add audit log
CREATE TABLE IF NOT EXISTS sys_audit_log (
  -- schema as defined above
);

-- RLS policies for new tables
ALTER TABLE org_users_mst ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation_users ON org_users_mst
  USING (tenant_org_id = auth.current_tenant_id());
```

---

## Acceptance Criteria

### Authentication

- [ ] User can register with email/password and receive verification email
- [ ] User can login with valid credentials and receive JWT token
- [ ] User cannot login with invalid credentials (proper error message)
- [ ] User account is locked after 5 failed login attempts
- [ ] User can request password reset and receive email
- [ ] User can reset password using valid reset token
- [ ] User can logout and session is invalidated
- [ ] Access token expires after 1 hour
- [ ] Refresh token can be used to get new access token

### Multi-Tenancy

- [ ] JWT token contains tenant_id in custom claims
- [ ] All queries to org\_\* tables are filtered by tenant_org_id
- [ ] User cannot access data from another tenant
- [ ] User with access to multiple tenants can switch context
- [ ] Switching tenant issues new token with updated tenant_id

### Role-Based Access

- [ ] Admin can create/edit/delete users within their tenant
- [ ] Operator cannot access user management endpoints
- [ ] Viewer has read-only access (enforced by guards)
- [ ] Role changes are logged in audit trail

### Security

- [ ] Passwords are hashed (handled by Supabase)
- [ ] JWT tokens are signed with secret
- [ ] RLS policies prevent cross-tenant data leaks (100% coverage)
- [ ] All auth operations are logged to audit trail
- [ ] Failed login attempts are logged with IP address

### Performance

- [ ] Login response time < 500ms (p95)
- [ ] Token refresh < 200ms (p95)
- [ ] RLS policy overhead < 50ms per query

---

## Testing Requirements

### Unit Tests

1. **AuthService Tests**

   - Login with valid/invalid credentials
   - Register with duplicate email (should fail)
   - Password reset flow
   - Token refresh logic
   - Multi-tenant user association

2. **RLS Helper Functions**

   - `auth.current_tenant_id()` returns correct tenant from JWT
   - `auth.is_admin()` checks role correctly

3. **Guards & Decorators**
   - `JwtAuthGuard` validates token
   - `RolesGuard` checks user role
   - `@CurrentUser()` decorator extracts user from request

### Integration Tests

1. **Auth Endpoints**

   - POST /v1/auth/register → creates user in auth.users and org_users_mst
   - POST /v1/auth/login → returns valid JWT token
   - POST /v1/auth/refresh → returns new access token
   - GET /v1/auth/me → returns current user with tenants
   - POST /v1/auth/switch-tenant → updates tenant context in token

2. **User Management (Admin)**

   - POST /v1/users → creates user (admin only)
   - GET /v1/users → lists users filtered by tenant
   - PATCH /v1/users/:id → updates user role
   - DELETE /v1/users/:id → soft deletes user

3. **RLS Verification**
   - Create 2 tenants with separate users
   - User A cannot query User B's data (even with direct SQL)
   - Admin can only see users in their tenant
   - Switching tenant changes accessible data

### E2E Tests (Playwright)

1. **User Journey: Registration → Login**

   - Fill registration form → Submit → See verification notice
   - (Skip email verification for test) → Login → See dashboard

2. **User Journey: Multi-Tenant Switch**

   - Login as user with 2 tenants → See tenant switcher
   - Switch to Tenant B → Verify data changes → Switch back to Tenant A

3. **User Journey: Admin User Management**
   - Login as admin → Navigate to Users
   - Add new operator → See in list
   - Edit role to admin → Verify role change
   - Deactivate user → Verify status change

### Security Tests

1. **RLS Policy Tests**

   ```sql
   -- Set up: Create 2 tenants
   SET request.jwt.claims = '{"tenant_id": "tenant-1-uuid", "role": "admin"}';
   SELECT * FROM org_orders_mst; -- Should only return tenant-1 orders

   SET request.jwt.claims = '{"tenant_id": "tenant-2-uuid", "role": "admin"}';
   SELECT * FROM org_orders_mst; -- Should only return tenant-2 orders
   ```

2. **Token Validation Tests**
   - Expired token → 401 Unauthorized
   - Invalid signature → 401 Unauthorized
   - Missing tenant claim → 400 Bad Request
   - Tampered payload → 401 Unauthorized

---

## Deployment Notes

### Environment Variables

```bash
# .env.local (Development)
SUPABASE_URL=https://xyz.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
JWT_SECRET=your-jwt-secret-key
JWT_EXPIRATION=3600
REFRESH_TOKEN_EXPIRATION=604800

# .env.production
SUPABASE_URL=${SUPABASE_URL_PROD}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY_PROD}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY_PROD}
JWT_SECRET=${JWT_SECRET_PROD}
```

### Database Migrations

```bash
# Apply RLS policies
psql -U cmx_user -d cmx_db -f supabase/migrations/0002_rls_core.sql

# Apply auth enhancements
psql -U cmx_user -d cmx_db -f supabase/migrations/0004_auth_enhancements.sql

# Verify RLS policies
psql -U cmx_user -d cmx_db -c "SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';"
```

### Deployment Steps

1. Deploy database migrations to staging
2. Test RLS policies with integration tests
3. Deploy backend API to staging
4. Deploy frontend to staging
5. Run E2E tests in staging
6. Review audit logs
7. Deploy to production (database first, then backend, then frontend)
8. Monitor error rates and auth metrics

### Rollback Plan

1. If RLS policies cause issues: `ALTER TABLE <table> DISABLE ROW LEVEL SECURITY;` (temporary)
2. If migrations fail: Run rollback migration
3. If auth service fails: Revert to previous deployment version
4. Emergency: Disable auth requirement (allow public access temporarily with admin override)

---

## References

### Requirements Document

- Section 3.5: Admin / Config (RBAC)
- Section 4: NFR-SEC-001 (Security - RLS, RBAC)
- Section 12: Security, Privacy & Compliance

### Technical Documentation

- Supabase Auth Docs: https://supabase.com/docs/guides/auth
- PostgreSQL RLS: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- NestJS Auth: https://docs.nestjs.com/security/authentication

### Related PRDs

- PRD-002: Tenant Management (depends on auth)
- PRD-003: Customer Management (uses auth context)
- All subsequent PRDs (depend on auth foundation)

---

## Notes

### Multi-Tenant User Support

A single user can belong to multiple tenants (e.g., a consultant managing several laundries). The JWT token stores the currently active `tenant_id`, and users can switch context via the `/auth/switch-tenant` endpoint, which issues a new token with the updated tenant claim.

### RLS Performance Considerations

- RLS policies add overhead to every query (~10-50ms depending on complexity)
- Ensure indexes on `tenant_org_id` columns
- Use `auth.current_tenant_id()` function (cached per transaction)
- Consider connection pooling to reduce session variable overhead

### Audit Trail

All authentication actions (login, logout, password changes) and authorization changes (role assignments) are logged to `sys_audit_log` for compliance and debugging. Logs include IP address, user agent, and before/after values for changes.

---

**Status**: Ready for Implementation
**Assigned To**: Backend Team + Frontend Team
**Estimated Effort**: 80 hours (10 days with 2 developers)
