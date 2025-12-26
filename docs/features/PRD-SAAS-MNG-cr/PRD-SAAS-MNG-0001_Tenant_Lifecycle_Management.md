# PRD-SAAS-MNG-0001: Tenant Lifecycle Management

**Version:** 1.0  
**Status:** Draft  
**Owner:** Jehad Ali (Jh Apps HQ)  
**Priority:** Phase 1 - Critical

---

## Overview & Purpose

This PRD defines the tenant lifecycle management system for the CleanMateX HQ Console. It enables HQ team members to create, configure, monitor, and manage tenant organizations throughout their entire lifecycle from creation to archival.

**Business Value:**
- Streamlined tenant onboarding process
- Centralized tenant management and monitoring
- Automated tenant initialization
- Complete audit trail of tenant operations
- Efficient tenant status management

---

## Functional Requirements

### FR-TENANT-001: Tenant Creation
- **Description**: Create new tenant organizations with initial configuration
- **Acceptance Criteria**:
  - HQ user can create tenant via form with required fields (name, slug, email, phone)
  - System validates uniqueness of slug and email
  - Tenant record created in `org_tenants_mst`
  - Automatic initialization triggered (subscription, branch, service categories)
  - Success notification displayed

### FR-TENANT-002: Tenant Profile Management
- **Description**: Update tenant profile information
- **Acceptance Criteria**:
  - Edit tenant name (EN/AR), contact information, address
  - Update branding (logo, colors)
  - Modify settings (timezone, currency, language)
  - Changes logged in audit trail
  - Validation prevents invalid data

### FR-TENANT-003: Tenant Status Management
- **Description**: Manage tenant status (active, suspended, trial, expired)
- **Acceptance Criteria**:
  - Change tenant status with confirmation dialog
  - Suspend tenant (prevents access, retains data)
  - Activate suspended tenant
  - View status history
  - Status changes trigger notifications

### FR-TENANT-004: Tenant Initialization
- **Description**: Automated tenant initialization process
- **Acceptance Criteria**:
  - Create default subscription (trial period)
  - Create main branch
  - Enable all active service categories
  - Set default workflow templates
  - Initialize default settings
  - Manual re-initialization option available

### FR-TENANT-005: Tenant Search & Filtering
- **Description**: Search and filter tenants by various criteria
- **Acceptance Criteria**:
  - Search by name, slug, email, phone
  - Filter by status, plan, region, creation date
  - Sort by various fields
  - Pagination support
  - Export filtered results

### FR-TENANT-006: Tenant Analytics
- **Description**: View tenant usage and performance metrics
- **Acceptance Criteria**:
  - Display tenant statistics (orders, users, branches)
  - Show subscription usage vs limits
  - View activity timeline
  - Performance metrics dashboard

### FR-TENANT-007: Tenant Archival
- **Description**: Archive or delete tenant with data retention
- **Acceptance Criteria**:
  - Soft delete option (mark as archived)
  - Hard delete with confirmation (requires approval)
  - Data retention policy enforcement
  - Export tenant data before deletion
  - Audit trail of deletion

### FR-TENANT-008: Bulk Operations
- **Description**: Perform operations on multiple tenants
- **Acceptance Criteria**:
  - Select multiple tenants
  - Bulk status change
  - Bulk plan assignment
  - Bulk export
  - Confirmation required for bulk operations

---

## Technical Requirements

### Architecture
- **Frontend**: Next.js (platform-web)
- **Backend**: NestJS API (platform-api)
- **Database**: PostgreSQL (Supabase)
- **Authentication**: Supabase Auth with HQ-specific roles

### Database Schema

#### org_tenants_mst
```sql
CREATE TABLE org_tenants_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  name2 VARCHAR(255), -- Arabic name
  slug VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL UNIQUE,
  phone VARCHAR(50) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(2) DEFAULT 'OM',
  currency VARCHAR(3) DEFAULT 'OMR',
  timezone VARCHAR(50) DEFAULT 'Asia/Muscat',
  language VARCHAR(5) DEFAULT 'en',
  logo_url VARCHAR(500),
  brand_color VARCHAR(7),
  s_cureent_plan VARCHAR(120) DEFAULT 'plan_freemium',
  status VARCHAR(20) DEFAULT 'trial', -- trial, active, suspended, expired, archived
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth_users(id),
  updated_by UUID REFERENCES auth_users(id)
);
```

#### Tenant Status History (Audit)
```sql
CREATE TABLE hq_tenant_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES org_tenants_mst(id),
  from_status VARCHAR(20),
  to_status VARCHAR(20) NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth_users(id),
  changed_at TIMESTAMPTZ DEFAULT now(),
  reason TEXT,
  metadata JSONB
);
```

---

## API Endpoints

### Base Path: `/api/hq/v1/tenants`

#### Create Tenant
```
POST /api/hq/v1/tenants
Body: {
  name: string,
  name2?: string,
  slug: string,
  email: string,
  phone: string,
  address?: string,
  city?: string,
  country?: string,
  currency?: string,
  timezone?: string,
  language?: string
}
Response: { success: boolean, data: Tenant, message?: string }
```

#### List Tenants
```
GET /api/hq/v1/tenants?page=1&limit=20&status=active&search=keyword
Response: {
  data: Tenant[],
  pagination: { page, limit, total, totalPages }
}
```

#### Get Tenant Details
```
GET /api/hq/v1/tenants/:id
Response: { data: TenantWithDetails }
```

#### Update Tenant
```
PATCH /api/hq/v1/tenants/:id
Body: { ...partial tenant fields }
Response: { success: boolean, data: Tenant }
```

#### Initialize Tenant
```
POST /api/hq/v1/tenants/:id/initialize
Response: { success: boolean, message: string }
```

#### Suspend Tenant
```
POST /api/hq/v1/tenants/:id/suspend
Body: { reason?: string }
Response: { success: boolean, message: string }
```

#### Activate Tenant
```
POST /api/hq/v1/tenants/:id/activate
Response: { success: boolean, message: string }
```

#### Archive Tenant
```
DELETE /api/hq/v1/tenants/:id
Body: { hardDelete?: boolean, exportData?: boolean }
Response: { success: boolean, message: string }
```

#### Get Tenant Analytics
```
GET /api/hq/v1/tenants/:id/analytics
Response: {
  orders: { total, thisMonth, lastMonth },
  users: { total, active },
  branches: { total, active },
  subscription: { usage, limits, percentage }
}
```

---

## UI/UX Requirements

### Tenant List Page
- **Layout**: Table view with filters and search
- **Columns**: Name, Slug, Email, Status, Plan, Created Date, Actions
- **Actions**: View, Edit, Suspend/Activate, Initialize, Archive
- **Filters**: Status, Plan, Region, Date Range
- **Search**: Real-time search across name, slug, email

### Tenant Detail Page
- **Sections**:
  - Basic Information (editable)
  - Subscription Details
  - Usage Statistics
  - Status History Timeline
  - Settings & Configuration
- **Actions**: Edit, Change Status, Initialize, Archive

### Tenant Creation Form
- **Fields**: All required tenant fields
- **Validation**: Real-time validation with error messages
- **Bilingual**: Support for EN/AR names
- **Success**: Redirect to tenant detail page

---

## Security Considerations

1. **Access Control**: Only HQ users with appropriate roles can manage tenants
2. **Audit Logging**: All tenant operations logged with user, timestamp, and changes
3. **Data Validation**: Server-side validation for all inputs
4. **Confirmation Dialogs**: Required for destructive operations (suspend, archive)
5. **Rate Limiting**: Prevent abuse of tenant creation endpoints
6. **Data Privacy**: Respect tenant data privacy in search and exports

---

## Testing Requirements

### Unit Tests
- Tenant creation validation
- Status transition logic
- Initialization process
- Search and filter functions

### Integration Tests
- API endpoint testing
- Database operations
- Initialization workflow
- Status change workflow

### E2E Tests
- Create tenant flow
- Edit tenant flow
- Suspend/activate flow
- Archive tenant flow

---

## Implementation Checklist

- [ ] Create database migrations for tenant tables
- [ ] Implement tenant creation API endpoint
- [ ] Implement tenant list/search API endpoint
- [ ] Implement tenant detail API endpoint
- [ ] Implement tenant update API endpoint
- [ ] Implement tenant initialization function
- [ ] Implement status change API endpoints
- [ ] Implement tenant archival API endpoint
- [ ] Create tenant list UI page
- [ ] Create tenant detail UI page
- [ ] Create tenant creation form
- [ ] Implement search and filtering UI
- [ ] Add audit logging
- [ ] Add role-based access control
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Write E2E tests
- [ ] Documentation

---

**Related PRDs:**
- PRD-SAAS-MNG-0002: Plans & Subscriptions Management
- PRD-SAAS-MNG-0008: Data Seeding & Initialization
- PRD-SAAS-MNG-0011: Standalone Module Architecture

