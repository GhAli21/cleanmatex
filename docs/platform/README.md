---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Platform Documentation

Central reference for platform-level configuration across the CleanMateX codebase.

## Contents

### Permissions
- [PERMISSIONS_REFERENCE](permissions/PERMISSIONS_REFERENCE.md) — All permission codes, descriptions, role assignments
- [PERMISSIONS_BY_MODULE](permissions/PERMISSIONS_BY_MODULE.md) — Grouped by module (orders, customers, etc.)
- [PERMISSIONS_BY_SCREEN](permissions/PERMISSIONS_BY_SCREEN.md) — Per screen/route with required permissions
- [PERMISSIONS_BY_API](permissions/PERMISSIONS_BY_API.md) — Per API route with required permissions
- [NAVIGATION_PERMISSIONS](permissions/NAVIGATION_PERMISSIONS.md) — sys_components_cd main_permission_code, roles
- [WORKFLOW_SCREEN_CONTRACTS](permissions/WORKFLOW_SCREEN_CONTRACTS.md) — org_ord_screen_contracts_cf required_permissions
- [WORKFLOW_ROLES](permissions/WORKFLOW_ROLES.md) — Workflow roles (ROLE_ADMIN, ROLE_RECEPTION, etc.)
- [ROLE_BASED_GUARDS](permissions/ROLE_BASED_GUARDS.md) — withRole, role-based vs permission-based
- [API_AUTH_GAPS](permissions/API_AUTH_GAPS.md) — Routes with auth-only (no permission check)
- [SERVER_ACTIONS_AND_RLS](permissions/SERVER_ACTIONS_AND_RLS.md) — Server actions, RLS, resource-scoped
- [CMX_API_PERMISSIONS](permissions/CMX_API_PERMISSIONS.md) — cmx-api NestJS guards
- [ADMIN_APIS](permissions/ADMIN_APIS.md) — Navigation, roles, permissions admin APIs

### Settings
- [SETTINGS_REFERENCE](settings/SETTINGS_REFERENCE.md) — Human-readable catalog (extends Allsettings.md)
- [SETTINGS_BY_CATEGORY](settings/SETTINGS_BY_CATEGORY.md) — Grouped by stng_category_code
- [SETTINGS_USAGE](settings/SETTINGS_USAGE.md) — Where each setting is used in code
- [PLAN_BOUND_SETTINGS](settings/PLAN_BOUND_SETTINGS.md) — sys_plan_setting_constraints
- [SETTINGS_HQ_API](settings/SETTINGS_HQ_API.md) — HQ API, settings-client

### Feature Flags
- [FEATURE_FLAGS_REFERENCE](feature_flags/FEATURE_FLAGS_REFERENCE.md) — All flags, plan mappings, descriptions
- [FEATURE_FLAGS_USAGE](feature_flags/FEATURE_FLAGS_USAGE.md) — Where each flag is checked in code
- [NAVIGATION_FEATURE_FLAGS](feature_flags/NAVIGATION_FEATURE_FLAGS.md) — sys_components_cd.feature_flag
- [TENANT_AND_PLAN_FLAGS](feature_flags/TENANT_AND_PLAN_FLAGS.md) — org_tenants_mst, sys_plan_limits JSON flags

### Plan Limits
- [PLAN_LIMITS_REFERENCE](plan_limits/PLAN_LIMITS_REFERENCE.md) — Plans, limits, constraints
- [PLAN_LIMITS_USAGE](plan_limits/PLAN_LIMITS_USAGE.md) — Where limits are enforced
- [PLAN_CONSTRAINTS](plan_limits/PLAN_CONSTRAINTS.md) — sys_plan_setting_constraints
- [SUBSCRIPTION_UI](plan_limits/SUBSCRIPTION_UI.md) — Subscription page, upgrade flow

## Maintenance

- Run extraction scripts after significant permission/API/settings changes: `npm run docs:extract-permissions`, etc.
- When adding new features, update both feature-level `implementation_requirements.md` and platform docs (or rely on extraction)
