---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# [Feature Name] — Implementation Requirements

> Copy this template when implementing a new feature. Fill in each section; mark N/A if not applicable.
> See [docs/platform/README.md](../../platform/README.md) for platform-level reference docs.

## Permissions

- `[resource]:[action]` — Description
- Add to `sys_auth_permissions` and assign to roles via `sys_auth_role_default_permissions`
- See [PERMISSIONS_REFERENCE](../../platform/permissions/PERMISSIONS_REFERENCE.md)

## Navigation Tree

- Screen/menu item path
- Add to `sys_components_cd` with `main_permission_code`, `roles`, `feature_flag` if gated
- See [NAVIGATION_PERMISSIONS](../../platform/permissions/NAVIGATION_PERMISSIONS.md)

## Tenant Settings

- `SETTING_CODE` — Description
- Add to `sys_tenant_settings_cd`; use `stng_category_code`, `stng_depends_on_flags` if plan-bound
- See [SETTINGS_REFERENCE](../../platform/settings/SETTINGS_REFERENCE.md)

## Feature Flags

- `flag_key` — Description (plan mapping if applicable)
- Add to `hq_ff_feature_flags_mst` and `sys_ff_pln_flag_mappings_dtl` if plan-bound
- **Plan-bound vs tenant settings:** Plan-bound flags (e.g. `bundles_enabled`, `repeat_last_order`) use `plan-flags.service.ts` and `hq_ff_get_effective_value` RPC; tenant settings use `sys_tenant_settings_cd` and `useTenantSettingsWithDefaults`
- See [FEATURE_FLAGS_REFERENCE](../../platform/feature_flags/FEATURE_FLAGS_REFERENCE.md), [PLAN_FLAGS_IMPLEMENTATION](../../platform/feature_flags/PLAN_FLAGS_IMPLEMENTATION.md)

## Plan Limits

- New limit type or constraint (if applicable)
- See [PLAN_LIMITS_REFERENCE](../../platform/plan_limits/PLAN_LIMITS_REFERENCE.md)

## i18n Keys

- `namespace.key` — Description
- Search existing keys in `en.json` / `ar.json` before adding
- See [i18n skill](../../../.claude/skills/i18n/SKILL.md)

## API Routes

- `METHOD /api/v1/[path]` — Description
- Document required permissions; use `requirePermission` or `requireTenantAuth`
- See [PERMISSIONS_BY_API](../../platform/permissions/PERMISSIONS_BY_API.md), [API_AUTH_GAPS](../../platform/permissions/API_AUTH_GAPS.md)

## Migrations

- `[version]_[descriptive_name].sql` — Description
- Use next migration version from `supabase/migrations/`

## Constants & Types

- `lib/constants/[domain].ts`
- `lib/types/[domain].ts`
- Re-export from constants; do not duplicate

## RBAC / Role Changes

- Role-permission mappings (if applicable)

## Environment Variables

- `VAR_NAME` — Description (if applicable)
