-- =============================================================================
-- Migration 0560 — Navigation entry for the Cash Variance by Cashier report
-- (POS_Session_Cash_Drawer_Hardening, C4)
--
-- Dual-write half 2 of 2 (CRITICAL RULE #10): adds `reports_cash_variance` as a leaf under the
-- existing `reports` node. The other half — `web-admin/config/navigation.ts`
-- (`reports_cash_variance` key) — is updated in the same change set as this migration.
--
-- Screen: /dashboard/reports/cash-variance — per-cashier count of closed drawer sessions, total /
-- mean / absolute variance and shortage-vs-overage skew over a date range, branch-scoped to the
-- viewer's permitted branches.
--
-- Permissions: no new permission codes. The page and API are gated on `cash_drawer:view_reports`
-- (migration 0294), the same code that guards the cash reports already in the system.
--
-- Reversal (forward-only): DELETE FROM sys_components_cd WHERE comp_code = 'reports_cash_variance'.
-- Pure navigation metadata, no dependent rows.
-- =============================================================================

BEGIN;

INSERT INTO public.sys_components_cd (
  comp_code,
  parent_comp_id,
  parent_comp_code,
  label,
  label2,
  description,
  description2,
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
  'reports_cash_variance',
  (SELECT comp_id FROM public.sys_components_cd WHERE comp_code = 'reports'),
  'reports',
  'Cash Variance by Cashier',
  'فروقات النقد حسب الكاشير',
  'Closed drawer sessions per cashier: count, total and average variance, shortage versus overage',
  'جلسات درج النقد المغلقة لكل كاشير: العدد وإجمالي الفرق ومتوسطه والعجز مقابل الزيادة',
  '/dashboard/reports/cash-variance',
  'Scale',
  'cash_drawer:view_reports',
  (SELECT COALESCE(MAX(display_order), 0) + 1 FROM public.sys_components_cd WHERE parent_comp_code = 'reports' AND comp_code <> 'reports_cash_variance'),
  (SELECT comp_level + 1 FROM public.sys_components_cd WHERE comp_code = 'reports'),
  TRUE, TRUE, TRUE, TRUE, TRUE,
  '["super_admin","tenant_admin","admin","branch_manager","accountant","finance_manager"]'::jsonb,
  '["cash_drawer:view_reports"]'::jsonb,
  '[]'::jsonb,
  NULL,
  1,
  'POS_Session_Cash_Drawer_Hardening C4 — cashier variance history report.'
)
ON CONFLICT (comp_code) DO UPDATE
SET
  parent_comp_id       = EXCLUDED.parent_comp_id,
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  description          = EXCLUDED.description,
  description2         = EXCLUDED.description2,
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

-- The parent already has children (the other reports); keep it a node.
UPDATE public.sys_components_cd
   SET is_leaf = FALSE
 WHERE comp_code = 'reports' AND is_leaf IS DISTINCT FROM FALSE;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.sys_components_cd WHERE comp_code = 'reports_cash_variance' AND parent_comp_id IS NOT NULL) THEN
    RAISE EXCEPTION '0560: reports_cash_variance was not attached to the reports node';
  END IF;
END $$;

COMMIT;
