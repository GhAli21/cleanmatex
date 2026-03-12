---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Plan Limits Reference

Subscription plan limits from `sys_plan_limits`.

**Source:** `sys_plan_limits` table, migrations 0006, 0008 (archive), `web-admin/lib/services/subscriptions.service.ts`

## sys_plan_limits Columns

| Column | Type | Description |
|--------|------|-------------|
| plan_code | TEXT PK | FREE_TRIAL, STARTER, GROWTH, PRO, ENTERPRISE |
| plan_name, plan_name2 | TEXT | Display name (EN/AR) |
| orders_limit | INTEGER | Max orders per month (-1 = unlimited) |
| users_limit | INTEGER | Max active users (-1 = unlimited) |
| branches_limit | INTEGER | Max branches (-1 = unlimited) |
| storage_mb_limit | INTEGER | Max storage in MB (-1 = unlimited) |
| feature_flags | JSONB | Features enabled in plan |
| price_monthly, price_yearly | NUMERIC | Pricing |
| is_public | BOOLEAN | Visible to customers |
| display_order | INTEGER | Display order |

## Plan Tiers (Typical)

| plan_code | orders_limit | users_limit | branches_limit |
|-----------|--------------|-------------|----------------|
| FREE_TRIAL | 50 | 2 | 1 |
| STARTER | 100 | 5 | 1 |
| GROWTH | 500 | 10 | 3 |
| PRO | 2000 | 25 | 10 |
| ENTERPRISE | -1 | -1 | -1 |

*Actual values from migrations; -1 = unlimited.*

## org_subscriptions_mst

Subscription record per tenant:

| Column | Description |
|--------|-------------|
| plan | Current plan code |
| orders_limit, orders_used | Order usage |
| branch_limit, user_limit | Limits (from plan at upgrade) |
| status | trial, active, cancelled, etc. |

## org_usage_tracking

Monthly usage snapshot:

| Column | Description |
|--------|-------------|
| orders_count | Orders in period |
| users_count | Active users |
| branches_count | Active branches |
| storage_mb | Storage used |
| period_start, period_end | Billing period |

## See Also

- [PLAN_LIMITS_USAGE](PLAN_LIMITS_USAGE.md)
- [PLAN_CONSTRAINTS](PLAN_CONSTRAINTS.md)
- [SUBSCRIPTION_UI](SUBSCRIPTION_UI.md)
- [docs/features/002_tenant_management_dev_prd/subscription_limits.md](../../features/002_tenant_management_dev_prd/subscription_limits.md)
