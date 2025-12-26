# Tenant Management - Development Plan & PRD

**Document ID**: 005_tenant_management_dev_prd  
**Version**: 1.0  
**Status**: Ready for Implementation  
**Owner**: Backend + Frontend Team  
**Dependencies**: 001-004  
**Related Requirements**: UC10

---

## 1. Overview

### Purpose

Complete tenant management system including registration, profile management, subscription handling, branch management, and user/role administration.

### Business Value

- Enable self-service tenant onboarding
- Manage subscription lifecycle
- Support multi-branch operations
- Control user access per tenant

---

## 2. Functional Requirements

### FR-TEN-001: Tenant Registration

- Self-service signup form
- Email verification
- Trial period activation (30 days)
- Default configuration setup

### FR-TEN-002: Tenant Profile Management

- Update company details (name, address, contact)
- Manage branding (logo, colors)
- Configure preferences (timezone, currency, language)
- Bilingual company name support

### FR-TEN-003: Subscription Management

- View current plan details
- Upgrade/downgrade plans
- View usage statistics
- Payment history
- Invoice download

### FR-TEN-004: Branch Management

- Create/edit/delete branches
- Set branch details and location
- Assign users to branches
- Multi-branch coordination

### FR-TEN-005: User & Role Management

- Invite users via email
- Assign roles (branch_manager, operator, assembly, qa, driver)
- Deactivate users
- View user activity logs

---

## 3. Technical Design

### API Endpoints

**Tenant APIs**:

```typescript
POST   /api/v1/tenants                  // Register new tenant
GET    /api/v1/tenants/:id              // Get tenant details
PATCH  /api/v1/tenants/:id              // Update tenant
GET    /api/v1/tenants/:id/settings     // Get settings
PATCH  /api/v1/tenants/:id/settings     // Update settings
GET    /api/v1/tenants/:id/subscription // Get subscription
PATCH  /api/v1/tenants/:id/subscription // Update plan
GET    /api/v1/tenants/:id/usage        // Get usage stats
```

**Branch APIs**:

```typescript
GET    /api/v1/branches                 // List branches
POST   /api/v1/branches                 // Create branch
GET    /api/v1/branches/:id             // Get branch
PATCH  /api/v1/branches/:id             // Update branch
DELETE /api/v1/branches/:id             // Delete branch
```

**User Management APIs**:

```typescript
GET    /api/v1/users                    // List tenant users
POST   /api/v1/users/invite             // Invite new user
PATCH  /api/v1/users/:id                // Update user
DELETE /api/v1/users/:id                // Deactivate user
POST   /api/v1/users/:id/reset-password // Trigger password reset
```

### UI Components

**Web Admin Pages**:

1. Settings → Company Profile
2. Settings → Branches
3. Settings → Team Members
4. Settings → Subscription & Billing
5. Settings → Preferences

---

## 4. Implementation Plan (8 days)

### Phase 1: Tenant APIs (3 days)

- Implement tenant CRUD endpoints
- Add settings management
- Subscription status API
- Usage tracking API

### Phase 2: Branch Management (2 days)

- Branch CRUD operations
- Branch assignment logic
- Location/geolocation handling

### Phase 3: User Management (2 days)

- User invitation system
- Role assignment
- User activation/deactivation

### Phase 4: UI Implementation (3 days)

- Settings pages layout
- Forms for tenant/branch/user
- Subscription dashboard
- Usage charts

---

## 5. Database Schema

Uses existing:

- `org_tenants_mst`
- `org_tenant_settings`
- `org_subscriptions_mst`
- `org_branches_mst`
- `org_users_mst`

Additional:

```sql
CREATE TABLE org_user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(50) NOT NULL,
  invited_by UUID,
  token VARCHAR(255) UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  accepted_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE
);
```

---

## 6. Testing Strategy

- Unit tests for API endpoints
- Integration tests for invitation flow
- UI tests for settings pages
- Test multi-branch scenarios
- Test subscription upgrades/downgrades

---

## 7. Success Metrics

| Metric                   | Target       |
| ------------------------ | ------------ |
| Tenant Registration Time | < 5 minutes  |
| Settings Update          | < 2 seconds  |
| User Invitation Delivery | < 30 seconds |

---

## 8. Acceptance Checklist

- [ ] Tenant registration working
- [ ] Profile update functional
- [ ] Branch CRUD operations
- [ ] User invitation system
- [ ] Role assignment
- [ ] Subscription display
- [ ] Usage statistics
- [ ] All tests passing

---

**Document Version**: 1.0  
**Last Updated**: 2025-10-09
