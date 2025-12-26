# PRD-SAAS-MNG-0002: Plans & Subscriptions Management

**Version:** 1.0  
**Status:** Draft  
**Owner:** Jehad Ali (Jh Apps HQ)  
**Priority:** Phase 1 - Critical

---

## Overview & Purpose

This PRD defines the plan and subscription management system for the CleanMateX HQ Console. It enables HQ team to define subscription plans, assign plans to tenants, manage subscriptions, and enforce usage limits.

**Business Value:**
- Centralized plan management
- Flexible subscription assignment and modification
- Usage tracking and limit enforcement
- Revenue tracking and billing insights
- Trial period management

---

## Functional Requirements

### FR-PLAN-001: Plan Definition Management
- **Description**: Create and manage subscription plan definitions
- **Acceptance Criteria**:
  - Create plans: freemium, basic, pro, plus, enterprise
  - Define plan limits (orders, users, branches, storage)
  - Configure feature flags per plan
  - Set pricing (monthly/yearly)
  - Plan versioning support

### FR-PLAN-002: Subscription Assignment
- **Description**: Assign subscriptions to tenants
- **Acceptance Criteria**:
  - Assign plan to tenant during creation
  - Change tenant's plan (upgrade/downgrade)
  - Set custom limits for specific tenants
  - Trial period configuration
  - Subscription start/end dates

### FR-PLAN-003: Subscription Approval Workflow
- **Description**: Approval process for subscription changes
- **Acceptance Criteria**:
  - Submit subscription change for approval
  - Approve/reject subscription changes
  - Approval history tracking
  - Email notifications for approvals

### FR-PLAN-004: Usage Tracking
- **Description**: Track tenant usage against limits
- **Acceptance Criteria**:
  - Real-time usage counters
  - Usage vs limits visualization
  - Usage alerts when approaching limits
  - Historical usage data

### FR-PLAN-005: Limit Enforcement
- **Description**: Enforce plan limits on tenant operations
- **Acceptance Criteria**:
  - Check limits before operations
  - Block operations when limits exceeded
  - Graceful limit exceeded messages
  - Override capability for HQ users

### FR-PLAN-006: Billing Cycle Management
- **Description**: Manage subscription billing cycles
- **Acceptance Criteria**:
  - Set billing cycle (monthly/yearly)
  - Track next billing date
  - Handle subscription renewals
  - Proration for mid-cycle changes

### FR-PLAN-007: Trial Period Management
- **Description**: Manage trial periods for tenants
- **Acceptance Criteria**:
  - Set trial duration (default 14 days)
  - Track trial expiration
  - Auto-convert trial to paid
  - Trial expiration notifications

---

## Technical Requirements

### Database Schema

#### sys_plan_subscriptions_types_cf
```sql
CREATE TABLE sys_plan_subscriptions_types_cf (
  plan_code VARCHAR(50) PRIMARY KEY,
  plan_name VARCHAR(250) NOT NULL,
  plan_name2 VARCHAR(250), -- Arabic
  plan_description TEXT,
  plan_description2 TEXT,
  price_monthly DECIMAL(10,2) DEFAULT 0,
  price_yearly DECIMAL(10,2) DEFAULT 0,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);
```

#### sys_plan_limits_cf
```sql
CREATE TABLE sys_plan_limits_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code VARCHAR(50) NOT NULL REFERENCES sys_plan_subscriptions_types_cf(plan_code),
  limit_type VARCHAR(50) NOT NULL, -- orders, users, branches, storage
  limit_value INTEGER NOT NULL, -- -1 for unlimited
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plan_code, limit_type)
);
```

#### sys_features_code_cd
```sql
CREATE TABLE sys_features_code_cd (
  feature_code VARCHAR(50) PRIMARY KEY,
  feature_name VARCHAR(250) NOT NULL,
  feature_name2 VARCHAR(250),
  feature_description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### sys_plan_features_cf
```sql
CREATE TABLE sys_plan_features_cf (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code VARCHAR(50) NOT NULL REFERENCES sys_plan_subscriptions_types_cf(plan_code),
  feature_code VARCHAR(50) NOT NULL REFERENCES sys_features_code_cd(feature_code),
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plan_code, feature_code)
);
```

#### org_subscriptions_mst
```sql
CREATE TABLE org_subscriptions_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id),
  plan_code VARCHAR(50) NOT NULL REFERENCES sys_plan_subscriptions_types_cf(plan_code),
  status VARCHAR(20) DEFAULT 'trial', -- trial, active, expired, cancelled
  orders_limit INTEGER DEFAULT 20,
  orders_used INTEGER DEFAULT 0,
  users_limit INTEGER DEFAULT 2,
  branches_limit INTEGER DEFAULT 1,
  storage_mb_limit INTEGER DEFAULT 100,
  start_date DATE NOT NULL,
  end_date DATE,
  trial_ends DATE,
  next_billing_date DATE,
  auto_renew BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ
);
```

---

## API Endpoints

### Plans Management

#### List Plans
```
GET /api/hq/v1/plans
Response: { data: Plan[] }
```

#### Create Plan
```
POST /api/hq/v1/plans
Body: { plan_code, plan_name, plan_name2, price_monthly, ... }
Response: { success: boolean, data: Plan }
```

#### Update Plan
```
PATCH /api/hq/v1/plans/:code
Body: { ...partial plan fields }
Response: { success: boolean, data: Plan }
```

### Subscription Management

#### Get Tenant Subscription
```
GET /api/hq/v1/tenants/:id/subscription
Response: { data: Subscription }
```

#### Assign Subscription
```
POST /api/hq/v1/tenants/:id/subscription
Body: { plan_code, start_date, trial_days?, custom_limits? }
Response: { success: boolean, data: Subscription }
```

#### Update Subscription
```
PATCH /api/hq/v1/tenants/:id/subscription
Body: { plan_code?, custom_limits?, end_date? }
Response: { success: boolean, data: Subscription }
```

#### Approve Subscription
```
POST /api/hq/v1/tenants/:id/subscription/approve
Body: { approved: boolean, notes? }
Response: { success: boolean, message: string }
```

#### Activate Subscription
```
POST /api/hq/v1/tenants/:id/subscription/activate
Response: { success: boolean, message: string }
```

#### Stop Subscription
```
POST /api/hq/v1/tenants/:id/subscription/stop
Body: { reason?: string }
Response: { success: boolean, message: string }
```

#### Get Usage Statistics
```
GET /api/hq/v1/tenants/:id/usage
Response: {
  orders: { used, limit, percentage },
  users: { used, limit, percentage },
  branches: { used, limit, percentage },
  storage: { used_mb, limit_mb, percentage }
}
```

---

## UI/UX Requirements

### Plans Management Page
- **List View**: Table of all plans with details
- **Plan Cards**: Visual representation of plan features
- **Edit Form**: Inline or modal editing
- **Feature Matrix**: Compare plans side-by-side

### Subscription Management Page
- **Tenant Subscription View**: Current plan, limits, usage
- **Plan Change Interface**: Upgrade/downgrade flow
- **Usage Dashboard**: Visual usage vs limits
- **Billing Information**: Billing cycle, next payment

---

## Security Considerations

1. **Plan Changes**: Require approval for plan changes
2. **Limit Overrides**: Only super admins can override limits
3. **Audit Trail**: All subscription changes logged
4. **Data Validation**: Validate limits and dates

---

## Testing Requirements

- Unit tests for plan definitions
- Integration tests for subscription assignment
- E2E tests for subscription workflow
- Usage tracking tests
- Limit enforcement tests

---

## Implementation Checklist

- [ ] Create plan definition tables
- [ ] Seed default plans (freemium, basic, pro, plus, enterprise)
- [ ] Implement plan CRUD API
- [ ] Implement subscription assignment API
- [ ] Implement usage tracking functions
- [ ] Implement limit enforcement middleware
- [ ] Create plans management UI
- [ ] Create subscription management UI
- [ ] Add approval workflow
- [ ] Add usage dashboard
- [ ] Write tests
- [ ] Documentation

---

**Related PRDs:**
- PRD-SAAS-MNG-0001: Tenant Lifecycle Management
- PRD-SAAS-MNG-0018: Licensing & Entitlements

