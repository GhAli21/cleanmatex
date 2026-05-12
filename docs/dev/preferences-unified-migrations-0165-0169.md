---
version: v1.0.1
last_updated: 2026-05-11
author: CleanMateX Team
---

# Unified Preferences Migrations 0165–0169

**Scope:** **Migration rollout, post-steps, and rollback** for versions **0165–0169** only. It does **not** replace the full prefs architecture (**preference kinds 0171+**, `prefs_owner_type` / `prefs_source`, New Order APIs, etc.). For that use **[preferences-architecture-reference.md](./preferences-architecture-reference.md)** (`§12` links back here).

Part of the **Customer/Order/Item/Pieces Preferences** feature. Migrations must be applied in order. **Do not run `supabase db reset`** — apply via `supabase db push` or your normal migration workflow.

For current end-to-end architecture (preference kinds table, catalogs, packing, New Order APIs), see **[preferences-architecture-reference.md](./preferences-architecture-reference.md)**.

## Migration Order

| Version | File | Purpose |
|---------|------|---------|
| 0165 | `0165_extend_sys_service_preference_cd_conditions_colors.sql` | Extend catalog with conditions/colors; extend org_service_preference_cf |
| 0166 | `0166_create_org_order_preferences_dtl.sql` | Create org_order_preferences_dtl; migrate data; drop org_order_item_service_prefs, org_order_item_pc_prefs |
| 0167 | `0167_org_order_item_pieces_color_jsonb.sql` | Change org_order_item_pieces_dtl.color to JSONB |
| 0168 | `0168_item_conditions_colors_feature_flag.sql` | Add feature flag item_conditions_colors_enabled |
| 0169 | `0169_update_preference_resolution_functions.sql` | Update get_last_order_preferences, suggest_preferences_from_history |

## Prerequisites

- Migrations 0139–0144 (Order Service Preferences) already applied
- Supabase project with valid schema

## Apply Migrations

```bash
# From project root
supabase db push
# Or apply each migration manually in sequence
```

## Post-Migration

1. **Regenerate types:**
   ```bash
   cd web-admin
   npx prisma generate
   ```

2. **Verify feature flag:** `item_conditions_colors_enabled` should exist in `hq_ff_feature_flags_mst` and `sys_ff_pln_flag_mappings_dtl`.

3. **Tenant initialization:** Conditions and colors seed for new tenants is handled by the SAAS HQ Platform (cleanmatexsaas). No changes needed in web-admin tenant init.

## Rollback

**Warning:** Old tables (`org_order_item_service_prefs`, `org_order_item_pc_prefs`) are dropped in 0166. Rollback requires:

1. Reverse 0169: Restore old preference resolution functions
2. Reverse 0168: Remove feature flag
3. Reverse 0167: Restore color column to VARCHAR(50)
4. Reverse 0166: Recreate old tables, migrate data from org_order_preferences_dtl, drop org_order_preferences_dtl
5. Reverse 0165: Remove new columns from sys_service_preference_cd and org_service_preference_cf

Document rollback steps in migration comments if needed for your environment.

## Related (post-0169 preferences RPC)

| Version | File | Purpose |
|---------|------|---------|
| 0260 | `0260_get_last_order_preferences_catalog_ids.sql` | Extends **`get_last_order_preferences`** with **`packing_pref_cf_id`** and **`service_prefs_catalog`** for Repeat Last Order + **`org_order_preferences_dtl.preference_id`** alignment in the client. Apply after **0169**. |

Details: **`docs/dev/preferences-architecture-reference.md`** §8.4 (Repeat Last Order), §8.3 (New Order surcharge display UI), §12.

**Note:** Packing/service **money display** beside names in the New Order wizard (not a migration) is documented under **§8.3**.
