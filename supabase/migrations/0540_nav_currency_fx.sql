-- =============================================================================
-- Migration 0540 — Navigation entry for Currencies & FX
-- (Tenant_Currency_FX plan 01, stage 5C §7.2 / §7.3)
--
-- Dual-write half 2 of 2 (CRITICAL RULE #10): adds `settings_currency_fx` as
-- a leaf under the existing `config_settings` node, alongside its sibling
-- `settings_finance`/`settings_payments`/`settings_tax`. The other half —
-- `web-admin/config/navigation.ts` (`settings_currency_fx` key) — was
-- updated in the same change set as this migration.
--
-- Gated on `currencies:view` (migration 0538, already applied). Not
-- feature-flag-gated in sys_components_cd: a single-currency tenant without
-- `multi_currency_fx` on its plan still needs to see and confirm its base
-- currency (plan 01 §7.2 "compact" view) — only the in-page "enable
-- multi-currency" affordance is flag-gated, not the route itself.
--
-- Reversal (forward-only; this repo forbids editing applied migrations): a
-- future migration would DELETE FROM sys_components_cd WHERE comp_code =
-- 'settings_currency_fx'. Not lossy — pure navigation metadata, no
-- dependent rows.
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
  'settings_currency_fx',
  (SELECT comp_id FROM public.sys_components_cd WHERE comp_code = 'config_settings'),
  'config_settings',
  'Currencies & FX',
  'العملات وأسعار الصرف',
  '/dashboard/settings/finance/currency-fx',
  'Coins',
  'currencies:view',
  45,
  1,
  TRUE, TRUE, TRUE, TRUE, TRUE,
  '["admin","super_admin","tenant_admin","finance_manager"]'::jsonb,
  '["currencies:view"]'::jsonb,
  '[]'::jsonb,
  NULL,
  1,
  'Tenant_Currency_FX plan 01, stage 5C — Currencies/Rates/Import/Converter/Settings screen. Always visible to permitted roles (even single-currency tenants); multi-currency itself is gated in-page by the multi_currency_fx feature flag, not at the nav level.'
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
  permissions          = EXCLUDED.permissions,
  updated_at           = CURRENT_TIMESTAMP;

COMMIT;
