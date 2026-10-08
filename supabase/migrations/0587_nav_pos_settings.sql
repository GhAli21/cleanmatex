-- =============================================================================
-- 0587_nav_pos_settings.sql
-- Navigation: new "POS Settings" page for the POS-session settings.
--
-- WHY: the POS-session controls (where a session is required, rollover mode, stale hours, Z-report)
-- lived as a card on Cash Control Settings (migration 0518), mixed with drawer and cash policy. They
-- now have their own tabbed page at /dashboard/settings/pos-settings. Cash Control Settings stays
-- where it is, for drawer close, custody, cash-change rounding and denominations.
--
-- DUAL-WRITE (CLAUDE.md rule 10): the other half is web-admin/config/navigation.ts, where the entry
-- `settings_pos` was added in the same change set. `settings_cash_control` is untouched.
--
-- WHAT CHANGES (sys_components_cd, global navigation catalog; no tenant rows are touched):
--   - INSERT/UPSERT `settings_pos` under `config_settings`, display order 61 (right after Cash
--     Control Settings, 60), same audience and main permission as that entry.
--
-- NO new permission: the page is gated by cash_control:view and saves with cash_control:manage
-- (seeded by 0517); both pages edit the same cash-control settings row through the same API.
--
-- ICON: `Settings2`, which is in the sidebar icon registry (lib/utils/icon-registry.ts).
--
-- IDEMPOTENT: ON CONFLICT upsert.
-- REVERSAL (forward-only): a later migration would DELETE FROM sys_components_cd WHERE comp_code =
-- 'settings_pos'. Pure navigation metadata; nothing depends on it.
-- =============================================================================

BEGIN;

-- New leaf under Settings, next to Cash Control Settings.
INSERT INTO public.sys_components_cd (
  comp_code,
  parent_comp_id,
  parent_comp_code,
  label,
  label2,
  comp_path,
  comp_icon,
  main_permission_code,
  display_order,
  comp_level,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  roles,
  permissions,
  feature_flag,
  badge,
  rec_status,
  created_info
)
VALUES (
  'settings_pos',
  (SELECT comp_id FROM public.sys_components_cd WHERE comp_code = 'config_settings'),
  'config_settings',
  'POS Settings',
  'إعدادات نقطة البيع',
  '/dashboard/settings/pos-settings',
  'Settings2',
  'cash_control:view',
  61,
  1,
  TRUE, TRUE, TRUE, TRUE, TRUE,
  '["admin","super_admin","tenant_admin","branch_manager","finance_manager","operator"]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  NULL,
  1,
  'Migration 0587 — tabbed POS settings page for the POS-session policy (session requirement, shift lifecycle). Gated by cash_control:view.'
)
ON CONFLICT (comp_code) DO UPDATE
SET
  parent_comp_id       = EXCLUDED.parent_comp_id,
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  comp_path            = EXCLUDED.comp_path,
  comp_icon            = EXCLUDED.comp_icon,
  main_permission_code = EXCLUDED.main_permission_code,
  display_order        = EXCLUDED.display_order,
  comp_level           = EXCLUDED.comp_level,
  is_leaf              = TRUE,
  is_navigable         = TRUE,
  is_active            = TRUE,
  roles                = EXCLUDED.roles,
  updated_at           = CURRENT_TIMESTAMP;

COMMIT;
