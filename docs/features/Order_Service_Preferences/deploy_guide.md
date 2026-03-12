---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Order Service Preferences — Deploy Guide

## Prerequisites

- Supabase project with migrations applied
- Tenant with valid plan (FREE_TRIAL, STARTER, GROWTH, PRO, ENTERPRISE)
- Permissions inserted: `orders:service_prefs_view`, `orders:service_prefs_edit`, `config:preferences_manage`, `customers:preferences_manage`

## Deployment Steps

### 1. Database Migrations

Apply migrations in order (user applies manually; do not run `supabase db reset`):

```bash
# Migrations to apply (in sequence):
# 0139_order_service_preferences_schema.sql
# 0140_order_service_preferences_flags_settings.sql
# 0141_navigation_catalog_preferences.sql
# 0142_* (get_last_order_preferences, suggest_preferences_from_history)
# 0144_add_service_pref_processing_confirmation_setting.sql
```

Use your normal migration workflow (e.g., `supabase db push` or apply via Supabase dashboard).

### 2. Prisma Sync

After migrations are applied:

```bash
cd web-admin
npx prisma generate
```

### 3. Feature Flags and Plan Mappings

Ensure `hq_ff_feature_flags_mst` and `sys_ff_pln_flag_mappings_dtl` contain entries for:

- `service_preferences_enabled`, `packing_preferences_enabled`
- `per_piece_packing`, `per_piece_service_prefs` (Enterprise)
- `customer_standing_prefs`, `bundles_enabled`, `smart_suggestions`
- `sla_adjustment`, `repeat_last_order`, `processing_confirmation`

Migration 0140 seeds these; verify they exist for your plans.

### 4. Tenant Settings

Ensure `sys_tenant_settings_cd` has SERVICE_PREF category and settings:

- `SERVICE_PREF_DEFAULT_PACKING`
- `SERVICE_PREF_ENFORCE_COMPATIBILITY`
- `SERVICE_PREF_PROCESSING_CONFIRMATION` (Migration 0144)
- Others as needed

### 5. Permissions

Insert permissions per `docs/master_data/Permissions_To_InsertTo_DB.sql` and assign to roles:

- `orders:service_prefs_view`, `orders:service_prefs_edit`
- `config:preferences_manage`, `customers:preferences_manage`

### 6. Navigation Tree

Add Preferences catalog screen to `sys_comp` / navigation tree if not already present (Migration 0141).

### 7. Build and Verify

```bash
cd web-admin
npm run build
npm run test -- __tests__/features/orders/order-item-helpers.test.ts __tests__/validations/service-preferences-schemas.test.ts
```

## Rollback

- Migrations are additive; rollback requires manual reverse migrations (e.g., drop new tables, remove columns).
- Feature flags can be disabled to hide the feature without schema changes.

## Environment Variables

No new environment variables required for Service Preferences. Uses existing Supabase and tenant context.
