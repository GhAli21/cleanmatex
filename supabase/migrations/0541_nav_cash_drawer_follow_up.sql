-- =============================================================================
-- Migration 0541 — Navigation entry for the Cash Drawer Follow-up screen
-- (POS_Session_Cash_Drawer_Hardening, CLF M8 / CLF-8-9)
--
-- Dual-write half 2 of 2 (CRITICAL RULE #10): adds `billing_cash_drawer_followup`
-- as a leaf under the existing `billing` node, next to `billing_cash_drawers`.
-- The other half — `web-admin/config/navigation.ts` (`billing_cash_drawer_followup`
-- key) — is updated in the same change set as this migration.
--
-- Screen: /dashboard/internal_fin/cash-drawers/follow-up — closed sessions whose
-- close disposition moved cash to a PENDING_DEPOSIT drawer, filterable by
-- post-close status, with inline status/notes update.
--
-- Permissions: no new permission codes. The page is gated on
-- `cash_drawer:view_reports` (migration 0294) and inline updates on
-- `cash_drawer:post_close_update` (seeded with the CLF permission migration).
--
-- Reversal (forward-only): DELETE FROM sys_components_cd WHERE comp_code =
-- 'billing_cash_drawer_followup'. Pure navigation metadata, no dependent rows.
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
  'billing_cash_drawer_followup',
  (SELECT comp_id FROM public.sys_components_cd WHERE comp_code = 'billing'),
  'billing',
  'Cash Deposit Follow-up',
  'متابعة الإيداعات النقدية',
  '/dashboard/internal_fin/cash-drawers/follow-up',
  'Landmark',
  'cash_drawer:view_reports',
  (SELECT COALESCE(MIN(display_order), 40) + 1 FROM public.sys_components_cd WHERE comp_code = 'billing_cash_drawers'),
  (SELECT comp_level FROM public.sys_components_cd WHERE comp_code = 'billing_cash_drawers'),
  TRUE, TRUE, TRUE, TRUE, TRUE,
  '["super_admin","tenant_admin","admin","branch_manager"]'::jsonb,
  '["cash_drawer:view_reports"]'::jsonb,
  '[]'::jsonb,
  NULL,
  1,
  'POS_Session_Cash_Drawer_Hardening CLF-8-9 — worklist of sessions whose closing cash was sent to a PENDING_DEPOSIT drawer, with post-close status tracking.'
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
