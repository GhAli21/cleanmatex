-- =============================================================================
-- Migration 0518 — Navigation entry for Cash Control Settings (Wave 0, POS
-- Session & Cash Drawer Hardening, package §3.1.5 / W0-5 of
-- docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/IMPLEMENTATION_PLAN.md)
--
-- Dual-write half 2 of 2 (CRITICAL RULE #10): adds `settings_cash_control` as
-- a leaf under the existing `config_settings` node, alongside its sibling
-- `settings_payments`. The other half — `web-admin/config/navigation.ts` —
-- was updated in the same change set as this migration.
--
-- Numbering note (D17, STATUS.md): the plan's §3.1.5/§10.7 originally
-- planned to fold this program's nav migrations into a single later
-- migration (`0524` in the original numbering). Since a real, fully working
-- route now exists at the end of Wave 0 rather than waiting for that later
-- wave, this migration ships now instead — leaving navigation.ts changed
-- without its DB counterpart for several more sessions would violate the
-- dual-write rule. Consumes the next real sequence number (0518); see
-- STATUS.md's wave table for the authoritative running sequence.
--
-- Reversal (forward-only; this repo forbids editing applied migrations): a
-- future migration would DELETE FROM sys_components_cd WHERE comp_code =
-- 'settings_cash_control'. Not lossy — it is pure navigation metadata with
-- no dependent rows.
-- =============================================================================

BEGIN;

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
  'settings_cash_control',
  (SELECT comp_id FROM public.sys_components_cd WHERE comp_code = 'config_settings'),
  'config_settings',
  'Cash Control Settings',
  'إعدادات ضبط النقد',
  '/dashboard/settings/payments/cash-control-settings',
  'ShieldCheck',
  'cash_control:view',
  60,
  1,
  TRUE, TRUE, TRUE, TRUE, TRUE,
  '["admin","super_admin","tenant_admin","branch_manager","finance_manager","operator"]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  NULL,
  1,
  'POS Session & Cash Drawer Hardening W0-5 — tenant-side admin screen for cash-control policy settings (blind close, variance gating, cash-change rounding, count modes, drawer custody, POS session controls). See ADR-056 / D3.'
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
