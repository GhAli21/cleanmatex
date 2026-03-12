---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Subscription UI

Subscription page, upgrade flow, and plan limits settings.

**Source:** `web-admin/app/dashboard/subscription/page.tsx`, `web-admin/src/features/settings/ui/PlanLimitsSettings.tsx`, `web-admin/app/api/v1/subscriptions/upgrade/route.ts`

## Subscription Page

**Route:** `/dashboard/subscription`  
**File:** `web-admin/app/dashboard/subscription/page.tsx`

### Data Sources

| API | Purpose |
|-----|---------|
| GET /api/v1/subscriptions/plans | Plan comparison, current plan |
| GET /api/v1/subscriptions/usage | Usage metrics |
| GET /api/v1/tenants/me | Tenant info |

### Features

- Plan comparison cards with feature_flags (pdf_invoices, whatsapp_receipts, driver_app, multi_branch, api_access, advanced_analytics)
- Usage metrics (orders, users, branches)
- Upgrade modal: select plan, billing cycle (monthly/yearly)
- Cancel subscription modal

### Upgrade Flow

1. User clicks upgrade on plan card
2. Modal opens with selected plan
3. POST /api/v1/subscriptions/upgrade with `{ planCode, billingCycle }`
4. subscriptions.service.upgradeSubscription updates org_subscriptions_mst, org_tenants_mst.feature_flags
5. Response includes updated subscription and feature_flags

## Upgrade API

**Route:** POST /api/v1/subscriptions/upgrade  
**File:** `web-admin/app/api/v1/subscriptions/upgrade/route.ts`

- **Auth:** Requires session with tenant_org_id
- **Body:** `{ planCode: string, billingCycle: 'monthly' | 'yearly' }`
- **Valid plans:** starter, growth, pro, enterprise
- **Response:** `{ success, data: { subscription, featureFlags }, message }`

## PlanLimitsSettings

**File:** `web-admin/src/features/settings/ui/PlanLimitsSettings.tsx`

- Shown in Settings → All Settings (Plan Limits tab/section)
- Displays plan limits and usage
- **Location:** `web-admin/app/dashboard/settings/allsettings/page.tsx` — `PlanLimitsSettings` in settings content

## See Also

- [PLAN_LIMITS_REFERENCE](PLAN_LIMITS_REFERENCE.md)
- [PLAN_LIMITS_USAGE](PLAN_LIMITS_USAGE.md)
- [TENANT_AND_PLAN_FLAGS](../feature_flags/TENANT_AND_PLAN_FLAGS.md)
