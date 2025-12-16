---
prd_code: PRD-SAAS-MNG-0002
title: Tenant Lifecycle Management
version: v0.1.0
last_updated: 2025-01-14
author: Gehad Abdo Mohammed Ali
status: Planning
priority: Critical
category: Core Platform Management
parent_prd: PRD-SAAS-MNG-0001
---

# PRD-SAAS-MNG-0002: Tenant Lifecycle Management

## Executive Summary

Tenant Lifecycle Management provides comprehensive tools for creating, managing, and monitoring tenant organizations throughout their entire journey on the CleanMateX platform—from initial onboarding through active usage, potential suspension, and eventual offboarding.

### Problem Statement

**Current Gap**: No centralized system for:
- Creating and provisioning new tenant organizations
- Tracking tenant lifecycle stages (trial → active → suspended → churned)
- Monitoring tenant health and engagement
- Managing tenant transitions (upgrades, suspensions, cancellations)
- Automated onboarding workflows
- Churn prediction and prevention

### Solution

Build a comprehensive tenant lifecycle management system within the Platform HQ Console that enables platform administrators to:
1. Create and provision new tenants with automated setup
2. Track tenant journey through defined lifecycle stages
3. Monitor tenant health scores and engagement metrics
4. Manage tenant customizations and branding
5. Handle suspensions, reactivations, and cancellations
6. Predict and prevent churn through early warning signals

---

## 1. Scope & Objectives

### 1.1 In Scope

**Tenant Creation & Provisioning:**
- ✅ Manual tenant creation by platform admins
- ✅ Automated tenant database setup
- ✅ Initial data seeding (default products, settings)
- ✅ Slug validation and uniqueness checks
- ✅ Multi-branch support configuration

**Lifecycle Stage Management:**
- ✅ Trial period tracking
- ✅ Subscription activation
- ✅ Suspension workflows
- ✅ Cancellation and offboarding
- ✅ Churn tracking

**Tenant Health Monitoring:**
- ✅ Health score calculation
- ✅ Engagement metrics tracking
- ✅ Usage pattern analysis
- ✅ Churn prediction scoring
- ✅ Early warning alerts

**Tenant Customization:**
- ✅ Branding management (logo, colors)
- ✅ Business information
- ✅ Regional settings (timezone, currency, language)
- ✅ Feature flag configuration
- ✅ Custom domain setup (future)

**Onboarding Management:**
- ✅ Onboarding checklist tracking
- ✅ Setup wizard progress
- ✅ Welcome emails and resources
- ✅ Training material delivery
- ✅ Initial data import assistance

### 1.2 Out of Scope (Future Phases)

- ❌ Self-service tenant signup (intentionally internal-only)
- ❌ Automated provisioning from public form
- ❌ Tenant-initiated cancellations (admin-controlled)
- ❌ Multi-currency billing (single currency OMR for now)
- ❌ White-label deployments (enterprise future feature)

---

## 2. User Stories

### 2.1 Platform Admin (Super Admin)

**As a platform admin, I want to:**

1. **Create New Tenant**
   - Create a new tenant organization with basic details
   - So that new customers can start using CleanMateX

2. **Configure Tenant Settings**
   - Set up tenant-specific configurations (timezone, currency, features)
   - So that each tenant has appropriate settings for their region

3. **Monitor Tenant Health**
   - View tenant health scores and engagement metrics
   - So that I can proactively address issues before churn

4. **Manage Lifecycle Transitions**
   - Move tenants through lifecycle stages (trial → active, active → suspended)
   - So that I can manage tenant status based on payment and usage

5. **Track Onboarding Progress**
   - See onboarding completion status for each tenant
   - So that I can assist tenants who are stuck during setup

6. **Suspend Non-Paying Tenants**
   - Temporarily suspend tenants with overdue payments
   - So that I can enforce payment requirements while preserving data

7. **Prevent Churn**
   - Receive alerts for at-risk tenants
   - So that I can proactively reach out and retain customers

### 2.2 Support Staff

**As a support staff member, I want to:**

1. **View Tenant Details**
   - Access comprehensive tenant information
   - So that I can provide informed support

2. **Track Onboarding Issues**
   - See where tenants are stuck in onboarding
   - So that I can guide them through setup

3. **Update Tenant Information**
   - Correct tenant business details or settings
   - So that I can resolve data issues

### 2.3 Billing Manager

**As a billing manager, I want to:**

1. **Suspend Overdue Tenants**
   - Automatically suspend tenants with failed payments
   - So that non-paying customers don't continue using the platform

2. **Reactivate Paid Tenants**
   - Quickly reactivate suspended tenants after payment
   - So that paying customers can resume business

3. **Track Subscription Status**
   - View tenant subscription and payment status
   - So that I can manage billing operations effectively

---

## 3. Functional Requirements

### 3.1 Tenant Creation & Provisioning

#### 3.1.1 Create Tenant Form

**UI Components:**
- Organization name (required, bilingual: name/name2)
- Slug (auto-generated from name, editable, validated)
- Business type (dropdown: laundry, dry cleaning, both)
- Contact information (email, phone, address)
- Primary contact person
- Region/Country (default: Oman)
- Timezone (default: Asia/Muscat)
- Currency (default: OMR)
- Default language (EN or AR)
- Initial subscription plan (Free Trial, Starter, Growth, Pro, Enterprise)

**Validation Rules:**
```typescript
interface TenantCreationValidation {
  organization_name: {
    required: true,
    min_length: 2,
    max_length: 250,
    unique: true
  },
  slug: {
    required: true,
    pattern: /^[a-z0-9-]+$/,
    min_length: 3,
    max_length: 50,
    unique: true,
    reserved_slugs: ['admin', 'api', 'platform', 'system', 'support']
  },
  email: {
    required: true,
    format: 'email',
    unique: true
  },
  phone: {
    required: true,
    format: 'E.164' // +968XXXXXXXX
  },
  timezone: {
    required: true,
    valid_tz: true
  },
  currency: {
    required: true,
    valid_currency_code: true
  }
}
```

#### 3.1.2 Automated Provisioning

**When tenant is created, automatically:**

1. **Create Tenant Record:**
```sql
INSERT INTO org_tenants_mst (
  id,
  name,
  name2,
  slug,
  email,
  phone,
  business_type,
  timezone,
  currency_code,
  default_language,
  is_active,
  created_at,
  created_by
) VALUES (...);
```

2. **Create Default Branch:**
```sql
INSERT INTO org_branches_mst (
  tenant_org_id,
  branch_name,
  branch_name2,
  is_main_branch,
  is_active
) VALUES (
  tenant_id,
  'Main Branch',
  'الفرع الرئيسي',
  true,
  true
);
```

3. **Seed Initial Data:**
- Copy default products from `sys_products_init_data_mst` to `org_product_data_mst`
- Enable default service categories in `org_service_category_cf`
- Set default workflow settings in `org_workflow_settings_cf`
- Create default tenant settings in `org_tenant_settings_cf`

4. **Create Subscription:**
```sql
INSERT INTO org_subscriptions_mst (
  tenant_org_id,
  plan_code,
  plan_name,
  status,
  trial_start_date,
  trial_end_date,
  subscription_start_date
) VALUES (
  tenant_id,
  'FREE_TRIAL',
  'Free Trial',
  'trial',
  CURRENT_DATE,
  CURRENT_DATE + INTERVAL '14 days',
  NULL
);
```

5. **Initialize Lifecycle:**
```sql
INSERT INTO sys_tenant_lifecycle (
  tenant_org_id,
  lifecycle_stage,
  onboarding_status,
  onboarding_checklist,
  health_score,
  created_at
) VALUES (
  tenant_id,
  'trial',
  'not_started',
  JSON_BUILD_ARRAY(
    '{"step": "setup_business_info", "completed": false}',
    '{"step": "add_products", "completed": false}',
    '{"step": "create_first_order", "completed": false}',
    '{"step": "configure_branding", "completed": false}',
    '{"step": "invite_team_members", "completed": false}'
  ),
  0.0,
  CURRENT_TIMESTAMP
);
```

6. **Create Welcome Email Job:**
```typescript
await emailQueue.add('send-welcome-email', {
  tenant_id: tenantId,
  email: tenantEmail,
  name: tenantName,
  login_url: `https://${slug}.cleanmatex.com`,
  trial_end_date: trialEndDate
});
```

#### 3.1.3 Slug Generation & Validation

**Auto-Generation Logic:**
```typescript
function generateSlug(organizationName: string): string {
  return organizationName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special chars
    .replace(/\s+/g, '-')         // Spaces to hyphens
    .replace(/-+/g, '-')          // Multiple hyphens to single
    .replace(/^-|-$/g, '')        // Remove leading/trailing hyphens
    .substring(0, 50);            // Max length
}

async function validateSlug(slug: string): Promise<{
  valid: boolean;
  error?: string;
}> {
  // Check format
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return { valid: false, error: 'Slug must contain only lowercase letters, numbers, and hyphens' };
  }

  // Check length
  if (slug.length < 3 || slug.length > 50) {
    return { valid: false, error: 'Slug must be between 3 and 50 characters' };
  }

  // Check reserved slugs
  const reserved = ['admin', 'api', 'platform', 'system', 'support', 'www', 'app'];
  if (reserved.includes(slug)) {
    return { valid: false, error: 'This slug is reserved' };
  }

  // Check uniqueness
  const existing = await db.org_tenants_mst.findOne({ slug });
  if (existing) {
    return { valid: false, error: 'This slug is already taken' };
  }

  return { valid: true };
}
```

### 3.2 Lifecycle Stage Management

#### 3.2.1 Lifecycle Stages

```typescript
enum TenantLifecycleStage {
  TRIAL = 'trial',               // Free trial period (14 days)
  ACTIVE = 'active',             // Paid subscription, active usage
  SUSPENDED = 'suspended',       // Temporarily suspended (payment issues, violations)
  CANCELLED = 'cancelled',       // Subscription cancelled, grace period
  CHURNED = 'churned'           // Completely offboarded, data archived
}
```

**Stage Definitions:**

| Stage | Description | Duration | Data Access | Next Stages |
|-------|-------------|----------|-------------|-------------|
| **Trial** | Free trial period | 14 days (configurable) | Full access | Active, Cancelled |
| **Active** | Paid subscription | Ongoing | Full access | Suspended, Cancelled |
| **Suspended** | Payment overdue or violation | Max 30 days | Read-only | Active, Cancelled |
| **Cancelled** | Subscription ended, grace period | 30 days | Read-only | Churned, Active (reactivation) |
| **Churned** | Fully offboarded | Permanent | No access | None (data archived) |

#### 3.2.2 Stage Transitions

**Trial → Active:**
- **Trigger**: Subscription payment successful
- **Actions**:
  - Update `org_subscriptions_mst.status = 'active'`
  - Set `subscription_start_date = CURRENT_DATE`
  - Update `sys_tenant_lifecycle.lifecycle_stage = 'active'`
  - Send confirmation email
  - Audit log

**Trial → Cancelled:**
- **Trigger**: Trial expires without conversion
- **Actions**:
  - Update `org_subscriptions_mst.status = 'expired'`
  - Update `sys_tenant_lifecycle.lifecycle_stage = 'cancelled'`
  - Disable tenant access (login blocked)
  - Send cancellation email with reactivation offer
  - Schedule data retention reminder (30 days)

**Active → Suspended:**
- **Trigger**: Payment failed, policy violation, manual admin action
- **Actions**:
  - Update `org_subscriptions_mst.status = 'suspended'`
  - Update `sys_tenant_lifecycle.lifecycle_stage = 'suspended'`
  - Set `sys_tenant_lifecycle.suspension_reason`
  - Restrict tenant access (read-only mode)
  - Send suspension notification email
  - Create support ticket automatically
  - Audit log

**Suspended → Active:**
- **Trigger**: Payment resolved, violation resolved, admin reactivation
- **Actions**:
  - Update `org_subscriptions_mst.status = 'active'`
  - Update `sys_tenant_lifecycle.lifecycle_stage = 'active'`
  - Restore full access
  - Clear suspension reason
  - Send reactivation confirmation email
  - Audit log

**Suspended → Cancelled:**
- **Trigger**: Suspension > 30 days, manual cancellation
- **Actions**:
  - Update `org_subscriptions_mst.status = 'cancelled'`
  - Update `sys_tenant_lifecycle.lifecycle_stage = 'cancelled'`
  - Block all access
  - Send final cancellation notice
  - Start 30-day data retention countdown

**Cancelled → Churned:**
- **Trigger**: 30 days after cancellation
- **Actions**:
  - Update `sys_tenant_lifecycle.lifecycle_stage = 'churned'`
  - Set `sys_tenant_lifecycle.cancelled_at = CURRENT_TIMESTAMP`
  - Archive tenant data to cold storage
  - Soft delete tenant records (`is_active = false`)
  - Send final data export (if requested)
  - Audit log

#### 3.2.3 Stage Transition UI

**Platform Admin Dashboard:**
```
┌─────────────────────────────────────────────────────────────┐
│ Tenant: Al-Noor Laundry Services                           │
│ Status: [Active ▼]  Last Active: 2 hours ago               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Current Stage: ACTIVE                                       │
│ Subscription: Growth Plan ($79/month)                       │
│ Next Billing: 2025-02-01 (18 days)                         │
│ Health Score: 85% (Good)                                    │
│                                                             │
│ Actions:                                                    │
│ [Suspend Tenant]  [Change Plan]  [View Details]            │
│                                                             │
│ Suspension Reason (if suspending):                          │
│ ┌──────────────────────────────────────────────────────┐   │
│ │ [ ] Payment overdue                                   │   │
│ │ [ ] Policy violation                                  │   │
│ │ [ ] Security concern                                  │   │
│ │ [ ] Other: ____________________________________       │   │
│ └──────────────────────────────────────────────────────┘   │
│                                                             │
│ [Confirm Suspension]  [Cancel]                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.3 Tenant Health Monitoring

#### 3.3.1 Health Score Calculation

**Health Score (0-100):**

```typescript
interface HealthScoreFactors {
  usage: {
    weight: 0.30,
    metrics: {
      orders_per_week: number,        // Target: >= 10
      active_users_ratio: number,     // Active users / Total users
      feature_adoption: number         // Features used / Features available
    }
  },
  engagement: {
    weight: 0.25,
    metrics: {
      login_frequency: number,        // Logins per week
      last_activity_days: number,     // Days since last activity
      customer_growth: number         // New customers this month
    }
  },
  financial: {
    weight: 0.25,
    metrics: {
      payment_status: boolean,        // Current on payments
      plan_utilization: number,       // Usage vs plan limits
      upgrade_potential: number       // Approaching plan limits
    }
  },
  satisfaction: {
    weight: 0.20,
    metrics: {
      support_tickets: number,        // Open tickets count
      resolved_issues_ratio: number,  // Resolved / Total tickets
      feature_requests: number        // Count of requests
    }
  }
}

function calculateHealthScore(tenant: Tenant): number {
  const scores = {
    usage: calculateUsageScore(tenant),
    engagement: calculateEngagementScore(tenant),
    financial: calculateFinancialScore(tenant),
    satisfaction: calculateSatisfactionScore(tenant)
  };

  return (
    scores.usage * 0.30 +
    scores.engagement * 0.25 +
    scores.financial * 0.25 +
    scores.satisfaction * 0.20
  );
}

function calculateUsageScore(tenant: Tenant): number {
  const ordersPerWeek = tenant.metrics.orders_last_7_days;
  const activeUsersRatio = tenant.active_users / tenant.total_users;
  const featureAdoption = tenant.features_used / tenant.features_available;

  const ordersScore = Math.min(ordersPerWeek / 10, 1) * 100;
  const usersScore = activeUsersRatio * 100;
  const featuresScore = featureAdoption * 100;

  return (ordersScore + usersScore + featuresScore) / 3;
}
```

**Health Score Ranges:**
- **90-100**: Excellent (Green) - Thriving, high engagement
- **75-89**: Good (Green) - Healthy, normal usage
- **50-74**: Fair (Yellow) - Needs attention, declining engagement
- **25-49**: Poor (Orange) - At risk, intervention needed
- **0-24**: Critical (Red) - High churn risk, immediate action required

#### 3.3.2 Churn Prediction

**Churn Risk Score (0-1.00):**

```typescript
interface ChurnPredictionFactors {
  usage_decline: boolean,           // Usage dropped >30% in last 30 days
  no_recent_activity: boolean,      // No orders in 14 days
  payment_issues: boolean,          // Failed payments or overdue
  support_frustration: boolean,     // >3 unresolved tickets
  feature_underutilization: boolean, // Using <30% of paid features
  no_team_expansion: boolean        // Same user count for 90+ days
}

function calculateChurnScore(tenant: Tenant): number {
  const factors = getChurnFactors(tenant);

  let score = 0.0;

  if (factors.usage_decline) score += 0.25;
  if (factors.no_recent_activity) score += 0.20;
  if (factors.payment_issues) score += 0.25;
  if (factors.support_frustration) score += 0.15;
  if (factors.feature_underutilization) score += 0.10;
  if (factors.no_team_expansion) score += 0.05;

  return Math.min(score, 1.0);
}
```

**Churn Risk Levels:**
- **0.0-0.2**: Low risk (Green) - Stable customer
- **0.21-0.5**: Medium risk (Yellow) - Monitor closely
- **0.51-0.75**: High risk (Orange) - Intervention recommended
- **0.76-1.0**: Critical risk (Red) - Immediate action required

**Churn Prevention Actions:**
```typescript
interface ChurnPreventionAction {
  risk_level: 'low' | 'medium' | 'high' | 'critical',
  actions: string[],
  automated: boolean
}

const churnPreventionPlaybook = {
  medium: {
    actions: [
      'Send engagement email with tips',
      'Offer free training session',
      'Check-in call from support'
    ],
    automated: true
  },
  high: {
    actions: [
      'Create priority support ticket',
      'Assign account manager',
      'Offer plan adjustment',
      'Schedule retention call'
    ],
    automated: false // Manual review required
  },
  critical: {
    actions: [
      'Immediate account manager notification',
      'Offer discount or incentive',
      'Executive outreach',
      'Win-back campaign'
    ],
    automated: false
  }
};
```

#### 3.3.3 Health Dashboard UI

```
┌─────────────────────────────────────────────────────────────┐
│ Tenant Health Overview: Al-Noor Laundry Services           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Health Score: 78/100 (Good)                                 │
│ ████████████████████████░░░░░░░░░░  78%                    │
│                                                             │
│ Churn Risk: 0.15 (Low)                                      │
│ ██████░░░░░░░░░░░░░░░░░░░░░░░░░░  15%                      │
│                                                             │
│ Key Metrics:                                                │
│ ┌─────────────────┬──────────────┬─────────────────────┐   │
│ │ Orders (7d)     │ 24           │ ↑ 15% from last week│   │
│ │ Active Users    │ 4/5 (80%)    │ ━ No change         │   │
│ │ Last Activity   │ 3 hours ago  │ ✓ Recent            │   │
│ │ Payment Status  │ Current      │ ✓ Paid              │   │
│ │ Support Tickets │ 1 open       │ ⚠ 1 pending          │   │
│ └─────────────────┴──────────────┴─────────────────────┘   │
│                                                             │
│ Recent Activity Timeline:                                   │
│ • 3 hours ago: Order #1234 created                          │
│ • 1 day ago: User logged in                                 │
│ • 3 days ago: Product added to catalog                      │
│ • 5 days ago: Payment received ($79.00)                     │
│                                                             │
│ [View Full Details]  [View Analytics]  [Contact Tenant]    │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 Tenant Customization

#### 3.4.1 Branding Management

**Customizable Branding Elements:**

```typescript
interface TenantBranding {
  logo_url: string,                 // 500x500px recommended
  logo_small_url: string,           // 100x100px for favicon
  primary_color: string,            // Hex color #RRGGBB
  secondary_color: string,
  accent_color: string,
  background_color: string,
  text_color: string,
  custom_domain: string | null,    // Future: custom.domain.com
  custom_css: string | null,        // Future: Advanced customization
}
```

**Branding Management UI:**
```
┌─────────────────────────────────────────────────────────────┐
│ Tenant Branding: Al-Noor Laundry Services                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Logo                                                        │
│ ┌──────────┐                                                │
│ │   [🖼️]   │  Current Logo                                 │
│ └──────────┘                                                │
│ [Upload New Logo] (Max 2MB, PNG/JPG)                        │
│                                                             │
│ Colors                                                      │
│ Primary:    [#3B82F6] ████                                  │
│ Secondary:  [#8B5CF6] ████                                  │
│ Accent:     [#10B981] ████                                  │
│                                                             │
│ Preview:                                                    │
│ ┌─────────────────────────────────────────────────────┐    │
│ │ [Logo] Welcome to Al-Noor Laundry   [Login]        │    │
│ │ ────────────────────────────────────────────────    │    │
│ │ Dashboard | Orders | Customers                      │    │
│ │                                                     │    │
│ │ [Button Example]  Normal text here                 │    │
│ └─────────────────────────────────────────────────────┘    │
│                                                             │
│ [Save Changes]  [Reset to Defaults]                         │
└─────────────────────────────────────────────────────────────┘
```

#### 3.4.2 Regional Settings

**Configurable Regional Settings:**

```typescript
interface TenantRegionalSettings {
  country_code: string,             // OM, SA, AE, etc.
  timezone: string,                 // Asia/Muscat
  currency_code: string,            // OMR
  currency_symbol: string,          // ر.ع.
  currency_decimals: number,        // 3 for OMR, 2 for most
  date_format: string,              // DD/MM/YYYY, MM/DD/YYYY
  time_format: '12h' | '24h',
  first_day_of_week: 0-6,          // 0=Sunday, 6=Saturday
  default_language: 'en' | 'ar',
  supported_languages: string[],    // ['en', 'ar']
  phone_country_code: string,       // +968
  business_hours: {
    [key: string]: {                // 'monday', 'tuesday', etc.
      open: string,                 // '08:00'
      close: string,                // '22:00'
      closed: boolean
    }
  }
}
```

### 3.5 Onboarding Management

#### 3.5.1 Onboarding Checklist

**Default Onboarding Steps:**

```typescript
interface OnboardingChecklist {
  steps: OnboardingStep[]
}

interface OnboardingStep {
  step_code: string,
  step_name: string,
  step_name_ar: string,
  description: string,
  completed: boolean,
  completed_at: Date | null,
  required: boolean,
  order: number,
  help_url: string
}

const defaultOnboardingSteps: OnboardingStep[] = [
  {
    step_code: 'setup_business_info',
    step_name: 'Setup Business Information',
    step_name_ar: 'إعداد معلومات العمل',
    description: 'Add your business name, address, and contact details',
    completed: false,
    completed_at: null,
    required: true,
    order: 1,
    help_url: '/docs/setup/business-info'
  },
  {
    step_code: 'configure_branding',
    step_name: 'Configure Branding',
    step_name_ar: 'تكوين العلامة التجارية',
    description: 'Upload your logo and set brand colors',
    completed: false,
    completed_at: null,
    required: false,
    order: 2,
    help_url: '/docs/setup/branding'
  },
  {
    step_code: 'add_products',
    step_name: 'Add Products & Services',
    step_name_ar: 'إضافة المنتجات والخدمات',
    description: 'Configure your service catalog and pricing',
    completed: false,
    completed_at: null,
    required: true,
    order: 3,
    help_url: '/docs/setup/products'
  },
  {
    step_code: 'invite_team',
    step_name: 'Invite Team Members',
    step_name_ar: 'دعوة أعضاء الفريق',
    description: 'Add staff members and assign roles',
    completed: false,
    completed_at: null,
    required: false,
    order: 4,
    help_url: '/docs/setup/team'
  },
  {
    step_code: 'create_first_order',
    step_name: 'Create First Order',
    step_name_ar: 'إنشاء أول طلب',
    description: 'Test the system by creating a sample order',
    completed: false,
    completed_at: null,
    required: true,
    order: 5,
    help_url: '/docs/getting-started/first-order'
  },
  {
    step_code: 'configure_workflows',
    step_name: 'Configure Workflows',
    step_name_ar: 'تكوين سير العمل',
    description: 'Customize order workflow stages',
    completed: false,
    completed_at: null,
    required: false,
    order: 6,
    help_url: '/docs/setup/workflows'
  }
];
```

#### 3.5.2 Onboarding Progress Tracking

**Platform Admin View:**

```
┌─────────────────────────────────────────────────────────────┐
│ Onboarding Progress: Al-Noor Laundry Services              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Status: In Progress (50% complete)                          │
│ Started: 2025-01-10 (4 days ago)                            │
│ Last Activity: 2 hours ago                                  │
│                                                             │
│ Progress: ████████████████░░░░░░░░░░░  50%                │
│                                                             │
│ Required Steps:                                             │
│ ✓ Setup Business Information (Jan 10)                       │
│ ✓ Add Products & Services (Jan 11)                          │
│ ✗ Create First Order (Not started)                          │
│                                                             │
│ Optional Steps:                                             │
│ ✓ Configure Branding (Jan 10)                               │
│ ✗ Invite Team Members (Not started)                         │
│ ✗ Configure Workflows (Not started)                         │
│                                                             │
│ Actions:                                                    │
│ [Send Reminder Email]  [Schedule Call]  [Mark Complete]    │
└─────────────────────────────────────────────────────────────┘
```

**Automated Onboarding Reminders:**

```typescript
// Trigger reminder if onboarding stalled
async function checkOnboardingProgress() {
  const stalleddTenants = await db.sys_tenant_lifecycle.find({
    onboarding_status: 'in_progress',
    last_activity_at: { $lt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) } // 3 days
  });

  for (const tenant of stalledTenants) {
    await emailQueue.add('send-onboarding-reminder', {
      tenant_id: tenant.tenant_org_id,
      days_since_activity: daysSince(tenant.last_activity_at),
      incomplete_steps: getIncompleteSteps(tenant.onboarding_checklist)
    });
  }
}
```

---

## 4. Non-Functional Requirements

### 4.1 Performance

| Metric | Target | Rationale |
|--------|--------|-----------|
| Tenant creation time | < 5 seconds | Includes all provisioning steps |
| Health score calculation | < 500ms | Real-time dashboard display |
| Tenant list page load | < 2 seconds | With 1000+ tenants |
| Stage transition | < 1 second | Critical operation |
| Onboarding status update | < 200ms | Frequent operation |

### 4.2 Security

- **Access Control**: Only platform admins with `tenants:*` permission
- **Audit Logging**: All tenant lifecycle changes logged with admin ID, timestamp, reason
- **Data Validation**: Strict input validation on all tenant fields
- **Slug Uniqueness**: Database unique constraint + application validation
- **Soft Deletes**: No hard deletion of tenant data (GDPR compliance)

### 4.3 Reliability

- **Atomicity**: Tenant creation is transactional (all-or-nothing)
- **Idempotency**: Stage transitions can be retried safely
- **Error Handling**: Failed provisioning steps rollback cleanly
- **Data Integrity**: Foreign key constraints enforce referential integrity

### 4.4 Scalability

- **Support for 10,000+ tenants**
- **Health score calculation via background jobs** (not real-time for all)
- **Paginated tenant lists**
- **Indexed database queries** on lifecycle_stage, health_score, created_at

---

## 5. Database Schema

### 5.1 Core Tables

**sys_tenant_lifecycle** (NEW):
```sql
CREATE TABLE sys_tenant_lifecycle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL UNIQUE REFERENCES org_tenants_mst(id) ON DELETE CASCADE,

  -- Lifecycle stage
  lifecycle_stage VARCHAR(50) NOT NULL DEFAULT 'trial',
  CHECK (lifecycle_stage IN ('trial', 'active', 'suspended', 'cancelled', 'churned')),

  -- Onboarding tracking
  onboarding_status VARCHAR(50) DEFAULT 'not_started',
  CHECK (onboarding_status IN ('not_started', 'in_progress', 'completed')),
  onboarding_started_at TIMESTAMP,
  onboarding_completed_at TIMESTAMP,
  onboarding_checklist JSONB DEFAULT '[]'::jsonb,

  -- Suspension details
  suspension_reason TEXT,
  suspended_at TIMESTAMP,
  suspended_by UUID REFERENCES sys_platform_users(id),

  -- Cancellation details
  cancellation_reason TEXT,
  cancelled_at TIMESTAMP,
  cancelled_by UUID REFERENCES sys_platform_users(id),
  data_retention_until DATE, -- When to purge data

  -- Health metrics
  health_score DECIMAL(5,2) DEFAULT 0.00 CHECK (health_score BETWEEN 0 AND 100),
  churn_prediction_score DECIMAL(3,2) CHECK (churn_prediction_score BETWEEN 0 AND 1),
  last_health_calculated_at TIMESTAMP,

  -- Activity tracking
  last_activity_at TIMESTAMP,
  last_order_at TIMESTAMP,
  last_login_at TIMESTAMP,

  -- Audit fields
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP,

  -- Indexes
  INDEX idx_lifecycle_stage (lifecycle_stage),
  INDEX idx_health_score (health_score DESC),
  INDEX idx_churn_score (churn_prediction_score DESC),
  INDEX idx_last_activity (last_activity_at DESC)
);
```

### 5.2 Extended org_tenants_mst

**Add to existing org_tenants_mst:**
```sql
ALTER TABLE org_tenants_mst ADD COLUMN IF NOT EXISTS slug VARCHAR(50) UNIQUE;
ALTER TABLE org_tenants_mst ADD COLUMN IF NOT EXISTS business_type VARCHAR(50);
ALTER TABLE org_tenants_mst ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT false;

-- Branding fields (already exist in current schema)
-- tenant_logo_url, tenant_color1, tenant_color2, tenant_color3, tenant_icon, tenant_image

-- Regional settings
ALTER TABLE org_tenants_mst ADD COLUMN IF NOT EXISTS country_code VARCHAR(2) DEFAULT 'OM';
ALTER TABLE org_tenants_mst ADD COLUMN IF NOT EXISTS phone_country_code VARCHAR(5) DEFAULT '+968';
ALTER TABLE org_tenants_mst ADD COLUMN IF NOT EXISTS date_format VARCHAR(20) DEFAULT 'DD/MM/YYYY';
ALTER TABLE org_tenants_mst ADD COLUMN IF NOT EXISTS time_format VARCHAR(5) DEFAULT '24h';
ALTER TABLE org_tenants_mst ADD COLUMN IF NOT EXISTS first_day_of_week INTEGER DEFAULT 6; -- Saturday for GCC

CREATE UNIQUE INDEX idx_tenant_slug ON org_tenants_mst(slug) WHERE is_active = true;
```

### 5.3 Metrics Aggregation

**sys_tenant_metrics_daily** (NEW - for analytics):
```sql
CREATE TABLE sys_tenant_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id),
  metric_date DATE NOT NULL,

  -- Usage metrics
  orders_created INTEGER DEFAULT 0,
  orders_completed INTEGER DEFAULT 0,
  orders_cancelled INTEGER DEFAULT 0,
  revenue DECIMAL(10,2) DEFAULT 0,
  avg_order_value DECIMAL(10,2) DEFAULT 0,

  -- Customer metrics
  active_customers INTEGER DEFAULT 0,
  new_customers INTEGER DEFAULT 0,

  -- User metrics
  active_users INTEGER DEFAULT 0,
  total_logins INTEGER DEFAULT 0,

  -- Storage metrics
  storage_mb_used DECIMAL(10,2) DEFAULT 0,

  -- API metrics (future)
  api_calls INTEGER DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  UNIQUE(tenant_org_id, metric_date),
  INDEX idx_metrics_date (metric_date DESC),
  INDEX idx_metrics_tenant_date (tenant_org_id, metric_date DESC)
);
```

---

## 6. API Endpoints

### 6.1 Tenant Management

**POST /platform-api/tenants**
- Create new tenant
- Request body: TenantCreationData
- Returns: TenantDetails with provisioning status

**GET /platform-api/tenants**
- List all tenants with filters
- Query params: `stage`, `plan`, `health_min`, `search`, `page`, `limit`
- Returns: Paginated tenant list

**GET /platform-api/tenants/:id**
- Get tenant details
- Returns: Complete tenant information + health + lifecycle

**PATCH /platform-api/tenants/:id**
- Update tenant information
- Request body: Partial tenant data
- Returns: Updated tenant

**POST /platform-api/tenants/:id/suspend**
- Suspend tenant
- Request body: `{ reason: string }`
- Returns: Updated lifecycle status

**POST /platform-api/tenants/:id/reactivate**
- Reactivate suspended tenant
- Returns: Updated lifecycle status

**DELETE /platform-api/tenants/:id**
- Cancel tenant (soft delete)
- Request body: `{ reason: string }`
- Returns: Cancellation confirmation

### 6.2 Lifecycle Management

**GET /platform-api/tenants/:id/lifecycle**
- Get lifecycle details
- Returns: Full lifecycle history and current state

**POST /platform-api/tenants/:id/lifecycle/transition**
- Trigger lifecycle stage transition
- Request body: `{ to_stage: string, reason: string }`
- Returns: Updated lifecycle state

**GET /platform-api/tenants/:id/health**
- Get tenant health metrics
- Returns: Health score breakdown + churn prediction

**POST /platform-api/tenants/:id/health/recalculate**
- Trigger health score recalculation
- Returns: New health score

### 6.3 Onboarding Management

**GET /platform-api/tenants/:id/onboarding**
- Get onboarding progress
- Returns: Checklist with completion status

**POST /platform-api/tenants/:id/onboarding/complete-step**
- Mark onboarding step complete
- Request body: `{ step_code: string }`
- Returns: Updated checklist

**POST /platform-api/tenants/:id/onboarding/send-reminder**
- Send onboarding reminder email
- Returns: Email sent confirmation

---

## 7. UI/UX Design

### 7.1 Tenant List Page

**URL**: `/platform-admin/tenants`

**Components**:
- Search bar (by name, email, slug)
- Filters (stage, plan, health score range)
- Sortable columns (name, created_at, health_score)
- Pagination
- Bulk actions (export, suspend multiple)

**Tenant Card Display**:
```
┌────────────────────────────────────────────────────────┐
│ Al-Noor Laundry Services                     [Active]  │
│ alnoor-laundry                                          │
│                                                        │
│ Plan: Growth ($79/mo) | Health: 78% | Churn: Low     │
│ Created: Jan 5, 2025 | Last Active: 2 hours ago      │
│                                                        │
│ [View Details] [Impersonate] [Manage]                 │
└────────────────────────────────────────────────────────┘
```

### 7.2 Tenant Detail Page

**URL**: `/platform-admin/tenants/:id`

**Tabs**:
1. **Overview** - Summary, health, metrics
2. **Lifecycle** - Stage history, transitions
3. **Subscription** - Plan, billing, usage
4. **Onboarding** - Checklist, progress
5. **Settings** - Branding, regional settings
6. **Activity** - Recent orders, logins, changes
7. **Support** - Tickets, communications
8. **Audit Log** - All platform admin actions

### 7.3 Health Dashboard

**URL**: `/platform-admin/tenants/:id/health`

**Widgets**:
- Health score gauge
- Churn risk meter
- Usage trend chart (30 days)
- Engagement metrics
- Early warning indicators
- Recommended actions

---

## 8. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Tenant Provisioning Time | < 5 seconds | Average time from creation to ready |
| Onboarding Completion Rate | > 80% | % of tenants completing required steps |
| Average Onboarding Duration | < 7 days | Median time to complete onboarding |
| Churn Prediction Accuracy | > 70% | % of predicted churns that actually churn |
| Health Score Correlation | > 0.7 | Correlation between score and retention |
| Trial-to-Paid Conversion | > 30% | % of trial tenants converting to paid |

---

## 9. Implementation Plan

### Phase 1: Foundation (Week 1-2)
- ✅ Create `sys_tenant_lifecycle` table
- ✅ Extend `org_tenants_mst` with new fields
- ✅ Implement slug generation and validation
- ✅ Build tenant creation flow
- ✅ Automated provisioning logic

### Phase 2: Lifecycle Management (Week 3-4)
- ✅ Implement stage transition logic
- ✅ Build lifecycle management UI
- ✅ Suspension/reactivation flows
- ✅ Cancellation and offboarding

### Phase 3: Health & Onboarding (Week 5-6)
- ✅ Health score calculation algorithm
- ✅ Churn prediction model
- ✅ Onboarding checklist system
- ✅ Progress tracking UI

### Phase 4: Monitoring & Alerts (Week 7-8)
- ✅ Health dashboard
- ✅ Churn risk alerts
- ✅ Automated reminder emails
- ✅ Platform admin notifications

---

## 10. Related PRDs

- [PRD-SAAS-MNG-0001: Platform HQ Console (Master)](PRD-SAAS-MNG-0001_Platform_HQ_Console.md)
- [PRD-SAAS-MNG-0003: Billing & Subscription Management](PRD-SAAS-MNG-0003_Billing_Subscriptions.md)
- [PRD-SAAS-MNG-0004: Analytics & Reporting](PRD-SAAS-MNG-0004_Analytics_Reporting.md)
- [PRD-SAAS-MNG-0005: Support & Ticketing](PRD-SAAS-MNG-0005_Support_Ticketing.md)

---

**End of PRD-SAAS-MNG-0002**
