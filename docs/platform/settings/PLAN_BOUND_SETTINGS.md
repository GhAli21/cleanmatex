---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Plan-Bound Settings

Settings constrained by subscription plan via `sys_plan_setting_constraints`.

**Source:** `supabase/migrations/0074_sys_plan_setting_constraints.sql`, `0117_sys_tenant_settings_edit_policy.sql`, `0115_sys_tenant_settings_cd_required_columns.sql`

## Constraint Types

| constraint_type | Description |
|-----------------|-------------|
| max_value | Maximum allowed value (e.g., workflow.max_concurrent_orders ≤ 5 for STARTER) |
| min_value | Minimum allowed value |
| deny | Setting disabled for plan |

## Example Constraints (from migration 0074)

| plan_code | stng_code | constraint_type | constraint_value |
|-----------|-----------|-----------------|-------------------|
| STARTER | workflow.max_concurrent_orders | max_value | 5 |
| STARTER | workflow.auto_close_days | max_value | 7 |
| STARTER | workflow.advanced_reporting | deny | false |
| STARTER | branches.max_branches | max_value | 1 |
| STARTER | users.max_users | max_value | 3 |
| STARTER | receipts.custom_templates | deny | false |
| STARTER | notifications.sms_enabled | deny | false |

## stng_edit_policy

From `0117_sys_tenant_settings_edit_policy.sql`:

- **FREELY_EDITABLE** — No plan restriction
- **plan_bound** — Constrained by `sys_plan_setting_constraints`

## stng_required_min_layer

From `0115_sys_tenant_settings_cd_required_columns.sql` — minimum resolution layer for override.

## Usage

Plan constraints are enforced when:
- Tenant tries to set an override that violates plan limits
- UI hides or disables settings not available for plan
- Resolution applies constraints during `fn_stng_resolve_*`

## See Also

- [SETTINGS_REFERENCE](SETTINGS_REFERENCE.md)
- [PLAN_LIMITS_REFERENCE](../plan_limits/PLAN_LIMITS_REFERENCE.md)
- [docs/features/002_tenant_management_dev_prd/subscription_limits.md](../../features/002_tenant_management_dev_prd/subscription_limits.md)
