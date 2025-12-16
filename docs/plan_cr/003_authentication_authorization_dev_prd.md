# Authentication & Authorization - Development Plan & PRD

**Document ID**: 003_authentication_authorization_dev_prd  
**Version**: 1.0  
**Status**: Ready for Implementation  
**Owner**: Backend Team  
**Dependencies**: 001_infrastructure_setup_dev_prd, 002_database_core_dev_prd  
**Related Requirements**: NFR-SEC-001

---

## 1. Overview & Context

### Purpose

Implement secure authentication and role-based authorization using Supabase Auth with JWT tokens, supporting multiple user roles across platform and tenant levels.

### Business Value

- Secure access control across all applications
- Granular permissions based on user roles
- Seamless single sign-on experience
- Audit trail of authentication events
- Compliance with security best practices

### User Personas Affected

- Super Admin (Platform level)
- Tenant Admin
- Branch Manager
- Operator (Counter staff)
- Assembly Staff
- QA Staff
- Driver
- Customer

### Key Use Cases

- UC-AUTH-001: User registers and verifies email
- UC-AUTH-002: User logs in with credentials
- UC-AUTH-003: User resets forgotten password
- UC-AUTH-004: System validates user permissions
- UC-AUTH-005: User session expires and refreshes

---

## 2. Functional Requirements

### FR-AUTH-001: User Registration

**Description**: Enable user registration with email verification

**Acceptance Criteria**:

- User can register with email and password
- Email verification required before access
- Password strength requirements enforced (min 8 chars, uppercase, number, special char)
- User assigned to tenant during registration
- Default role assigned based on invitation
- Welcome email sent upon verification

### FR-AUTH-002: User Login

**Description**: Secure login with credentials

**Acceptance Criteria**:

- Email and password authentication
- JWT access token issued (1 hour expiry)
- JWT refresh token issued (30 days expiry)
- Failed login attempts tracked
- Account locked after 5 failed attempts
- Login history recorded

### FR-AUTH-003: Password Management

**Description**: Allow users to reset and change passwords

**Acceptance Criteria**:

- Forgot password flow with email link
- Reset link expires after 1 hour
- Password change requires current password
- Password history prevents reuse of last 5 passwords
- Audit log of password changes

### FR-AUTH-004: Role-Based Access Control (RBAC)

**Description**: Implement role-based permissions

**Roles**:

1. **super_admin**: Platform-level admin (manages all tenants)
2. **tenant_admin**: Tenant owner/administrator
3. **branch_manager**: Manages specific branch
4. **operator**: Counter staff (intake, preparation)
5. **assembly**: Assembly staff
6. **qa**: Quality assurance staff
7. **driver**: Delivery driver
8. **customer**: End customer

**Acceptance Criteria**:

- Roles stored in user metadata
- JWT claims include user_id, tenant_id, role
- Permission checks on every API request
- Role hierarchy respected
- Audit log of permission denials

### FR-AUTH-005: Multi-Factor Authentication (MFA)

**Description**: Optional MFA for sensitive roles

**Acceptance Criteria**:

- TOTP-based MFA available
- QR code for authenticator app setup
- Backup codes generated (10 codes)
- MFA required for super_admin and tenant_admin
- MFA optional for other roles
- Remember device option (30 days)

### FR-AUTH-006: Session Management

**Description**: Manage user sessions securely

**Acceptance Criteria**:

- Access token expires after 1 hour
- Refresh token rotates on use
- User can view active sessions
- User can revoke sessions
- Automatic logout on suspicious activity

### FR-AUTH-007: API Key Authentication

**Description**: Support API key auth for integrations

**Acceptance Criteria**:

- Tenants can generate API keys
- Keys scoped to specific permissions
- Keys can be revoked
- Usage tracked and rate limited
- Keys expire after inactivity (90 days)

---

## 3. Technical Design

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  Client Applications                                     │
│  (Web Admin, Mobile Apps)                               │
└───────────────────┬─────────────────────────────────────┘
                    │ Login/Register
                    │ Email/Password
┌───────────────────▼─────────────────────────────────────┐
│  Supabase Auth                                          │
│  - User Registration                                    │
│  - Email Verification                                   │
│  - Password Reset                                       │
│  - JWT Generation                                       │
│  - Session Management                                   │
└───────────────────┬─────────────────────────────────────┘
                    │ Returns JWT
                    │ {user_id, tenant_id, role, email}
┌───────────────────▼─────────────────────────────────────┐
│  Client stores JWT                                      │
│  - Access Token (1h expiry)                            │
│  - Refresh Token (30d expiry)                          │
└───────────────────┬─────────────────────────────────────┘
                    │ API Requests
                    │ Authorization: Bearer <token>
┌───────────────────▼─────────────────────────────────────┐
│  API Gateway / Middleware                               │
│  - Validate JWT signature                              │
│  - Check token expiry                                  │
│  - Extract claims (tenant_id, role)                    │
│  - Verify permissions                                  │
└───────────────────┬─────────────────────────────────────┘
                    │ Authorized Request
┌───────────────────▼─────────────────────────────────────┐
│  Application Logic                                      │
│  - RLS enforces tenant_org_id = JWT.tenant_id         │
│  - Role checked for specific actions                   │
└─────────────────────────────────────────────────────────┘
```

### JWT Token Structure

**Access Token Payload**:

```json
{
  "sub": "auth-user-uuid",
  "email": "user@example.com",
  "tenant_id": "tenant-uuid",
  "role": "operator",
  "branch_id": "branch-uuid",
  "aud": "authenticated",
  "exp": 1633036800,
  "iat": 1633033200
}
```

### Database Schema

**Supabase auth.users** (managed by Supabase):

```sql
-- Built-in table, we don't create this
-- Contains: id, email, encrypted_password, email_confirmed_at, etc.
```

**org_users_mst** (from 002):

```sql
CREATE TABLE IF NOT EXISTS org_users_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  auth_user_id UUID NOT NULL, -- Links to auth.users.id
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) NOT NULL,
  branch_id UUID,
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMP,
  last_login_ip VARCHAR(45),
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  mfa_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  FOREIGN KEY (branch_id, tenant_org_id) REFERENCES org_branches_mst(id, tenant_org_id),
  UNIQUE(tenant_org_id, email),
  UNIQUE(auth_user_id)
);
```

**org_user_sessions_log**:

```sql
CREATE TABLE IF NOT EXISTS org_user_sessions_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_org_id UUID NOT NULL,
  session_id VARCHAR(255) NOT NULL,
  login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  logout_at TIMESTAMP,
  ip_address VARCHAR(45),
  user_agent TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES org_users_mst(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE
);

CREATE INDEX idx_sessions_user ON org_user_sessions_log(user_id);
CREATE INDEX idx_sessions_active ON org_user_sessions_log(is_active) WHERE is_active = TRUE;
```

**org_audit_log**:

```sql
CREATE TABLE IF NOT EXISTS org_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  user_id UUID,
  action VARCHAR(100) NOT NULL, -- login, logout, permission_denied, etc.
  resource_type VARCHAR(50),
  resource_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE
);

CREATE INDEX idx_audit_tenant_action ON org_audit_log(tenant_org_id, action);
CREATE INDEX idx_audit_user ON org_audit_log(user_id);
CREATE INDEX idx_audit_created ON org_audit_log(created_at DESC);
```

### Role Permissions Matrix

| Role           | Orders        | Customers    | Catalog     | Users       | Reports     | Settings |
| -------------- | ------------- | ------------ | ----------- | ----------- | ----------- | -------- |
| super_admin    | All tenants   | All tenants  | All tenants | All tenants | All tenants | Platform |
| tenant_admin   | All           | All          | All         | Manage      | All         | Tenant   |
| branch_manager | Branch only   | Branch only  | View        | View        | Branch      | None     |
| operator       | Create, View  | Create, View | View        | None        | None        | None     |
| assembly       | View assigned | None         | None        | None        | None        | None     |
| qa             | View assigned | None         | None        | None        | None        | None     |
| driver         | View assigned | None         | None        | None        | None        | None     |
| customer       | Own orders    | Own profile  | View        | None        | None        | None     |

### Permission Check Implementation

**Supabase Edge Function** (or Middleware):

```typescript
export const checkPermission = (
  role: string,
  action: string,
  resource: string
): boolean => {
  const permissions: Record<string, Record<string, string[]>> = {
    super_admin: {
      orders: ["create", "read", "update", "delete"],
      customers: ["create", "read", "update", "delete"],
      catalog: ["create", "read", "update", "delete"],
      users: ["create", "read", "update", "delete"],
      settings: ["read", "update"],
    },
    tenant_admin: {
      orders: ["create", "read", "update", "delete"],
      customers: ["create", "read", "update", "delete"],
      catalog: ["create", "read", "update", "delete"],
      users: ["create", "read", "update", "delete"],
      settings: ["read", "update"],
    },
    branch_manager: {
      orders: ["create", "read", "update"],
      customers: ["create", "read", "update"],
      catalog: ["read"],
      users: ["read"],
      settings: ["read"],
    },
    operator: {
      orders: ["create", "read", "update"],
      customers: ["create", "read"],
      catalog: ["read"],
    },
    assembly: {
      orders: ["read", "update"],
    },
    qa: {
      orders: ["read", "update"],
    },
    driver: {
      orders: ["read", "update"],
    },
    customer: {
      orders: ["read"],
      profile: ["read", "update"],
    },
  };

  return permissions[role]?.[resource]?.includes(action) ?? false;
};
```

---

## 4. Implementation Plan

### Phase 1: Supabase Auth Setup (2 days)

**Tasks**:

1. Configure Supabase Auth settings
2. Set up email templates (verification, password reset)
3. Configure JWT secret and expiry
4. Set up auth redirects
5. Test email delivery with Inbucket (local)

**Deliverables**:

- `supabase/config.toml` (auth section)
- Email templates in Supabase
- Documentation for auth flow

### Phase 2: User Registration & Login (2 days)

**Tasks**:

1. Implement registration API/form
2. Implement login API/form
3. Create user record in org_users_mst on signup
4. Link auth.users to org_users_mst
5. Implement JWT token handling in client
6. Test complete auth flow

**Deliverables**:

- Registration component/API
- Login component/API
- Token storage utilities
- Integration tests

### Phase 3: RBAC Implementation (3 days)

**Tasks**:

1. Create role enum and types
2. Implement permission checking middleware
3. Add role to JWT claims
4. Create RLS policies for role-based access
5. Implement permission guards
6. Test all role combinations

**Deliverables**:

- `packages/types/src/auth.ts` (role types)
- Permission middleware
- RLS policies with role checks
- Permission testing suite

### Phase 4: Session & Audit Logging (2 days)

**Tasks**:

1. Create session logging tables
2. Log all login/logout events
3. Track failed login attempts
4. Implement account locking
5. Create audit log for sensitive actions
6. Add session management UI

**Deliverables**:

- Migration for session and audit tables
- Session logging service
- Audit logging middleware
- Session management UI

### Phase 5: Password Management (1 day)

**Tasks**:

1. Implement forgot password flow
2. Implement password change
3. Add password strength validation
4. Test email delivery
5. Document password policies

**Deliverables**:

- Password reset components
- Password change component
- Password validation utilities

### Phase 6: MFA Setup (Optional - 2 days)

**Tasks**:

1. Implement TOTP generation
2. Create QR code display
3. Implement MFA verification
4. Generate backup codes
5. Add remember device option
6. Test MFA flow

**Deliverables**:

- MFA setup UI
- MFA verification middleware
- Backup code management

---

## 5. API Specifications

### POST /auth/register

```typescript
Request:
{
  email: string,
  password: string,
  first_name: string,
  last_name: string,
  tenant_slug?: string, // For tenant admin signup
  invitation_token?: string // For employee signup
}

Response:
{
  user: {
    id: string,
    email: string,
    email_confirmed_at: null
  },
  message: "Verification email sent"
}
```

### POST /auth/login

```typescript
Request:
{
  email: string,
  password: string
}

Response:
{
  access_token: string,
  refresh_token: string,
  user: {
    id: string,
    email: string,
    role: string,
    tenant_id: string
  },
  expires_in: 3600
}
```

### POST /auth/logout

```typescript
Request: JWT in header;

Response: {
  message: "Logged out successfully";
}
```

### POST /auth/refresh

```typescript
Request:
{
  refresh_token: string
}

Response:
{
  access_token: string,
  refresh_token: string,
  expires_in: 3600
}
```

### POST /auth/forgot-password

```typescript
Request: {
  email: string;
}

Response: {
  message: "Password reset email sent";
}
```

### POST /auth/reset-password

```typescript
Request:
{
  token: string,
  new_password: string
}

Response:
{
  message: "Password reset successfully"
}
```

---

## 6. Testing Strategy

### Unit Tests

**Permission Checks**:

```typescript
describe("Permission System", () => {
  test("tenant_admin can create orders", () => {
    expect(checkPermission("tenant_admin", "create", "orders")).toBe(true);
  });

  test("operator cannot delete customers", () => {
    expect(checkPermission("operator", "delete", "customers")).toBe(false);
  });

  test("driver can only read assigned orders", () => {
    expect(checkPermission("driver", "read", "orders")).toBe(true);
    expect(checkPermission("driver", "update", "orders")).toBe(true);
    expect(checkPermission("driver", "delete", "orders")).toBe(false);
  });
});
```

### Integration Tests

**Auth Flow**:

```typescript
describe("Authentication Flow", () => {
  test("user can register and verify email", async () => {
    const { data } = await supabase.auth.signUp({
      email: "test@example.com",
      password: "SecureP@ss123",
    });
    expect(data.user).toBeDefined();
    expect(data.user.email_confirmed_at).toBeNull();
  });

  test("user cannot login without verification", async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email: "unverified@example.com",
      password: "password",
    });
    expect(error).toBeDefined();
  });

  test("user can login after verification", async () => {
    // Verify email (manual step or test helper)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: "verified@example.com",
      password: "SecureP@ss123",
    });
    expect(error).toBeNull();
    expect(data.session).toBeDefined();
  });
});
```

### Security Tests

**JWT Validation**:

```typescript
describe("JWT Security", () => {
  test("expired token is rejected", async () => {
    const expiredToken = generateExpiredToken();
    const response = await fetch("/api/orders", {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    expect(response.status).toBe(401);
  });

  test("tampered token is rejected", async () => {
    const tamperedToken = validToken + "tampered";
    const response = await fetch("/api/orders", {
      headers: { Authorization: `Bearer ${tamperedToken}` },
    });
    expect(response.status).toBe(401);
  });

  test("token from wrong tenant cannot access data", async () => {
    const tenant1Token = generateToken({ tenant_id: "tenant1" });
    const response = await fetch("/api/orders?tenant_id=tenant2", {
      headers: { Authorization: `Bearer ${tenant1Token}` },
    });
    expect(response.status).toBe(403);
  });
});
```

---

## 7. Success Metrics

| Metric                     | Target        | Measurement                 |
| -------------------------- | ------------- | --------------------------- |
| Login Success Rate         | ≥ 99%         | Auth logs                   |
| JWT Validation Time        | < 10ms        | Middleware timing           |
| Account Lockout Rate       | < 1% of users | Security logs               |
| Session Hijacking Attempts | 0             | Security monitoring         |
| MFA Adoption (admins)      | 100%          | User settings               |
| Password Reset Success     | ≥ 95%         | Email delivery + completion |

---

## 8. Risks & Mitigations

| Risk                    | Impact   | Mitigation                                   |
| ----------------------- | -------- | -------------------------------------------- |
| JWT secret compromise   | Critical | Rotate secrets regularly, use strong secrets |
| Brute force attacks     | High     | Rate limiting, account lockout, CAPTCHA      |
| Session hijacking       | High     | Secure cookies, HTTPOnly, SameSite           |
| Email delivery failures | Medium   | Monitor email delivery, provide alt contact  |
| Supabase Auth downtime  | High     | Implement fallback auth, monitor status      |

---

## 9. Future Enhancements

### Phase 2

- OAuth providers (Google, Apple, Facebook)
- SMS-based OTP login
- Biometric authentication (mobile)
- SSO for enterprise tenants
- Advanced audit logging with search

### Phase 3

- Passwordless authentication (magic links)
- Hardware security keys (WebAuthn)
- Anomaly detection for suspicious logins
- Geo-blocking and IP allowlists

---

## 10. Acceptance Checklist

- [ ] Users can register with email verification
- [ ] Users can login with credentials
- [ ] JWT tokens generated correctly
- [ ] Role-based permissions working
- [ ] RLS policies enforce tenant isolation
- [ ] Password reset flow functional
- [ ] Failed login attempts tracked
- [ ] Account lockout after 5 failures
- [ ] Sessions logged to database
- [ ] Audit log captures key events
- [ ] MFA available for admin roles
- [ ] Permission checks on all endpoints
- [ ] Security tests passing
- [ ] Documentation complete

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-09  
**Next Review**: After Phase 3 implementation
