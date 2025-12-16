---
prd_code: PRD-SAAS-MNG-0009
title: Authentication & Authorization System
version: v0.1.0
last_updated: 2025-01-14
status: Draft
priority: Critical
category: Platform Management
related_prds:
  - PRD-SAAS-MNG-0001 (Platform HQ Console)
  - PRD-SAAS-MNG-0002 (Tenant Lifecycle)
  - PRD-SAAS-MNG-0008 (Customer Master Data)
author: CleanMateX Platform Team
---

# PRD-SAAS-MNG-0009: Authentication & Authorization System

## Executive Summary

### Problem Statement

A multi-tenant SaaS platform requires sophisticated authentication and authorization mechanisms to ensure:

1. **Identity Management**: Secure user authentication across platform operators and tenant users
2. **Multi-Tenant Security**: Strict isolation between tenants with zero cross-tenant data leakage
3. **Role-Based Access Control (RBAC)**: Granular permissions based on user roles and contexts
4. **Session Management**: Secure, scalable session handling with JWT tokens
5. **SSO Integration**: Support for enterprise SSO providers (SAML, OAuth 2.0, OIDC)
6. **Audit Trail**: Complete logging of all authentication and authorization events
7. **Security Compliance**: Meet SOC 2, ISO 27001, and GDPR requirements

### Solution Overview

The Authentication & Authorization System provides:

- **Dual-Layer Authentication**: Separate auth for platform operators (Platform HQ) and tenant users
- **Supabase Auth Integration**: Leveraging Supabase's built-in auth with custom extensions
- **JWT-Based Sessions**: Secure, stateless authentication with refresh tokens
- **Role-Based Access Control**: Hierarchical roles with granular permissions
- **Row-Level Security (RLS)**: Database-level tenant isolation
- **Multi-Factor Authentication (MFA)**: Time-based OTP and SMS verification
- **SSO Support**: Enterprise SSO via SAML 2.0 and OIDC
- **API Key Management**: Service account authentication for integrations
- **Comprehensive Audit Log**: All auth events tracked and stored

### Business Value

**For Platform Operators:**
- Secure access to all tenant data (with proper authorization)
- Centralized user management
- Security compliance and audit trails
- Granular access control to sensitive operations

**For Tenants:**
- Secure authentication for staff members
- Role-based permissions within their organization
- SSO integration for enterprise customers
- Self-service user management

**For End Users:**
- Secure, seamless authentication
- Multi-device session management
- Privacy controls and transparency
- Optional MFA for enhanced security

---

## Table of Contents

1. [Scope & Objectives](#scope--objectives)
2. [Authentication Architecture](#authentication-architecture)
3. [Database Schema](#database-schema)
4. [User Management](#user-management)
5. [Role-Based Access Control (RBAC)](#role-based-access-control-rbac)
6. [JWT Token Structure](#jwt-token-structure)
7. [Row-Level Security (RLS)](#row-level-security-rls)
8. [Multi-Factor Authentication](#multi-factor-authentication)
9. [SSO Integration](#sso-integration)
10. [API Key Management](#api-key-management)
11. [Session Management](#session-management)
12. [Password Policies](#password-policies)
13. [Audit & Logging](#audit--logging)
14. [Security Best Practices](#security-best-practices)
15. [API Specifications](#api-specifications)
16. [UI/UX Design](#uiux-design)
17. [Integration Points](#integration-points)
18. [Testing Strategy](#testing-strategy)
19. [Implementation Plan](#implementation-plan)
20. [Compliance & Security](#compliance--security)
21. [Future Enhancements](#future-enhancements)
22. [Appendices](#appendices)

---

## Scope & Objectives

### In Scope

**Authentication:**
- Email/password authentication
- Phone/OTP authentication
- Social login (Google, Apple)
- SSO integration (SAML, OAuth 2.0, OIDC)
- Multi-factor authentication (TOTP, SMS)
- Password reset and recovery
- Session management and refresh tokens

**Authorization:**
- Role-based access control (RBAC)
- Permission management
- Resource-level permissions
- Tenant context enforcement
- API authorization
- Row-level security (RLS)

**User Management:**
- Platform operator accounts
- Tenant admin accounts
- Tenant staff accounts
- User invitation and onboarding
- User deactivation and removal
- User profile management

**Security:**
- JWT token management
- API key generation and rotation
- Security audit logs
- Login attempt monitoring
- Brute-force protection
- CORS and CSRF protection

### Out of Scope

- Biometric authentication (future)
- Hardware security keys (future)
- Advanced threat detection (future)
- Identity federation (future)
- Customer-facing authentication (separate PRD)

### Success Criteria

1. **Security**: Zero successful unauthorized access attempts
2. **Performance**: Authentication < 200ms, Authorization < 50ms
3. **Availability**: 99.99% uptime for auth services
4. **Compliance**: Pass SOC 2 Type II audit
5. **Audit**: 100% of auth events logged
6. **MFA Adoption**: 80%+ of platform operators using MFA

---

## Authentication Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Client Applications                     │
│  (Platform HQ Console, Tenant Dashboard, Mobile Apps)       │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                   Authentication Layer                       │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Supabase Auth (Core)                        │   │
│  │  - Email/Password                                    │   │
│  │  - Magic Links                                       │   │
│  │  - OAuth Providers                                   │   │
│  │  - JWT Generation                                    │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Custom Auth Extensions                       │   │
│  │  - Multi-Factor Auth (MFA)                          │   │
│  │  - SSO Integration                                   │   │
│  │  - API Key Management                                │   │
│  │  - Tenant Context Injection                          │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                  Authorization Layer                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Role-Based Access Control (RBAC)            │   │
│  │  - Role Assignment                                   │   │
│  │  - Permission Checking                               │   │
│  │  - Resource Authorization                            │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │         Row-Level Security (RLS)                    │   │
│  │  - Tenant Isolation                                  │   │
│  │  - Database-Level Policies                          │   │
│  │  - Automatic Filtering                               │   │
│  └─────────────────────────────────────────────────────┘   │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│                PostgreSQL + RLS Policies                     │
└─────────────────────────────────────────────────────────────┘
```

### Authentication Flow

```
┌─────────┐                                    ┌─────────────┐
│ Client  │                                    │  Supabase   │
│  App    │                                    │    Auth     │
└────┬────┘                                    └──────┬──────┘
     │                                                 │
     │  1. Login Request (email, password)            │
     ├────────────────────────────────────────────────>│
     │                                                 │
     │                                       2. Verify Credentials
     │                                                 │
     │                                       3. Check MFA Required
     │                                                 │
     │  4. MFA Challenge (if enabled)                 │
     │<────────────────────────────────────────────────┤
     │                                                 │
     │  5. MFA Code                                    │
     ├────────────────────────────────────────────────>│
     │                                                 │
     │                                       6. Verify MFA Code
     │                                                 │
     │                                       7. Get User Roles
     │                                                 │
     │                                       8. Generate JWT
     │                                                 │
     │  9. Auth Response (access + refresh tokens)    │
     │<────────────────────────────────────────────────┤
     │                                                 │
     │  10. Store Tokens                               │
     │                                                 │
     │  11. API Request (with JWT)                     │
     ├────────────────────────────────────────────────>│
     │                                                 │
     │                                       12. Verify JWT
     │                                                 │
     │                                       13. Check Permissions
     │                                                 │
     │  14. API Response                               │
     │<────────────────────────────────────────────────┤
     │                                                 │
```

---

## Database Schema

### System Tables (Global)

#### `sys_auth_users_mst` - Platform Users

```sql
CREATE TABLE sys_auth_users_mst (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Supabase auth user ID
  auth_user_id UUID UNIQUE NOT NULL, -- Links to auth.users

  -- User identity
  email VARCHAR(250) UNIQUE NOT NULL,
  phone VARCHAR(20) UNIQUE,

  -- User type
  user_type VARCHAR(20) NOT NULL, -- platform_operator, tenant_admin, tenant_user

  -- Profile
  first_name VARCHAR(250),
  last_name VARCHAR(250),
  full_name VARCHAR(500) GENERATED ALWAYS AS (first_name || ' ' || COALESCE(last_name, '')) STORED,
  avatar_url TEXT,

  -- Status
  user_status VARCHAR(20) DEFAULT 'active', -- active, suspended, locked, deactivated
  email_verified BOOLEAN DEFAULT false,
  phone_verified BOOLEAN DEFAULT false,

  -- MFA
  mfa_enabled BOOLEAN DEFAULT false,
  mfa_method VARCHAR(20), -- totp, sms, email
  mfa_secret VARCHAR(250), -- Encrypted TOTP secret

  -- Security
  failed_login_attempts INTEGER DEFAULT 0,
  last_failed_login_at TIMESTAMP,
  locked_until TIMESTAMP,
  password_changed_at TIMESTAMP,
  password_expires_at TIMESTAMP,

  -- Session tracking
  last_login_at TIMESTAMP,
  last_login_ip INET,
  last_activity_at TIMESTAMP,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  deactivated_at TIMESTAMP,
  deactivated_by VARCHAR(120),
  is_active BOOLEAN DEFAULT true,

  -- Constraints
  CONSTRAINT valid_user_type CHECK (user_type IN ('platform_operator', 'tenant_admin', 'tenant_user'))
);

-- Indexes
CREATE INDEX idx_sys_users_auth_user_id ON sys_auth_users_mst(auth_user_id);
CREATE INDEX idx_sys_users_email ON sys_auth_users_mst(email);
CREATE INDEX idx_sys_users_phone ON sys_auth_users_mst(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_sys_users_type ON sys_auth_users_mst(user_type);
CREATE INDEX idx_sys_users_status ON sys_auth_users_mst(user_status);
CREATE INDEX idx_sys_users_last_login ON sys_auth_users_mst(last_login_at DESC);

-- Full-text search
CREATE INDEX idx_sys_users_search ON sys_auth_users_mst
  USING gin(to_tsvector('english', full_name || ' ' || email));

-- Comments
COMMENT ON TABLE sys_auth_users_mst IS 'Global user registry for platform operators and tenant users';
COMMENT ON COLUMN sys_auth_users_mst.auth_user_id IS 'Links to Supabase auth.users table';
```

#### `sys_auth_roles_cd` - Role Definitions

```sql
CREATE TABLE sys_auth_roles_cd (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Role identity
  role_code VARCHAR(50) UNIQUE NOT NULL, -- PLATFORM_ADMIN, TENANT_ADMIN, STAFF, etc.
  role_name VARCHAR(250) NOT NULL,
  role_name2 VARCHAR(250), -- Arabic
  role_description TEXT,

  -- Role scope
  role_scope VARCHAR(20) NOT NULL, -- platform, tenant

  -- Hierarchy
  parent_role_id UUID REFERENCES sys_auth_roles_cd(id),
  role_level INTEGER DEFAULT 0, -- 0=highest, 1=mid, 2=low

  -- Metadata
  is_system_role BOOLEAN DEFAULT true, -- Cannot be deleted
  can_assign_to_users BOOLEAN DEFAULT true,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,

  CONSTRAINT valid_role_scope CHECK (role_scope IN ('platform', 'tenant'))
);

-- Indexes
CREATE INDEX idx_roles_code ON sys_auth_roles_cd(role_code);
CREATE INDEX idx_roles_scope ON sys_auth_roles_cd(role_scope);
CREATE INDEX idx_roles_level ON sys_auth_roles_cd(role_level);

-- Seed default roles
INSERT INTO sys_auth_roles_cd (role_code, role_name, role_scope, role_level, is_system_role) VALUES
('PLATFORM_SUPER_ADMIN', 'Platform Super Admin', 'platform', 0, true),
('PLATFORM_ADMIN', 'Platform Admin', 'platform', 1, true),
('PLATFORM_SUPPORT', 'Platform Support', 'platform', 2, true),
('TENANT_OWNER', 'Tenant Owner', 'tenant', 0, true),
('TENANT_ADMIN', 'Tenant Admin', 'tenant', 1, true),
('TENANT_MANAGER', 'Tenant Manager', 'tenant', 2, true),
('TENANT_STAFF', 'Tenant Staff', 'tenant', 3, true),
('TENANT_VIEWER', 'Tenant Viewer', 'tenant', 4, true);
```

#### `sys_auth_permissions_cd` - Permission Definitions

```sql
CREATE TABLE sys_auth_permissions_cd (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Permission identity
  permission_code VARCHAR(100) UNIQUE NOT NULL, -- tenants.create, orders.view, etc.
  permission_name VARCHAR(250) NOT NULL,
  permission_description TEXT,

  -- Permission categorization
  resource VARCHAR(50) NOT NULL, -- tenants, orders, customers, etc.
  action VARCHAR(50) NOT NULL, -- create, read, update, delete, manage

  -- Permission scope
  scope VARCHAR(20) NOT NULL, -- platform, tenant

  -- Metadata
  is_system_permission BOOLEAN DEFAULT true,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,

  CONSTRAINT valid_scope CHECK (scope IN ('platform', 'tenant'))
);

-- Indexes
CREATE INDEX idx_permissions_code ON sys_auth_permissions_cd(permission_code);
CREATE INDEX idx_permissions_resource ON sys_auth_permissions_cd(resource);
CREATE INDEX idx_permissions_scope ON sys_auth_permissions_cd(scope);

-- Comments
COMMENT ON TABLE sys_auth_permissions_cd IS 'Defines all available permissions in the system';
COMMENT ON COLUMN sys_auth_permissions_cd.permission_code IS 'Format: resource.action (e.g., orders.create)';
```

#### `sys_auth_role_permissions` - Role-Permission Mapping

```sql
CREATE TABLE sys_auth_role_permissions (
  role_id UUID NOT NULL REFERENCES sys_auth_roles_cd(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES sys_auth_permissions_cd(id) ON DELETE CASCADE,

  -- Audit
  granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  granted_by VARCHAR(120),

  PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role ON sys_auth_role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON sys_auth_role_permissions(permission_id);
```

### Organization Tables (Tenant-Specific)

#### `org_auth_users_mst` - Tenant User Assignments

```sql
CREATE TABLE org_auth_users_mst (
  -- Composite primary key
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES sys_auth_users_mst(id) ON DELETE CASCADE,

  -- Role assignment
  role_id UUID NOT NULL REFERENCES sys_auth_roles_cd(id),

  -- Employment details
  employee_number VARCHAR(50),
  job_title VARCHAR(250),
  department VARCHAR(250),
  branch_id UUID REFERENCES org_branches_mst(id),

  -- Status
  user_status VARCHAR(20) DEFAULT 'active', -- active, suspended, deactivated

  -- Invitation
  invited_by UUID REFERENCES sys_auth_users_mst(id),
  invited_at TIMESTAMP,
  invitation_accepted_at TIMESTAMP,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  is_active BOOLEAN DEFAULT true,

  PRIMARY KEY (tenant_org_id, user_id)
);

-- Indexes
CREATE INDEX idx_org_users_tenant ON org_auth_users_mst(tenant_org_id);
CREATE INDEX idx_org_users_user_id ON org_auth_users_mst(user_id);
CREATE INDEX idx_org_users_role ON org_auth_users_mst(tenant_org_id, role_id);
CREATE INDEX idx_org_users_status ON org_auth_users_mst(tenant_org_id, user_status);

-- RLS
ALTER TABLE org_auth_users_mst ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON org_auth_users_mst
  FOR ALL
  USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));
```

#### `org_auth_api_keys` - API Keys for Integration

```sql
CREATE TABLE org_auth_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,

  -- API Key details
  key_name VARCHAR(250) NOT NULL,
  key_hash VARCHAR(128) NOT NULL, -- SHA-256 hash of the key
  key_prefix VARCHAR(10) NOT NULL, -- First 8 chars for identification

  -- Scope
  scopes TEXT[], -- Array of permission codes

  -- Status
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,

  -- Security
  ip_whitelist INET[], -- Array of allowed IPs
  rate_limit_per_hour INTEGER DEFAULT 1000,

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES sys_auth_users_mst(id),
  revoked_at TIMESTAMP,
  revoked_by UUID REFERENCES sys_auth_users_mst(id)
);

CREATE INDEX idx_api_keys_tenant ON org_auth_api_keys(tenant_org_id);
CREATE INDEX idx_api_keys_hash ON org_auth_api_keys(key_hash);
CREATE INDEX idx_api_keys_active ON org_auth_api_keys(tenant_org_id, is_active) WHERE is_active = true;

-- RLS
ALTER TABLE org_auth_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON org_auth_api_keys
  FOR ALL
  USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));
```

#### `sys_auth_audit_log` - Authentication Audit Trail

```sql
CREATE TABLE sys_auth_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Event details
  event_type VARCHAR(50) NOT NULL, -- login, logout, mfa_verify, permission_check, etc.
  event_status VARCHAR(20) NOT NULL, -- success, failure, denied

  -- Actor
  user_id UUID REFERENCES sys_auth_users_mst(id),
  tenant_org_id UUID REFERENCES org_tenants_mst(id),

  -- Context
  resource VARCHAR(100), -- What was accessed
  action VARCHAR(50), -- What action was attempted

  -- Request metadata
  ip_address INET,
  user_agent TEXT,
  request_id VARCHAR(100),

  -- Additional details
  details JSONB, -- Flexible field for event-specific data
  error_message TEXT,

  -- Timestamp
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Retention
  retention_days INTEGER DEFAULT 90
);

-- Indexes
CREATE INDEX idx_audit_log_user ON sys_auth_audit_log(user_id);
CREATE INDEX idx_audit_log_tenant ON sys_auth_audit_log(tenant_org_id);
CREATE INDEX idx_audit_log_event_type ON sys_auth_audit_log(event_type);
CREATE INDEX idx_audit_log_created ON sys_auth_audit_log(created_at DESC);
CREATE INDEX idx_audit_log_ip ON sys_auth_audit_log(ip_address);

-- Partitioning for performance
CREATE TABLE sys_auth_audit_log_y2025m01 PARTITION OF sys_auth_audit_log
  FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

-- Comments
COMMENT ON TABLE sys_auth_audit_log IS 'Complete audit trail of all authentication and authorization events';
```

#### `org_auth_sso_config` - SSO Configuration

```sql
CREATE TABLE org_auth_sso_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,

  -- SSO provider
  provider_type VARCHAR(20) NOT NULL, -- saml, oidc, oauth2
  provider_name VARCHAR(250) NOT NULL,

  -- SAML configuration
  saml_entity_id VARCHAR(500),
  saml_sso_url TEXT,
  saml_certificate TEXT,
  saml_logout_url TEXT,

  -- OIDC/OAuth2 configuration
  oidc_issuer TEXT,
  oidc_client_id VARCHAR(250),
  oidc_client_secret VARCHAR(500), -- Encrypted
  oidc_authorization_endpoint TEXT,
  oidc_token_endpoint TEXT,
  oidc_userinfo_endpoint TEXT,

  -- Attribute mapping
  attribute_mapping JSONB, -- Maps SSO attributes to user fields

  -- Status
  is_active BOOLEAN DEFAULT true,
  is_default BOOLEAN DEFAULT false, -- Default SSO for this tenant

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,

  CONSTRAINT unique_tenant_provider UNIQUE (tenant_org_id, provider_name)
);

CREATE INDEX idx_sso_config_tenant ON org_auth_sso_config(tenant_org_id);
CREATE INDEX idx_sso_config_type ON org_auth_sso_config(provider_type);

-- RLS
ALTER TABLE org_auth_sso_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON org_auth_sso_config
  FOR ALL
  USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));
```

---

## User Management

### User Creation Flow

```typescript
interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  userType: 'platform_operator' | 'tenant_admin' | 'tenant_user';
  tenantId?: string; // Required for tenant users
  roleId?: string; // Required for tenant users
}

async function createUser(data: CreateUserDto): Promise<User> {
  // Step 1: Create Supabase auth user
  const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
    email: data.email,
    password: data.password,
    email_confirm: false, // Send confirmation email
    user_metadata: {
      first_name: data.firstName,
      last_name: data.lastName
    }
  });

  if (authError) {
    throw new Error(`Failed to create auth user: ${authError.message}`);
  }

  // Step 2: Create system user record
  const systemUser = await prisma.sys_auth_users_mst.create({
    data: {
      auth_user_id: authUser.user.id,
      email: data.email,
      phone: data.phone,
      first_name: data.firstName,
      last_name: data.lastName,
      user_type: data.userType,
      user_status: 'active',
      email_verified: false,
      created_at: new Date()
    }
  });

  // Step 3: If tenant user, create tenant assignment
  if (data.userType !== 'platform_operator' && data.tenantId) {
    await prisma.org_auth_users_mst.create({
      data: {
        tenant_org_id: data.tenantId,
        user_id: systemUser.id,
        role_id: data.roleId,
        created_at: new Date()
      }
    });
  }

  // Step 4: Log audit event
  await logAuditEvent({
    eventType: 'user_created',
    eventStatus: 'success',
    userId: systemUser.id,
    tenantId: data.tenantId,
    details: {
      userType: data.userType,
      email: data.email
    }
  });

  logger.info('User created', {
    userId: systemUser.id,
    email: data.email,
    userType: data.userType
  });

  return systemUser;
}
```

### User Invitation Flow

```typescript
interface InviteUserDto {
  tenantId: string;
  email: string;
  roleId: string;
  firstName: string;
  lastName: string;
  invitedBy: string;
}

async function inviteUser(data: InviteUserDto): Promise<InvitationResult> {
  // Step 1: Check if user already exists
  const existingUser = await prisma.sys_auth_users_mst.findUnique({
    where: { email: data.email }
  });

  let userId: string;

  if (existingUser) {
    // User exists, just add tenant assignment
    userId = existingUser.id;

    // Check if already assigned to this tenant
    const existingAssignment = await prisma.org_auth_users_mst.findUnique({
      where: {
        tenant_org_id_user_id: {
          tenant_org_id: data.tenantId,
          user_id: userId
        }
      }
    });

    if (existingAssignment) {
      throw new ConflictError('User already assigned to this tenant');
    }
  } else {
    // Create new user (without password)
    const { data: authUser } = await supabase.auth.admin.createUser({
      email: data.email,
      email_confirm: false,
      user_metadata: {
        first_name: data.firstName,
        last_name: data.lastName
      }
    });

    const systemUser = await prisma.sys_auth_users_mst.create({
      data: {
        auth_user_id: authUser!.user.id,
        email: data.email,
        first_name: data.firstName,
        last_name: data.lastName,
        user_type: 'tenant_user',
        user_status: 'active',
        email_verified: false
      }
    });

    userId = systemUser.id;
  }

  // Step 2: Create tenant assignment with invitation status
  await prisma.org_auth_users_mst.create({
    data: {
      tenant_org_id: data.tenantId,
      user_id: userId,
      role_id: data.roleId,
      invited_by: data.invitedBy,
      invited_at: new Date(),
      user_status: 'active'
    }
  });

  // Step 3: Generate invitation token
  const invitationToken = generateSecureToken();
  const invitationExpiry = addDays(new Date(), 7); // 7 days to accept

  // Store token (in cache or separate table)
  await storeInvitationToken(userId, data.tenantId, invitationToken, invitationExpiry);

  // Step 4: Send invitation email
  await sendInvitationEmail({
    email: data.email,
    firstName: data.firstName,
    tenantName: await getTenantName(data.tenantId),
    invitationUrl: `${process.env.APP_URL}/accept-invitation?token=${invitationToken}`,
    expiresAt: invitationExpiry
  });

  logger.info('User invited', {
    email: data.email,
    tenantId: data.tenantId,
    invitedBy: data.invitedBy
  });

  return {
    success: true,
    userId,
    invitationToken,
    expiresAt: invitationExpiry
  };
}
```

---

## Role-Based Access Control (RBAC)

### Role Hierarchy

```
Platform Operators:
┌──────────────────────────────────┐
│ PLATFORM_SUPER_ADMIN (Level 0)  │  ← Full system access
│  ├─ PLATFORM_ADMIN (Level 1)    │  ← Most platform operations
│  └─ PLATFORM_SUPPORT (Level 2)  │  ← Support and troubleshooting
└──────────────────────────────────┘

Tenant Users:
┌──────────────────────────────────┐
│ TENANT_OWNER (Level 0)           │  ← Full tenant access, billing
│  ├─ TENANT_ADMIN (Level 1)       │  ← Full operational access
│  │  └─ TENANT_MANAGER (Level 2)  │  ← Department/branch management
│  │     └─ TENANT_STAFF (Level 3) │  ← Daily operations
│  └─ TENANT_VIEWER (Level 4)      │  ← Read-only access
└──────────────────────────────────┘
```

### Permission Structure

```typescript
// Permission format: resource.action
type PermissionCode =
  // Tenant management
  | 'tenants.create'
  | 'tenants.view'
  | 'tenants.update'
  | 'tenants.delete'
  | 'tenants.suspend'

  // User management
  | 'users.create'
  | 'users.view'
  | 'users.update'
  | 'users.delete'
  | 'users.invite'

  // Order management
  | 'orders.create'
  | 'orders.view'
  | 'orders.update'
  | 'orders.delete'
  | 'orders.cancel'

  // Customer management
  | 'customers.create'
  | 'customers.view'
  | 'customers.update'
  | 'customers.delete'

  // Billing & subscriptions
  | 'billing.view'
  | 'billing.update'
  | 'subscriptions.manage'

  // Reports
  | 'reports.view'
  | 'reports.export'

  // Settings
  | 'settings.view'
  | 'settings.update';

// Permission categories
const PermissionCategories = {
  PLATFORM_MANAGEMENT: [
    'tenants.create',
    'tenants.view',
    'tenants.update',
    'tenants.delete',
    'tenants.suspend'
  ],
  USER_MANAGEMENT: [
    'users.create',
    'users.view',
    'users.update',
    'users.delete',
    'users.invite'
  ],
  OPERATIONS: [
    'orders.create',
    'orders.view',
    'orders.update',
    'customers.view',
    'customers.create'
  ],
  FINANCE: [
    'billing.view',
    'billing.update',
    'subscriptions.manage'
  ],
  REPORTS: [
    'reports.view',
    'reports.export'
  ]
};
```

### Permission Checking

```typescript
/**
 * Check if user has permission
 */
async function hasPermission(
  userId: string,
  permissionCode: string,
  tenantId?: string
): Promise<boolean> {
  // Get user's roles
  const userRoles = await getUserRoles(userId, tenantId);

  // Get permissions for all roles
  const permissions = await prisma.sys_auth_role_permissions.findMany({
    where: {
      role_id: { in: userRoles.map(r => r.id) }
    },
    include: {
      permission: true
    }
  });

  // Check if permission exists
  return permissions.some(
    p => p.permission.permission_code === permissionCode
  );
}

/**
 * Require permission (throws if denied)
 */
async function requirePermission(
  userId: string,
  permissionCode: string,
  tenantId?: string
): Promise<void> {
  const allowed = await hasPermission(userId, permissionCode, tenantId);

  if (!allowed) {
    // Log denied access
    await logAuditEvent({
      eventType: 'permission_check',
      eventStatus: 'denied',
      userId,
      tenantId,
      details: {
        permission: permissionCode,
        reason: 'insufficient_permissions'
      }
    });

    throw new ForbiddenError(`Permission denied: ${permissionCode}`);
  }

  // Log allowed access
  await logAuditEvent({
    eventType: 'permission_check',
    eventStatus: 'success',
    userId,
    tenantId,
    details: { permission: permissionCode }
  });
}

/**
 * Check multiple permissions (any)
 */
async function hasAnyPermission(
  userId: string,
  permissionCodes: string[],
  tenantId?: string
): Promise<boolean> {
  for (const code of permissionCodes) {
    if (await hasPermission(userId, code, tenantId)) {
      return true;
    }
  }
  return false;
}

/**
 * Check multiple permissions (all)
 */
async function hasAllPermissions(
  userId: string,
  permissionCodes: string[],
  tenantId?: string
): Promise<boolean> {
  for (const code of permissionCodes) {
    if (!(await hasPermission(userId, code, tenantId))) {
      return false;
    }
  }
  return true;
}
```

### Middleware for Permission Checking

```typescript
/**
 * Express middleware to check permissions
 */
function requirePermissions(permissionCodes: string | string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const { userId, tenantId } = req.auth; // From JWT

    const codes = Array.isArray(permissionCodes)
      ? permissionCodes
      : [permissionCodes];

    try {
      // Check if user has all required permissions
      const allowed = await hasAllPermissions(userId, codes, tenantId);

      if (!allowed) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions',
            requiredPermissions: codes
          }
        });
      }

      next();
    } catch (error) {
      logger.error('Permission check failed', error as Error, {
        userId,
        tenantId,
        permissions: codes
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Permission check failed'
        }
      });
    }
  };
}

// Usage in routes
app.post('/api/tenants',
  authenticate,
  requirePermissions('tenants.create'),
  createTenantHandler
);

app.get('/api/orders',
  authenticate,
  requirePermissions(['orders.view']),
  getOrdersHandler
);
```

---

## JWT Token Structure

### Access Token

```typescript
interface AccessTokenPayload {
  // Standard JWT claims
  sub: string; // User ID
  iat: number; // Issued at
  exp: number; // Expires at (15 minutes)

  // Custom claims
  email: string;
  user_type: 'platform_operator' | 'tenant_admin' | 'tenant_user';

  // Tenant context (for tenant users)
  tenant_org_id?: string;
  tenant_name?: string;

  // Role & permissions
  role_id: string;
  role_code: string;
  permissions: string[]; // Array of permission codes

  // Security
  session_id: string;
  ip_address: string;
}

// Example access token payload
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "iat": 1705233600,
  "exp": 1705234500, // 15 minutes
  "email": "admin@cleanmatex.com",
  "user_type": "tenant_admin",
  "tenant_org_id": "123e4567-e89b-12d3-a456-426614174000",
  "tenant_name": "Al Khobar Laundry",
  "role_id": "789e0123-e89b-12d3-a456-426614174000",
  "role_code": "TENANT_ADMIN",
  "permissions": [
    "orders.create",
    "orders.view",
    "orders.update",
    "customers.view",
    "customers.create",
    "users.invite",
    "reports.view"
  ],
  "session_id": "sess_abc123xyz",
  "ip_address": "192.168.1.100"
}
```

### Refresh Token

```typescript
interface RefreshTokenPayload {
  sub: string; // User ID
  iat: number; // Issued at
  exp: number; // Expires at (7 days)
  session_id: string;
  token_type: 'refresh';
}

// Example refresh token payload
{
  "sub": "550e8400-e29b-41d4-a716-446655440000",
  "iat": 1705233600,
  "exp": 1705838400, // 7 days
  "session_id": "sess_abc123xyz",
  "token_type": "refresh"
}
```

### Token Generation

```typescript
import jwt from 'jsonwebtoken';

/**
 * Generate access token
 */
function generateAccessToken(user: User, tenant?: Tenant): string {
  const payload: AccessTokenPayload = {
    sub: user.id,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (15 * 60), // 15 minutes
    email: user.email,
    user_type: user.user_type,
    role_id: user.role_id,
    role_code: user.role_code,
    permissions: user.permissions,
    session_id: generateSessionId(),
    ip_address: user.last_login_ip
  };

  if (tenant) {
    payload.tenant_org_id = tenant.id;
    payload.tenant_name = tenant.tenant_name;
  }

  return jwt.sign(payload, process.env.JWT_SECRET!, {
    algorithm: 'HS256'
  });
}

/**
 * Generate refresh token
 */
function generateRefreshToken(userId: string, sessionId: string): string {
  const payload: RefreshTokenPayload = {
    sub: userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60), // 7 days
    session_id: sessionId,
    token_type: 'refresh'
  };

  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    algorithm: 'HS256'
  });
}

/**
 * Verify and decode token
 */
function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, process.env.JWT_SECRET!) as AccessTokenPayload;
  } catch (error) {
    throw new UnauthorizedError('Invalid or expired token');
  }
}
```

---

## Row-Level Security (RLS)

### RLS Policy Patterns

#### Pattern 1: Tenant Isolation (Standard)

```sql
-- Apply to all tenant tables (org_*)
CREATE POLICY tenant_isolation ON org_orders_mst
  FOR ALL
  USING (
    tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id')
  );
```

#### Pattern 2: Platform Operator Access

```sql
-- Platform operators can see all data
CREATE POLICY platform_operator_access ON org_orders_mst
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM sys_auth_users_mst
      WHERE id::text = (auth.jwt() ->> 'sub')
      AND user_type = 'platform_operator'
    )
  );
```

#### Pattern 3: Role-Based RLS

```sql
-- Only admins can delete
CREATE POLICY admin_delete_only ON org_customers_mst
  FOR DELETE
  USING (
    tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id')
    AND (auth.jwt() ->> 'role_code') IN ('TENANT_OWNER', 'TENANT_ADMIN')
  );
```

#### Pattern 4: Branch-Level Isolation

```sql
-- Users can only see data from their assigned branch
CREATE POLICY branch_isolation ON org_orders_mst
  FOR SELECT
  USING (
    tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id')
    AND (
      -- User's role allows all branches
      (auth.jwt() ->> 'role_code') IN ('TENANT_OWNER', 'TENANT_ADMIN')
      OR
      -- Or order is from user's branch
      branch_id::text = (auth.jwt() ->> 'branch_id')
    )
  );
```

### RLS Testing

```sql
-- Test as tenant user
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claim.sub TO 'user-uuid';
SET LOCAL request.jwt.claim.tenant_org_id TO 'tenant-uuid';
SET LOCAL request.jwt.claim.role_code TO 'TENANT_STAFF';

-- Should only return tenant's data
SELECT * FROM org_orders_mst;

-- Should fail for other tenant's data
SELECT * FROM org_orders_mst WHERE tenant_org_id = 'other-tenant-uuid';
```

---

## Multi-Factor Authentication

### TOTP (Time-Based OTP)

```typescript
import speakeasy from 'speakeasy';
import QRCode from 'qrcode';

/**
 * Enable MFA for user
 */
async function enableMFA(userId: string): Promise<MFASetupResult> {
  // Generate secret
  const secret = speakeasy.generateSecret({
    name: `CleanMateX (${user.email})`,
    issuer: 'CleanMateX'
  });

  // Store encrypted secret
  await prisma.sys_auth_users_mst.update({
    where: { id: userId },
    data: {
      mfa_enabled: false, // Not enabled until verified
      mfa_method: 'totp',
      mfa_secret: encryptSecret(secret.base32)
    }
  });

  // Generate QR code
  const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url!);

  return {
    secret: secret.base32,
    qrCode: qrCodeUrl,
    backupCodes: generateBackupCodes() // Generate 10 backup codes
  };
}

/**
 * Verify MFA code and complete setup
 */
async function verifyMFASetup(
  userId: string,
  code: string
): Promise<boolean> {
  const user = await prisma.sys_auth_users_mst.findUnique({
    where: { id: userId }
  });

  if (!user || !user.mfa_secret) {
    throw new Error('MFA not initialized');
  }

  const secret = decryptSecret(user.mfa_secret);

  // Verify code
  const verified = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: code,
    window: 2 // Allow 2 time steps (60 seconds)
  });

  if (verified) {
    // Enable MFA
    await prisma.sys_auth_users_mst.update({
      where: { id: userId },
      data: { mfa_enabled: true }
    });

    logger.info('MFA enabled', { userId });
  }

  return verified;
}

/**
 * Verify MFA during login
 */
async function verifyMFALogin(
  userId: string,
  code: string
): Promise<boolean> {
  const user = await prisma.sys_auth_users_mst.findUnique({
    where: { id: userId }
  });

  if (!user || !user.mfa_enabled || !user.mfa_secret) {
    return false;
  }

  const secret = decryptSecret(user.mfa_secret);

  const verified = speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token: code,
    window: 2
  });

  // Log MFA verification
  await logAuditEvent({
    eventType: 'mfa_verify',
    eventStatus: verified ? 'success' : 'failure',
    userId,
    details: { method: 'totp' }
  });

  return verified;
}
```

### SMS-Based MFA

```typescript
/**
 * Send SMS verification code
 */
async function sendSMSCode(userId: string, phone: string): Promise<void> {
  // Generate 6-digit code
  const code = generateNumericCode(6);
  const expiresAt = addMinutes(new Date(), 5); // 5 minutes

  // Store in cache
  await redis.setex(`mfa:sms:${userId}`, 300, code);

  // Send SMS
  await sendSMS({
    to: phone,
    message: `Your CleanMateX verification code is: ${code}. Valid for 5 minutes.`
  });

  logger.info('SMS MFA code sent', { userId, phone });
}

/**
 * Verify SMS code
 */
async function verifySMSCode(
  userId: string,
  code: string
): Promise<boolean> {
  const storedCode = await redis.get(`mfa:sms:${userId}`);

  if (!storedCode) {
    return false;
  }

  const verified = storedCode === code;

  if (verified) {
    // Delete used code
    await redis.del(`mfa:sms:${userId}`);
  }

  return verified;
}
```

---

## SSO Integration

### SAML 2.0 Integration

```typescript
import { SAML } from '@boxyhq/saml-jackson';

/**
 * Initialize SAML connection
 */
async function initializeSAMLConnection(
  tenantId: string,
  config: SAMLConfig
): Promise<SAMLConnection> {
  const saml = new SAML({
    issuer: config.entityId,
    cert: config.certificate,
    entryPoint: config.ssoUrl,
    logoutUrl: config.logoutUrl
  });

  // Store configuration
  await prisma.org_auth_sso_config.create({
    data: {
      tenant_org_id: tenantId,
      provider_type: 'saml',
      provider_name: config.providerName,
      saml_entity_id: config.entityId,
      saml_sso_url: config.ssoUrl,
      saml_certificate: config.certificate,
      saml_logout_url: config.logoutUrl,
      attribute_mapping: config.attributeMapping,
      is_active: true
    }
  });

  return { success: true, saml };
}

/**
 * Handle SAML login request
 */
async function handleSAMLLogin(tenantId: string): Promise<string> {
  const config = await getSAMLConfig(tenantId);

  const saml = new SAML({
    issuer: config.saml_entity_id,
    cert: config.saml_certificate,
    entryPoint: config.saml_sso_url
  });

  // Generate login request URL
  const loginUrl = saml.getAuthorizeUrl({
    RelayState: tenantId // Pass tenant context
  });

  return loginUrl;
}

/**
 * Handle SAML assertion callback
 */
async function handleSAMLCallback(
  assertion: string
): Promise<AuthResult> {
  // Parse SAML assertion
  const samlResponse = await parseSAMLAssertion(assertion);

  // Extract user attributes
  const email = samlResponse.attributes['email'];
  const firstName = samlResponse.attributes['firstName'];
  const lastName = samlResponse.attributes['lastName'];
  const tenantId = samlResponse.relayState;

  // Find or create user
  let user = await findUserByEmail(email);

  if (!user) {
    user = await createUser({
      email,
      firstName,
      lastName,
      userType: 'tenant_user',
      tenantId
    });
  }

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user.id, generateSessionId());

  return {
    accessToken,
    refreshToken,
    user
  };
}
```

### OAuth 2.0 / OIDC Integration

```typescript
/**
 * Initialize OIDC provider
 */
async function initializeOIDCProvider(
  tenantId: string,
  config: OIDCConfig
): Promise<void> {
  await prisma.org_auth_sso_config.create({
    data: {
      tenant_org_id: tenantId,
      provider_type: 'oidc',
      provider_name: config.providerName,
      oidc_issuer: config.issuer,
      oidc_client_id: config.clientId,
      oidc_client_secret: encrypt(config.clientSecret),
      oidc_authorization_endpoint: config.authorizationEndpoint,
      oidc_token_endpoint: config.tokenEndpoint,
      oidc_userinfo_endpoint: config.userinfoEndpoint,
      attribute_mapping: config.attributeMapping,
      is_active: true
    }
  });
}

/**
 * Handle OIDC login
 */
async function handleOIDCLogin(tenantId: string): Promise<string> {
  const config = await getOIDCConfig(tenantId);

  const authorizationUrl = new URL(config.oidc_authorization_endpoint);
  authorizationUrl.searchParams.set('client_id', config.oidc_client_id);
  authorizationUrl.searchParams.set('redirect_uri', `${process.env.APP_URL}/auth/oidc/callback`);
  authorizationUrl.searchParams.set('response_type', 'code');
  authorizationUrl.searchParams.set('scope', 'openid email profile');
  authorizationUrl.searchParams.set('state', tenantId);

  return authorizationUrl.toString();
}

/**
 * Handle OIDC callback
 */
async function handleOIDCCallback(
  code: string,
  state: string // tenantId
): Promise<AuthResult> {
  const config = await getOIDCConfig(state);

  // Exchange code for tokens
  const tokenResponse = await fetch(config.oidc_token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: config.oidc_client_id,
      client_secret: decrypt(config.oidc_client_secret),
      redirect_uri: `${process.env.APP_URL}/auth/oidc/callback`
    })
  });

  const tokens = await tokenResponse.json();

  // Get user info
  const userinfoResponse = await fetch(config.oidc_userinfo_endpoint, {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });

  const userinfo = await userinfoResponse.json();

  // Map attributes
  const email = userinfo.email;
  const firstName = userinfo.given_name;
  const lastName = userinfo.family_name;

  // Find or create user
  let user = await findUserByEmail(email);

  if (!user) {
    user = await createUser({
      email,
      firstName,
      lastName,
      userType: 'tenant_user',
      tenantId: state
    });
  }

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user.id, generateSessionId());

  return {
    accessToken,
    refreshToken,
    user
  };
}
```

---

## API Key Management

### Generate API Key

```typescript
/**
 * Generate API key for tenant
 */
async function generateAPIKey(
  tenantId: string,
  keyName: string,
  scopes: string[],
  expiresInDays?: number
): Promise<APIKeyResult> {
  // Generate secure random key
  const apiKey = `cmx_${generateSecureToken(32)}`;

  // Hash the key for storage
  const keyHash = crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex');

  // Get key prefix (first 8 chars)
  const keyPrefix = apiKey.substring(0, 8);

  // Calculate expiry
  const expiresAt = expiresInDays
    ? addDays(new Date(), expiresInDays)
    : null;

  // Store in database
  const storedKey = await prisma.org_auth_api_keys.create({
    data: {
      tenant_org_id: tenantId,
      key_name: keyName,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      scopes,
      expires_at: expiresAt,
      is_active: true,
      created_at: new Date()
    }
  });

  logger.info('API key generated', {
    tenantId,
    keyName,
    keyPrefix
  });

  // Return the full key (only time it's visible)
  return {
    id: storedKey.id,
    apiKey, // Return full key
    keyPrefix,
    scopes,
    expiresAt
  };
}

/**
 * Verify API key
 */
async function verifyAPIKey(apiKey: string): Promise<APIKeyContext> {
  // Hash the provided key
  const keyHash = crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex');

  // Find key in database
  const storedKey = await prisma.org_auth_api_keys.findFirst({
    where: {
      key_hash: keyHash,
      is_active: true
    }
  });

  if (!storedKey) {
    throw new UnauthorizedError('Invalid API key');
  }

  // Check expiry
  if (storedKey.expires_at && storedKey.expires_at < new Date()) {
    throw new UnauthorizedError('API key expired');
  }

  // Update last used
  await prisma.org_auth_api_keys.update({
    where: { id: storedKey.id },
    data: { last_used_at: new Date() }
  });

  return {
    tenantId: storedKey.tenant_org_id,
    scopes: storedKey.scopes,
    keyId: storedKey.id
  };
}

/**
 * Middleware for API key authentication
 */
async function authenticateAPIKey(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const apiKey = req.headers['x-api-key'] as string;

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'MISSING_API_KEY',
        message: 'API key is required'
      }
    });
  }

  try {
    const context = await verifyAPIKey(apiKey);

    // Attach to request
    req.apiKeyContext = context;

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_API_KEY',
        message: 'Invalid or expired API key'
      }
    });
  }
}
```

---

## Session Management

### Session Tracking

```typescript
interface UserSession {
  sessionId: string;
  userId: string;
  tenantId?: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  expiresAt: Date;
  lastActivityAt: Date;
}

/**
 * Create user session
 */
async function createSession(
  userId: string,
  ipAddress: string,
  userAgent: string,
  tenantId?: string
): Promise<UserSession> {
  const sessionId = generateSessionId();
  const expiresAt = addDays(new Date(), 7); // 7 days

  const session: UserSession = {
    sessionId,
    userId,
    tenantId,
    ipAddress,
    userAgent,
    createdAt: new Date(),
    expiresAt,
    lastActivityAt: new Date()
  };

  // Store in Redis
  await redis.setex(
    `session:${sessionId}`,
    7 * 24 * 60 * 60, // 7 days
    JSON.stringify(session)
  );

  return session;
}

/**
 * Get active session
 */
async function getSession(sessionId: string): Promise<UserSession | null> {
  const data = await redis.get(`session:${sessionId}`);

  if (!data) {
    return null;
  }

  return JSON.parse(data);
}

/**
 * Update session activity
 */
async function updateSessionActivity(sessionId: string): Promise<void> {
  const session = await getSession(sessionId);

  if (session) {
    session.lastActivityAt = new Date();

    await redis.setex(
      `session:${sessionId}`,
      7 * 24 * 60 * 60,
      JSON.stringify(session)
    );
  }
}

/**
 * Revoke session (logout)
 */
async function revokeSession(sessionId: string): Promise<void> {
  await redis.del(`session:${sessionId}`);

  logger.info('Session revoked', { sessionId });
}

/**
 * Get all user sessions
 */
async function getUserSessions(userId: string): Promise<UserSession[]> {
  const keys = await redis.keys(`session:*`);
  const sessions: UserSession[] = [];

  for (const key of keys) {
    const data = await redis.get(key);
    if (data) {
      const session = JSON.parse(data);
      if (session.userId === userId) {
        sessions.push(session);
      }
    }
  }

  return sessions;
}

/**
 * Revoke all user sessions (force logout)
 */
async function revokeAllUserSessions(userId: string): Promise<number> {
  const sessions = await getUserSessions(userId);

  for (const session of sessions) {
    await revokeSession(session.sessionId);
  }

  return sessions.length;
}
```

---

## Password Policies

### Password Requirements

```typescript
interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumbers: boolean;
  requireSpecialChars: boolean;
  maxAge: number; // Days
  preventReuse: number; // Number of previous passwords
}

const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 12,
  requireUppercase: true,
  requireLowercase: true,
  requireNumbers: true,
  requireSpecialChars: true,
  maxAge: 90, // 90 days
  preventReuse: 5 // Last 5 passwords
};

/**
 * Validate password against policy
 */
function validatePassword(
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY
): ValidationResult {
  const errors: string[] = [];

  // Length check
  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters`);
  }

  // Uppercase check
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }

  // Lowercase check
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }

  // Numbers check
  if (policy.requireNumbers && !/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }

  // Special characters check
  if (policy.requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Check password expiry
 */
async function isPasswordExpired(userId: string): Promise<boolean> {
  const user = await prisma.sys_auth_users_mst.findUnique({
    where: { id: userId },
    select: { password_changed_at: true }
  });

  if (!user || !user.password_changed_at) {
    return true; // Force change if no record
  }

  const daysSinceChange = daysSince(user.password_changed_at);
  return daysSinceChange > DEFAULT_PASSWORD_POLICY.maxAge;
}
```

---

## Audit & Logging

### Audit Event Types

```typescript
type AuditEventType =
  // Authentication events
  | 'login_success'
  | 'login_failure'
  | 'logout'
  | 'password_reset_request'
  | 'password_changed'
  | 'mfa_enabled'
  | 'mfa_disabled'
  | 'mfa_verify_success'
  | 'mfa_verify_failure'

  // Authorization events
  | 'permission_check_allowed'
  | 'permission_check_denied'
  | 'role_assigned'
  | 'role_revoked'

  // User management
  | 'user_created'
  | 'user_updated'
  | 'user_suspended'
  | 'user_deactivated'
  | 'user_invited'

  // Security events
  | 'account_locked'
  | 'suspicious_activity'
  | 'api_key_created'
  | 'api_key_revoked'
  | 'session_revoked';

interface AuditEvent {
  eventType: AuditEventType;
  eventStatus: 'success' | 'failure' | 'denied';
  userId?: string;
  tenantId?: string;
  resource?: string;
  action?: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  details?: Record<string, any>;
  errorMessage?: string;
}

/**
 * Log audit event
 */
async function logAuditEvent(event: AuditEvent): Promise<void> {
  await prisma.sys_auth_audit_log.create({
    data: {
      event_type: event.eventType,
      event_status: event.eventStatus,
      user_id: event.userId,
      tenant_org_id: event.tenantId,
      resource: event.resource,
      action: event.action,
      ip_address: event.ipAddress,
      user_agent: event.userAgent,
      request_id: event.requestId,
      details: event.details,
      error_message: event.errorMessage,
      created_at: new Date()
    }
  });
}
```

---

## Implementation Plan

### Phase 1: Foundation (Weeks 1-2)
- Database schema creation
- Supabase Auth integration
- Basic authentication (email/password)
- JWT token generation
- Session management

### Phase 2: RBAC (Weeks 3-4)
- Role and permission system
- Permission checking middleware
- RLS policies
- Audit logging

### Phase 3: MFA (Weeks 5-6)
- TOTP implementation
- SMS-based MFA
- Backup codes
- MFA enrollment flow

### Phase 4: SSO (Weeks 7-8)
- SAML 2.0 integration
- OIDC integration
- SSO configuration UI
- Tenant SSO management

### Phase 5: API Keys & Advanced (Weeks 9-10)
- API key generation
- API key authentication
- Advanced session management
- Security hardening

---

## Compliance & Security

### SOC 2 Requirements

✅ **Access Control**
- RBAC with granular permissions
- Least privilege principle
- Regular access reviews

✅ **Authentication**
- Multi-factor authentication
- Strong password policies
- Session management

✅ **Audit Logging**
- All auth events logged
- Immutable audit trail
- 90-day retention minimum

✅ **Data Encryption**
- Encryption at rest (database)
- Encryption in transit (TLS)
- Secure key storage

✅ **Incident Response**
- Failed login monitoring
- Account lockout after 5 attempts
- Automated alerts

### GDPR Compliance

✅ **Right to Access**: Users can export auth data
✅ **Right to Erasure**: Account deletion process
✅ **Data Minimization**: Only necessary data stored
✅ **Consent**: Clear consent for data processing
✅ **Audit Trail**: All data access logged

---

## Future Enhancements

1. **Biometric Authentication**
   - Fingerprint authentication
   - Face ID support
   - WebAuthn integration

2. **Hardware Security Keys**
   - YubiKey support
   - FIDO2 authentication
   - Passkey support

3. **Advanced Threat Detection**
   - Anomaly detection
   - IP reputation checking
   - Device fingerprinting

4. **Identity Federation**
   - Cross-platform SSO
   - Identity provider aggregation
   - Federated identity management

---

## Related PRDs

- **PRD-SAAS-MNG-0001**: Platform HQ Console (Parent)
- **PRD-SAAS-MNG-0002**: Tenant Lifecycle (Tenant management)
- **PRD-SAAS-MNG-0005**: Support & Ticketing (User support)
- **PRD-SAAS-MNG-0008**: Customer Master Data (Customer identity)

---

## Glossary

- **RBAC**: Role-Based Access Control
- **RLS**: Row-Level Security
- **JWT**: JSON Web Token
- **MFA**: Multi-Factor Authentication
- **TOTP**: Time-Based One-Time Password
- **SSO**: Single Sign-On
- **SAML**: Security Assertion Markup Language
- **OIDC**: OpenID Connect
- **OAuth**: Open Authorization

---

**End of PRD-SAAS-MNG-0009**

**Status**: Draft
**Next Review**: 2025-01-21
**Approved By**: Pending
