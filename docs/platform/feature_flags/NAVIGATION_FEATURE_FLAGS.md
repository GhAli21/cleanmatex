---
version: v1.1.0
last_updated: 2026-03-15
author: CleanMateX Team
---

# Navigation Feature Flags

Navigation items gated by `sys_components_cd.feature_flag`.

**Source:** `supabase/migrations/0058_sys_components_cd_navigation.sql`, `0059_navigation_seed.sql`, `0141_navigation_catalog_preferences.sql`, `web-admin/lib/services/navigation.service.ts`

## Schema

| Column | Type | Description |
|--------|------|-------------|
| sys_components_cd.feature_flag | JSONB | Array of flag keys; item visible only if tenant has at least one enabled |

## Resolution

- `fn_sys_nav_tree_visible_items(p_tenant_id, p_branch_id, p_user_id, p_feature_flags)` receives `p_feature_flags` as JSONB array.
- If `c.feature_flag` is NULL or `[]`, item is not gated by flags.
- If `c.feature_flag` has values, at least one must be in `p_feature_flags` for the item to be visible.

**Logic (from 0058):**
```sql
(c.feature_flag IS NULL OR c.feature_flag = '[]'::jsonb OR
 (p_feature_flags IS NOT NULL AND p_feature_flags != '[]'::jsonb AND
  EXISTS (SELECT 1 FROM jsonb_array_elements_text(c.feature_flag) AS flag
          WHERE flag IN (SELECT jsonb_array_elements_text(p_feature_flags)))))
```

## Navigation Service

**File:** `web-admin/lib/services/navigation.service.ts`

- Builds `featureFlagArray` from tenant feature flags via `getFeatureFlags()` → `hq_ff_get_effective_values_batch` RPC.
- Passes `p_feature_flags: featureFlagArray` to `fn_sys_nav_tree_visible_items`.
- Maps `item.feature_flag` to `featureFlag` in navigation item response.

## Navigation Item Form

**File:** `web-admin/src/features/settings/ui/NavigationItemForm.tsx`

- `feature_flag` field: comma-separated list of flag keys.
- Stored as array in `sys_components_cd.feature_flag`.

## Components API

**File:** `web-admin/app/api/navigation/components/[id]/route.ts`

- Accepts `feature_flag` in update payload.
- Normalizes to array: `Array.isArray(feature_flag) ? feature_flag : []`.

## Example Nav Items with feature_flag

From 0059 seed (partial): items may have `feature_flag` set. Catalog preferences (0141) does not set `feature_flag` — it uses `main_permission_code` and `roles` only.

## See Also

- [FEATURE_FLAGS_REFERENCE](FEATURE_FLAGS_REFERENCE.md)
- [FEATURE_FLAGS_USAGE](FEATURE_FLAGS_USAGE.md)
- [NAVIGATION_PERMISSIONS](../permissions/NAVIGATION_PERMISSIONS.md)
