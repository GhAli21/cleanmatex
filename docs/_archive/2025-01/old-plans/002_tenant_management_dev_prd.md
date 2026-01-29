# Tenant Onboarding & Management - Implementation Plan

**PRD ID**: 002_tenant_management_dev_prd
**Phase**: MVP
**Priority**: Must Have
**Estimated Duration**: 1.5 weeks
**Dependencies**: PRD-001 (Auth)

---

## Overview

Implement comprehensive tenant (organization) onboarding, subscription management, and configuration system. This module enables laundries to sign up, configure their business settings, manage subscriptions, and control feature flags based on their plan tier.

---

## Business Value

- **Revenue**: Subscription-based pricing with automated trial-to-paid conversion
- **Scalability**: Self-service onboarding reduces support overhead
- **Flexibility**: Feature flags enable tiered pricing without code changes
- **Retention**: Trial period allows customers to experience value before payment
- **Compliance**: Proper tenant metadata for invoicing and tax purposes

---

## Requirements

### Functional Requirements

- **FR-TENANT-001**: Self-service tenant registration (sign up form)
- **FR-TENANT-002**: Automatic 14-day trial subscription on registration
- **FR-TENANT-003**: Tenant profile management (name, contact, address, branding)
- **FR-TENANT-004**: Subscription plan selection (Free/Starter/Growth/Pro/Enterprise)
- **FR-TENANT-005**: Subscription upgrade/downgrade workflow
- **FR-TENANT-006**: Feature flag configuration based on plan tier
- **FR-TENANT-007**: Trial expiration notification (7 days, 3 days, 1 day before)
- **FR-TENANT-008**: Automatic downgrade to Free tier after trial expiration (if no payment)
- **FR-TENANT-009**: Subscription renewal and payment tracking
- **FR-TENANT-010**: Tenant settings: currency, timezone, language, business hours
- **FR-TENANT-011**: Logo and branding upload (color scheme)
- **FR-TENANT-012**: Tenant deactivation (soft delete with data retention)
- **FR-TENANT-013**: Usage tracking (orders count, users count, storage)
- **FR-TENANT-014**: Plan limits enforcement (orders/month, users, branches)
- **FR-TENANT-015**: Admin ability to override feature flags (for special deals)

### Non-Functional Requirements

- **NFR-TENANT-001**: Onboarding completion time < 5 minutes
- **NFR-TENANT-002**: Support 10,000+ active tenants
- **NFR-TENANT-003**: Tenant data isolation via RLS (100% enforcement)
- **NFR-TENANT-004**: Logo upload: max 2MB, formats: PNG/JPG/SVG
- **NFR-TENANT-005**: Settings update response time < 300ms
- **NFR-TENANT-006**: Usage metrics updated daily (background job)
- **NFR-TENANT-007**: Trial expiration checks run hourly

---

## Database Schema

### Tenant Tables

```sql
-- org_tenants_mst (already exists in 0001_core.sql - extended here)
ALTER TABLE org_tenants_mst ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);
ALTER TABLE org_tenants_mst ADD COLUMN IF NOT EXISTS brand_color_primary VARCHAR(7) DEFAULT '#3B82F6';
ALTER TABLE org_tenants_mst ADD COLUMN IF NOT EXISTS brand_color_secondary VARCHAR(7) DEFAULT '#10B981';
ALTER TABLE org_tenants_mst ADD COLUMN IF NOT EXISTS business_hours JSONB DEFAULT '{"mon": {"open": "08:00", "close": "18:00"}, "tue": {"open": "08:00", "close": "18:00"}, "wed": {"open": "08:00", "close": "18:00"}, "thu": {"open": "08:00", "close": "18:00"}, "fri": {"open": "08:00", "close": "18:00"}, "sat": {"open": "09:00", "close": "14:00"}, "sun": null}'::JSONB;
ALTER TABLE org_tenants_mst ADD COLUMN IF NOT EXISTS feature_flags JSONB DEFAULT '{
  "pdf_invoices": false,
  "whatsapp_receipts": true,
  "in_app_receipts": false,
  "printing": false,
  "b2b_contracts": false,
  "white_label": false,
  "marketplace_listings": false,
  "loyalty_programs": false,
  "driver_app": false,
  "multi_branch": false,
  "advanced_analytics": false,
  "api_access": false
}'::JSONB;

-- org_subscriptions_mst(already exists - updated)
ALTER TABLE org_subscriptions_mstADD COLUMN IF NOT EXISTS auto_renew BOOLEAN DEFAULT true;
ALTER TABLE org_subscriptions_mstADD COLUMN IF NOT EXISTS cancellation_date TIMESTAMP;
ALTER TABLE org_subscriptions_mstADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- org_usage_tracking (new)
CREATE TABLE IF NOT EXISTS org_usage_tracking (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id     UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  orders_count      INTEGER DEFAULT 0,
  users_count       INTEGER DEFAULT 0,
  branches_count    INTEGER DEFAULT 0,
  storage_mb        NUMERIC(10,2) DEFAULT 0,
  api_calls         INTEGER DEFAULT 0,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(tenant_org_id, period_start)
);

CREATE INDEX idx_usage_tenant_period ON org_usage_tracking(tenant_org_id, period_start DESC);

-- Plan limits configuration (system-level)
CREATE TABLE IF NOT EXISTS sys_plan_limits (
  plan_code         VARCHAR(50) PRIMARY KEY,
  plan_name         VARCHAR(100) NOT NULL,
  plan_name2        VARCHAR(100),
  orders_limit      INTEGER NOT NULL,
  users_limit       INTEGER NOT NULL,
  branches_limit    INTEGER NOT NULL,
  storage_mb_limit  INTEGER NOT NULL,
  price_monthly     NUMERIC(10,2) NOT NULL,
  price_yearly      NUMERIC(10,2),
  feature_flags     JSONB NOT NULL,
  is_public         BOOLEAN DEFAULT true,
  display_order     INTEGER,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial plans
INSERT INTO sys_plan_limits (plan_code, plan_name, plan_name2, orders_limit, users_limit, branches_limit, storage_mb_limit, price_monthly, price_yearly, feature_flags, display_order) VALUES
('free', 'Free Trial', 'تجربة مجانية', 20, 2, 1, 100, 0, 0, '{"pdf_invoices": false, "whatsapp_receipts": true, "in_app_receipts": false, "printing": false, "b2b_contracts": false, "white_label": false, "marketplace_listings": false, "loyalty_programs": false, "driver_app": false, "multi_branch": false, "advanced_analytics": false, "api_access": false}', 1),
('starter', 'Starter', 'المبتدئ', 100, 5, 1, 500, 29, 290, '{"pdf_invoices": true, "whatsapp_receipts": true, "in_app_receipts": true, "printing": false, "b2b_contracts": false, "white_label": false, "marketplace_listings": false, "loyalty_programs": true, "driver_app": false, "multi_branch": false, "advanced_analytics": false, "api_access": false}', 2),
('growth', 'Growth', 'النمو', 500, 15, 3, 2000, 79, 790, '{"pdf_invoices": true, "whatsapp_receipts": true, "in_app_receipts": true, "printing": true, "b2b_contracts": false, "white_label": false, "marketplace_listings": true, "loyalty_programs": true, "driver_app": true, "multi_branch": true, "advanced_analytics": false, "api_access": false}', 3),
('pro', 'Pro', 'الاحترافي', 2000, 50, 10, 10000, 199, 1990, '{"pdf_invoices": true, "whatsapp_receipts": true, "in_app_receipts": true, "printing": true, "b2b_contracts": true, "white_label": false, "marketplace_listings": true, "loyalty_programs": true, "driver_app": true, "multi_branch": true, "advanced_analytics": true, "api_access": true}', 4),
('enterprise', 'Enterprise', 'المؤسسات', -1, -1, -1, -1, 0, 0, '{"pdf_invoices": true, "whatsapp_receipts": true, "in_app_receipts": true, "printing": true, "b2b_contracts": true, "white_label": true, "marketplace_listings": true, "loyalty_programs": true, "driver_app": true, "multi_branch": true, "advanced_analytics": true, "api_access": true}', 5)
ON CONFLICT (plan_code) DO NOTHING;
```

---

## API Endpoints

### Tenant Registration

#### POST /v1/tenants/register
Register a new tenant with trial subscription.

**Request**:
```json
{
  "businessName": "Laundry Plus",
  "businessNameAr": "لوندري بلس",
  "slug": "laundry-plus",
  "email": "admin@laundryplus.com",
  "phone": "+96890123456",
  "country": "OM",
  "currency": "OMR",
  "timezone": "Asia/Muscat",
  "language": "en",
  "adminUser": {
    "email": "admin@laundryplus.com",
    "password": "SecurePass123!",
    "displayName": "John Admin"
  }
}
```

**Response** (201):
```json
{
  "tenant": {
    "id": "tenant-uuid",
    "name": "Laundry Plus",
    "slug": "laundry-plus",
    "email": "admin@laundryplus.com",
    "status": "trial",
    "plan": "free",
    "trialEnds": "2025-10-24T23:59:59Z",
    "createdAt": "2025-10-10T10:00:00Z"
  },
  "subscription": {
    "id": "sub-uuid",
    "plan": "free",
    "status": "trial",
    "trialEnds": "2025-10-24T23:59:59Z",
    "ordersLimit": 20,
    "ordersUsed": 0
  },
  "user": {
    "id": "user-uuid",
    "email": "admin@laundryplus.com",
    "role": "admin"
  },
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### Tenant Management

#### GET /v1/tenants/me
Get current tenant details (based on JWT context).

**Headers**: `Authorization: Bearer {token}`

**Response** (200):
```json
{
  "id": "tenant-uuid",
  "name": "Laundry Plus",
  "name2": "لوندري بلس",
  "slug": "laundry-plus",
  "email": "admin@laundryplus.com",
  "phone": "+96890123456",
  "address": "Building 123, Muscat",
  "city": "Muscat",
  "country": "OM",
  "currency": "OMR",
  "timezone": "Asia/Muscat",
  "language": "en",
  "logoUrl": "https://storage.cleanmatex.com/tenants/tenant-uuid/logo.png",
  "brandColorPrimary": "#3B82F6",
  "brandColorSecondary": "#10B981",
  "status": "trial",
  "isActive": true,
  "businessHours": {
    "mon": {"open": "08:00", "close": "18:00"},
    "tue": {"open": "08:00", "close": "18:00"},
    "wed": {"open": "08:00", "close": "18:00"},
    "thu": {"open": "08:00", "close": "18:00"},
    "fri": {"open": "08:00", "close": "18:00"},
    "sat": {"open": "09:00", "close": "14:00"},
    "sun": null
  },
  "featureFlags": {
    "pdf_invoices": false,
    "whatsapp_receipts": true,
    "in_app_receipts": false,
    "printing": false,
    "loyalty_programs": false,
    "driver_app": false,
    "multi_branch": false
  },
  "subscription": {
    "plan": "free",
    "status": "trial",
    "trialEnds": "2025-10-24T23:59:59Z",
    "ordersLimit": 20,
    "ordersUsed": 5,
    "usagePercentage": 25
  },
  "createdAt": "2025-10-10T10:00:00Z"
}
```

#### PATCH /v1/tenants/me
Update tenant profile and settings.

**Headers**: `Authorization: Bearer {token}`

**Request**:
```json
{
  "name": "Laundry Plus Premium",
  "name2": "لوندري بلس المتميز",
  "phone": "+96890123457",
  "address": "Building 456, Muscat",
  "city": "Muscat",
  "brandColorPrimary": "#FF6B6B",
  "brandColorSecondary": "#4ECDC4",
  "businessHours": {
    "mon": {"open": "07:00", "close": "20:00"},
    "tue": {"open": "07:00", "close": "20:00"},
    "wed": {"open": "07:00", "close": "20:00"},
    "thu": {"open": "07:00", "close": "20:00"},
    "fri": {"open": "07:00", "close": "20:00"},
    "sat": {"open": "08:00", "close": "16:00"},
    "sun": {"open": "10:00", "close": "14:00"}
  }
}
```

**Response** (200):
```json
{
  "id": "tenant-uuid",
  "name": "Laundry Plus Premium",
  "name2": "لوندري بلس المتميز",
  "brandColorPrimary": "#FF6B6B",
  "businessHours": { /* updated hours */ },
  "updatedAt": "2025-10-10T12:00:00Z"
}
```

#### POST /v1/tenants/me/logo
Upload tenant logo.

**Headers**:
- `Authorization: Bearer {token}`
- `Content-Type: multipart/form-data`

**Request**: Form data with `file` field

**Response** (200):
```json
{
  "logoUrl": "https://storage.cleanmatex.com/tenants/tenant-uuid/logo.png",
  "uploadedAt": "2025-10-10T12:30:00Z"
}
```

### Subscription Management

#### GET /v1/subscriptions/plans
Get available subscription plans.

**Response** (200):
```json
{
  "plans": [
    {
      "code": "free",
      "name": "Free Trial",
      "name2": "تجربة مجانية",
      "ordersLimit": 20,
      "usersLimit": 2,
      "branchesLimit": 1,
      "priceMonthly": 0,
      "priceYearly": 0,
      "features": {
        "pdf_invoices": false,
        "whatsapp_receipts": true,
        "in_app_receipts": false,
        "loyalty_programs": false,
        "driver_app": false,
        "multi_branch": false
      },
      "isCurrentPlan": true
    },
    {
      "code": "starter",
      "name": "Starter",
      "name2": "المبتدئ",
      "ordersLimit": 100,
      "usersLimit": 5,
      "branchesLimit": 1,
      "priceMonthly": 29,
      "priceYearly": 290,
      "features": {
        "pdf_invoices": true,
        "whatsapp_receipts": true,
        "in_app_receipts": true,
        "loyalty_programs": true,
        "driver_app": false,
        "multi_branch": false
      },
      "isCurrentPlan": false
    }
    // ... other plans
  ]
}
```

#### POST /v1/subscriptions/upgrade
Upgrade to a paid plan.

**Headers**: `Authorization: Bearer {token}`

**Request**:
```json
{
  "planCode": "starter",
  "billingCycle": "monthly", // or "yearly"
  "paymentMethodId": "pm_xxx" // from payment gateway
}
```

**Response** (200):
```json
{
  "subscription": {
    "id": "sub-uuid",
    "plan": "starter",
    "status": "active",
    "billingCycle": "monthly",
    "startDate": "2025-10-10T00:00:00Z",
    "endDate": "2025-11-10T23:59:59Z",
    "ordersLimit": 100,
    "ordersUsed": 5
  },
  "payment": {
    "id": "pay-uuid",
    "amount": 29,
    "currency": "OMR",
    "status": "completed",
    "paidAt": "2025-10-10T13:00:00Z"
  },
  "featureFlags": {
    "pdf_invoices": true,
    "whatsapp_receipts": true,
    "in_app_receipts": true,
    "loyalty_programs": true
    // ... updated based on new plan
  }
}
```

#### POST /v1/subscriptions/cancel
Cancel subscription (downgrade at end of billing period).

**Headers**: `Authorization: Bearer {token}`

**Request**:
```json
{
  "reason": "Too expensive for our needs",
  "feedback": "Would like a plan between Starter and Growth"
}
```

**Response** (200):
```json
{
  "subscription": {
    "id": "sub-uuid",
    "plan": "starter",
    "status": "canceling",
    "endsAt": "2025-11-10T23:59:59Z",
    "willDowngradeTo": "free",
    "cancellationDate": "2025-10-10T14:00:00Z"
  },
  "message": "Subscription will be canceled on 2025-11-10. You'll be downgraded to Free plan."
}
```

#### GET /v1/subscriptions/usage
Get current usage metrics.

**Headers**: `Authorization: Bearer {token}`

**Response** (200):
```json
{
  "currentPeriod": {
    "start": "2025-10-01T00:00:00Z",
    "end": "2025-10-31T23:59:59Z"
  },
  "limits": {
    "ordersLimit": 100,
    "usersLimit": 5,
    "branchesLimit": 1,
    "storageMbLimit": 500
  },
  "usage": {
    "ordersCount": 27,
    "ordersPercentage": 27,
    "usersCount": 3,
    "usersPercentage": 60,
    "branchesCount": 1,
    "branchesPercentage": 100,
    "storageMb": 45.7,
    "storagePercentage": 9.14
  },
  "warnings": [
    {
      "type": "approaching_limit",
      "resource": "orders",
      "message": "You've used 27% of your monthly order limit"
    }
  ]
}
```

### Admin Endpoints (System Admin Only)

#### GET /v1/admin/tenants
List all tenants (system admin view).

**Headers**: `Authorization: Bearer {admin_token}`

**Query Parameters**:
- `page`: Page number
- `limit`: Items per page
- `status`: Filter by status (trial, active, canceled, suspended)
- `plan`: Filter by plan code
- `search`: Search by name, email, or slug

**Response** (200):
```json
{
  "tenants": [
    {
      "id": "tenant-uuid-1",
      "name": "Laundry Plus",
      "slug": "laundry-plus",
      "email": "admin@laundryplus.com",
      "status": "active",
      "plan": "starter",
      "ordersUsed": 27,
      "ordersLimit": 100,
      "createdAt": "2025-10-01T10:00:00Z",
      "lastActivityAt": "2025-10-10T08:30:00Z"
    }
    // ... more tenants
  ],
  "pagination": {
    "total": 150,
    "page": 1,
    "limit": 20,
    "totalPages": 8
  }
}
```

#### PATCH /v1/admin/tenants/:tenantId
Update tenant (admin override).

**Headers**: `Authorization: Bearer {admin_token}`

**Request**:
```json
{
  "status": "suspended",
  "featureFlags": {
    "pdf_invoices": true // Override for special deal
  },
  "adminNotes": "Extended trial by 7 days as requested"
}
```

**Response** (200):
```json
{
  "id": "tenant-uuid",
  "status": "suspended",
  "featureFlags": { /* updated */ },
  "updatedAt": "2025-10-10T15:00:00Z"
}
```

---

## UI/UX Requirements

### Tenant Registration Page (Public)
- **Sections**: Business Info, Contact Info, Admin Account
- **Fields**:
  - Business Name (EN/AR)
  - Slug (auto-generated, editable)
  - Email, Phone
  - Country, Currency, Timezone (dropdowns)
  - Admin Email, Password, Display Name
- **Validation**:
  - Slug uniqueness (real-time check)
  - Email uniqueness
  - Password strength
- **Action**: Register → Show welcome message with trial info → Redirect to dashboard
- **Bilingual**: Full EN/AR support

### Tenant Settings Page (Admin)
- **Tabs**: General, Branding, Business Hours, Subscription
- **General Tab**:
  - Business name (EN/AR)
  - Contact info (email, phone, address)
  - Preferences (currency, timezone, language)
- **Branding Tab**:
  - Logo upload (drag & drop)
  - Primary/secondary color pickers
  - Preview section
- **Business Hours Tab**:
  - Weekly schedule editor
  - Per-day open/close times
  - Closed days toggle
- **Subscription Tab**:
  - Current plan display
  - Usage metrics (progress bars)
  - Plan comparison table
  - Upgrade/Downgrade buttons

### Subscription Management
- **Plan Comparison Table**:
  - Features comparison grid
  - Current plan highlighted
  - Popular plan badge
  - Bilingual feature descriptions
- **Upgrade Flow**:
  - Select plan → Review features → Payment → Confirmation
  - Show prorated amount if mid-cycle
- **Cancel Flow**:
  - Reason selection (dropdown + text)
  - Confirmation modal with downgrade date
  - Offer to switch to lower plan instead

### Usage Dashboard Widget
- **Metrics Cards**:
  - Orders (27/100 - 27% used)
  - Users (3/5 - 60% used)
  - Storage (45.7/500 MB - 9% used)
- **Visual**: Progress bars with color coding (green < 70%, yellow 70-90%, red > 90%)
- **Action**: "Upgrade Plan" button if approaching limits

---

## Technical Implementation

### Backend Tasks

1. **Tenant Registration Service**
   - Create `TenantsService` with `register()` method
   - Transaction: Create tenant → Create subscription → Create admin user → Link user to tenant
   - Generate unique slug (with collision handling)
   - Send welcome email with trial info

2. **Subscription Management Service**
   - Create `SubscriptionsService`
   - Methods: `upgrade()`, `downgrade()`, `cancel()`, `renew()`
   - Feature flag update based on plan
   - Usage tracking integration

3. **Usage Tracking Service**
   - Background job (cron: daily at 00:00)
   - Count orders, users, branches per tenant
   - Calculate storage usage (sum of file sizes)
   - Check limits and send warnings if approaching

4. **Plan Limits Enforcement**
   - Create guard: `PlanLimitGuard`
   - Check before creating order/user/branch
   - Return 402 Payment Required if limit exceeded
   - Include upgrade link in error response

5. **Feature Flag Service**
   - Create `FeatureFlagsService`
   - Method: `canAccess(tenantId, feature)`
   - Cache feature flags per tenant (Redis)
   - Decorator: `@RequireFeature('pdf_invoices')`

6. **Logo Upload**
   - Integrate MinIO/S3
   - Image validation (format, size)
   - Generate thumbnail
   - Store URL in tenant record

### Frontend Tasks (Next.js Admin)

1. **Registration Page**
   - Multi-step form (3 steps)
   - Real-time slug validation
   - Password strength indicator
   - Success page with trial countdown

2. **Tenant Settings Pages**
   - Tabbed interface
   - Form with validation
   - Logo upload with preview
   - Color picker component
   - Business hours editor

3. **Subscription Pages**
   - Plan comparison component
   - Pricing cards (monthly/yearly toggle)
   - Upgrade modal with payment form
   - Cancel subscription flow

4. **Usage Dashboard**
   - Metrics cards component
   - Usage progress bars
   - Limit warnings
   - Upgrade CTA

### Database Migrations

```sql
-- Migration: 0005_tenant_enhancements.sql

-- Add new columns to org_tenants_mst
ALTER TABLE org_tenants_mst ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500);
ALTER TABLE org_tenants_mst ADD COLUMN IF NOT EXISTS brand_color_primary VARCHAR(7) DEFAULT '#3B82F6';
ALTER TABLE org_tenants_mst ADD COLUMN IF NOT EXISTS brand_color_secondary VARCHAR(7) DEFAULT '#10B981';
ALTER TABLE org_tenants_mst ADD COLUMN IF NOT EXISTS business_hours JSONB;
ALTER TABLE org_tenants_mst ADD COLUMN IF NOT EXISTS feature_flags JSONB;

-- Create usage tracking table
CREATE TABLE IF NOT EXISTS org_usage_tracking (
  -- as defined above
);

-- Create plan limits table
CREATE TABLE IF NOT EXISTS sys_plan_limits (
  -- as defined above
);

-- Seed plans
INSERT INTO sys_plan_limits (...) VALUES (...);
```

---

## Acceptance Criteria

### Tenant Registration
- [ ] New tenant can register with valid information
- [ ] Slug uniqueness is enforced (duplicate slug rejected)
- [ ] Trial subscription is created automatically (14 days)
- [ ] Admin user is created and linked to tenant
- [ ] Welcome email is sent to admin
- [ ] User is logged in and redirected to dashboard after registration

### Tenant Settings
- [ ] Tenant admin can update business name, contact info
- [ ] Logo upload works (PNG/JPG/SVG, max 2MB)
- [ ] Logo is displayed in header and receipts
- [ ] Brand colors are applied to UI (if supported)
- [ ] Business hours can be configured per day
- [ ] Settings changes are saved and reflected immediately

### Subscription Management
- [ ] Tenant can view current plan and usage
- [ ] Plan comparison table shows accurate features and pricing
- [ ] Upgrade flow completes successfully with payment
- [ ] Feature flags are updated immediately after upgrade
- [ ] Downgrade is scheduled for end of billing period
- [ ] Cancellation workflow captures reason and schedules downgrade

### Usage Tracking & Limits
- [ ] Usage metrics are calculated daily
- [ ] Approaching limit warnings are shown (> 80% usage)
- [ ] Order creation is blocked if monthly limit exceeded
- [ ] User creation is blocked if user limit exceeded
- [ ] Error message includes upgrade link

### Feature Flags
- [ ] Free plan cannot access PDF invoices (blocked in UI and API)
- [ ] Starter plan can access PDF invoices
- [ ] Admin override allows feature flag customization
- [ ] Feature flag changes take effect immediately

### Trial Management
- [ ] Trial expiration notifications sent at 7, 3, 1 days before
- [ ] Tenant auto-downgrades to Free plan after trial ends (if no payment)
- [ ] Trial extension can be applied by admin

---

## Testing Requirements

### Unit Tests

1. **TenantsService**
   - `register()` creates tenant, subscription, and admin user in transaction
   - Slug uniqueness check
   - Feature flags set based on plan

2. **SubscriptionsService**
   - `upgrade()` updates plan and feature flags
   - `cancel()` schedules downgrade
   - Prorated pricing calculation (for upgrades)

3. **FeatureFlagsService**
   - `canAccess()` returns correct value based on plan
   - Override flags take precedence

4. **UsageTrackingService**
   - Daily job calculates accurate usage
   - Limits are enforced correctly

### Integration Tests

1. **Tenant Registration Endpoint**
   - POST /v1/tenants/register → creates tenant, subscription, user
   - Duplicate slug → 409 Conflict
   - Invalid email → 400 Bad Request

2. **Tenant Settings Endpoints**
   - GET /v1/tenants/me → returns correct tenant
   - PATCH /v1/tenants/me → updates tenant
   - POST /v1/tenants/me/logo → uploads logo to storage

3. **Subscription Endpoints**
   - GET /v1/subscriptions/plans → returns plans
   - POST /v1/subscriptions/upgrade → upgrades plan and updates feature flags
   - GET /v1/subscriptions/usage → returns accurate usage

4. **Limit Enforcement**
   - Create orders up to limit → success
   - Create order beyond limit → 402 Payment Required

### E2E Tests (Playwright)

1. **Tenant Registration Journey**
   - Fill registration form → Submit → See welcome page → Redirected to dashboard
   - Dashboard shows trial banner with countdown

2. **Tenant Settings Journey**
   - Navigate to Settings → Update business name → Upload logo → Save → Verify changes

3. **Subscription Upgrade Journey**
   - View usage approaching limit → Click upgrade → Select Starter plan → Complete payment → See updated features

4. **Limit Enforcement Journey**
   - Create orders until limit → Try to create another → See upgrade modal → Upgrade plan → Create order successfully

---

## Deployment Notes

### Environment Variables

```bash
# Storage (MinIO/S3)
STORAGE_ENDPOINT=localhost:9000
STORAGE_ACCESS_KEY=minioadmin
STORAGE_SECRET_KEY=minioadmin123
STORAGE_BUCKET=cleanmatex-assets
STORAGE_REGION=us-east-1

# Email
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASSWORD=${SENDGRID_API_KEY}
SMTP_FROM=noreply@cleanmatex.com

# Trial Settings
TRIAL_DURATION_DAYS=14
TRIAL_REMINDER_DAYS=7,3,1
```

### Database Migrations

```bash
# Apply tenant enhancements migration
psql -U cmx_user -d cmx_db -f supabase/migrations/0005_tenant_enhancements.sql

# Verify plan limits seeded
psql -U cmx_user -d cmx_db -c "SELECT plan_code, plan_name, orders_limit FROM sys_plan_limits;"
```

### Background Jobs

```typescript
// Schedule usage tracking (cron: daily at 00:00)
@Cron('0 0 * * *')
async trackUsage() {
  await this.usageTrackingService.calculateDailyUsage();
}

// Schedule trial expiration check (cron: hourly)
@Cron('0 * * * *')
async checkTrialExpirations() {
  await this.subscriptionsService.processTrialExpirations();
}
```

### Deployment Steps

1. Deploy database migration (tenant enhancements)
2. Seed plan limits (if not exists)
3. Deploy backend with new endpoints
4. Deploy frontend with registration and settings pages
5. Set up cron jobs for usage tracking and trial checks
6. Test registration flow end-to-end
7. Monitor trial expiration emails

---

## References

### Requirements Document
- Section 1: Vision & Scope (multi-tenant SaaS)
- Section 2: KPIs (digital adoption, reliability)
- Section 3.5: Admin / Config (feature flags)
- Addendum B: Dual-Level Configuration Model
- Addendum D: Market Segments Alignment

### Related PRDs
- PRD-001: Authentication (depends on tenant context)
- PRD-003: Customer Management (uses tenant settings)
- PRD-011: PDF Receipts (gated by feature flags)

---

## Notes

### Slug Generation
Slugs are auto-generated from business name (lowercase, replace spaces with hyphens, remove special chars). If collision occurs, append number: `laundry-plus-2`.

### Feature Flag Priority
1. Admin override (if set) → highest priority
2. Plan default (from sys_plan_limits)
3. Fallback to false

### Proration Logic
When upgrading mid-cycle:
- Calculate remaining days in current period
- Apply credit from unused days of old plan
- Charge difference for new plan

### Trial-to-Paid Conversion
- Trial ends → Send final notification
- If no payment → Auto-downgrade to Free plan (limits enforced)
- If payment → Convert to paid, extend end_date by billing cycle

---

**Status**: Ready for Implementation
**Assigned To**: Backend Team + Frontend Team
**Estimated Effort**: 60 hours (1.5 weeks with 2 developers)
