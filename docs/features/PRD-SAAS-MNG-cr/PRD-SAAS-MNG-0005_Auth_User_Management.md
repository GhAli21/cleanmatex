# PRD-SAAS-MNG-0005: Authentication & User Management

**Version:** 1.0  
**Status:** Draft  
**Owner:** Jehad Ali (Jh Apps HQ)  
**Priority:** Phase 1 - Critical

---

## Overview & Purpose

This PRD defines the authentication and user management system for HQ Console users (internal team members), including roles, permissions, and access control.

**Business Value:**
- Secure access to HQ Console
- Role-based access control
- User lifecycle management
- Audit trail of user actions
- Multi-factor authentication support

---

## Functional Requirements

### FR-AUTH-001: HQ User Management
- **Description**: Manage HQ console users
- **Acceptance Criteria**:
  - Create HQ users (internal team members)
  - Edit user information
  - Deactivate users
  - View user list with roles

### FR-AUTH-002: Role Management
- **Description**: Manage user roles and permissions
- **Acceptance Criteria**:
  - Define roles (Super Admin, Technical Admin, Business Admin, QA, Support)
  - Assign roles to users
  - Configure permissions per role
  - View role assignments

### FR-AUTH-003: User Invitation
- **Description**: Invite new users to HQ Console
- **Acceptance Criteria**:
  - Send invitation email
  - User activation via email link
  - Set initial role during invitation
  - Resend invitation option

### FR-AUTH-004: Authentication
- **Description**: Secure login and session management
- **Acceptance Criteria**:
  - Separate login page for HQ Console
  - Supabase Auth integration
  - Session management
  - Logout functionality

### FR-AUTH-005: Multi-Factor Authentication
- **Description**: MFA support for enhanced security
- **Acceptance Criteria**:
  - Enable/disable MFA per user
  - TOTP-based MFA
  - Backup codes
  - MFA enforcement for sensitive operations

### FR-AUTH-006: Audit Logging
- **Description**: Log all user actions
- **Acceptance Criteria**:
  - Log user login/logout
  - Log all operations with user ID
  - View audit logs per user
  - Export audit logs

---

## Technical Requirements

### Database Schema

#### HQ Users (extends Supabase auth.users)
```sql
CREATE TABLE hq_users (
  id UUID PRIMARY KEY REFERENCES auth_users(id),
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  role VARCHAR(50) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  mfa_enabled BOOLEAN DEFAULT false,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);
```

#### Roles
```sql
CREATE TABLE hq_roles (
  role_code VARCHAR(50) PRIMARY KEY,
  role_name VARCHAR(250) NOT NULL,
  role_description TEXT,
  permissions JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### Audit Logs
```sql
CREATE TABLE hq_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES hq_users(id),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

---

## API Endpoints

### Users

#### List Users
```
GET /api/hq/v1/users
Response: { data: HQUser[] }
```

#### Create User
```
POST /api/hq/v1/users
Body: { email, full_name, role }
Response: { success: boolean, data: HQUser }
```

#### Update User
```
PATCH /api/hq/v1/users/:id
Body: { full_name?, role?, is_active? }
Response: { success: boolean, data: HQUser }
```

#### Invite User
```
POST /api/hq/v1/users/:id/invite
Response: { success: boolean, message: string }
```

#### Deactivate User
```
POST /api/hq/v1/users/:id/deactivate
Body: { reason?: string }
Response: { success: boolean, message: string }
```

### Roles

#### List Roles
```
GET /api/hq/v1/roles
Response: { data: Role[] }
```

#### Create Role
```
POST /api/hq/v1/roles
Body: { role_code, role_name, permissions }
Response: { success: boolean, data: Role }
```

#### Get User Permissions
```
GET /api/hq/v1/users/:id/permissions
Response: { permissions: Permission[] }
```

### Audit Logs

#### Get Audit Logs
```
GET /api/hq/v1/audit-logs?user_id?&action?&resource_type?&page=1
Response: { data: AuditLog[], pagination }
```

---

## UI/UX Requirements

### Login Page
- Separate login page for HQ Console
- Email/password authentication
- MFA challenge (if enabled)
- Forgot password link

### User Management Page
- User list with roles
- Create user form
- Edit user modal
- Invite user action
- Deactivate user action

### Role Management Page
- Role list with permissions
- Create/edit role form
- Permission matrix
- Assign roles to users

---

## Security Considerations

1. **Access Control**: Only HQ users can access HQ Console
2. **Role-Based**: Enforce permissions at API and UI level
3. **MFA**: Optional but recommended for sensitive operations
4. **Audit Trail**: All actions logged
5. **Session Security**: Secure session management

---

## Testing Requirements

- Unit tests for authentication
- Integration tests for user management
- E2E tests for login flow
- Permission tests

---

## Implementation Checklist

- [ ] Create HQ user tables
- [ ] Implement authentication API
- [ ] Implement user management API
- [ ] Implement role management API
- [ ] Create login page
- [ ] Create user management UI
- [ ] Add MFA support
- [ ] Implement audit logging
- [ ] Write tests
- [ ] Documentation

---

**Related PRDs:**
- PRD-SAAS-MNG-0011: Standalone Module Architecture
- PRD-SAAS-MNG-0014: Security, RLS & Governance

