---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Plan Constraints

Plan-bound setting constraints via `sys_plan_setting_constraints`.

**Source:** `supabase/migrations/0074_sys_plan_setting_constraints.sql`, [subscription_limits](../../features/002_tenant_management_dev_prd/subscription_limits.md)

## sys_plan_setting_constraints

| Column | Description |
|--------|-------------|
| plan_code | STARTER, BUSINESS, ENTERPRISE |
| stng_code | Setting code from sys_tenant_settings_cd |
| constraint_type | max_value, min_value, deny |
| constraint_value | JSONB (number for min/max, boolean for deny) |
| constraint_reason | Business reason |

## Constraint Types

| constraint_type | Meaning |
|-----------------|---------|
| max_value | Setting value cannot exceed constraint_value |
| min_value | Setting value cannot be below constraint_value |
| deny | Setting is disabled for plan |

## Example Constraints (from 0074)

| plan_code | stng_code | constraint_type | constraint_value |
|-----------|-----------|-----------------|------------------|
| STARTER | workflow.max_concurrent_orders | max_value | 5 |
| STARTER | workflow.auto_close_days | max_value | 7 |
| STARTER | workflow.advanced_reporting | deny | false |
| STARTER | branches.max_branches | max_value | 1 |
| STARTER | users.max_users | max_value | 3 |
| STARTER | receipts.custom_templates | deny | false |
| STARTER | notifications.sms_enabled | deny | false |

## Tenant Initialization Limits

**Source:** [docs/dev/TENANT_INITIALIZATION.md](../../dev/TENANT_INITIALIZATION.md)

New tenant auto-initialization (trigger `trg_after_tenant_insert`):

- **Subscription:** plan=free, orders_limit=50, orders_used=0, branch_limit=1, user_limit=2
- **Main branch:** Created automatically
- **Service categories:** All active categories enabled

## See Also

- [PLAN_LIMITS_REFERENCE](PLAN_LIMITS_REFERENCE.md)
- [PLAN_BOUND_SETTINGS](../settings/PLAN_BOUND_SETTINGS.md)
- [subscription_limits](../../features/002_tenant_management_dev_prd/subscription_limits.md)
- [TENANT_INITIALIZATION](../../dev/TENANT_INITIALIZATION.md)
