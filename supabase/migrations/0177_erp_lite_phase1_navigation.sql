-- ==================================================================
-- Migration: 0177_erp_lite_phase1_navigation.sql
-- Purpose: Seed ERP-Lite Phase 1 navigation entries
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Phase: ERP-Lite Phase 1 - Platform Enablement
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

INSERT INTO public.sys_components_cd (
  comp_code,
  label,
  label2,
  comp_path,
  comp_icon,
  comp_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  roles,
  main_permission_code,
  feature_flag,
  rec_status
) VALUES (
  'erp_lite',
  'Finance & Accounting',
  'المالية والمحاسبة',
  '/dashboard/erp-lite',
  'Landmark',
  0,
  9,
  false,
  true,
  true,
  true,
  true,
  '["super_admin","tenant_admin","admin"]'::jsonb,
  'erp_lite:view',
  '["erp_lite_enabled"]'::jsonb,
  1
)
ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  comp_level = EXCLUDED.comp_level,
  display_order = EXCLUDED.display_order,
  is_leaf = EXCLUDED.is_leaf,
  is_navigable = EXCLUDED.is_navigable,
  is_active = EXCLUDED.is_active,
  is_for_tenant_use = EXCLUDED.is_for_tenant_use,
  roles = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  feature_flag = EXCLUDED.feature_flag,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO public.sys_components_cd (
  comp_code,
  parent_comp_code,
  label,
  label2,
  comp_path,
  comp_icon,
  comp_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  roles,
  main_permission_code,
  feature_flag,
  rec_status
) VALUES
  ('erp_lite_coa', 'erp_lite', 'Chart of Accounts', 'دليل الحسابات', '/dashboard/erp-lite/coa', 'BookOpen', 1, 0, true, true, true, true, true, '["super_admin","tenant_admin","admin"]'::jsonb, 'erp_lite_coa:view', '["erp_lite_gl_enabled"]'::jsonb, 1),
  ('erp_lite_gl', 'erp_lite', 'General Ledger', 'دفتر الأستاذ العام', '/dashboard/erp-lite/gl', 'BookOpenCheck', 1, 1, true, true, true, true, true, '["super_admin","tenant_admin","admin"]'::jsonb, 'erp_lite_gl:view', '["erp_lite_gl_enabled"]'::jsonb, 1),
  ('erp_lite_reports', 'erp_lite', 'Financial Reports', 'التقارير المالية', '/dashboard/erp-lite/reports', 'BarChart3', 1, 2, true, true, true, true, true, '["super_admin","tenant_admin","admin"]'::jsonb, 'erp_lite_reports:view', '["erp_lite_reports_enabled"]'::jsonb, 1),
  ('erp_lite_ar', 'erp_lite', 'AR Aging', 'أعمار الذمم المدينة', '/dashboard/erp-lite/ar', 'Clock3', 1, 3, true, true, true, true, true, '["super_admin","tenant_admin","admin"]'::jsonb, 'erp_lite_ar:view', '["erp_lite_ar_enabled"]'::jsonb, 1),
  ('erp_lite_expenses', 'erp_lite', 'Expenses', 'المصروفات', '/dashboard/erp-lite/expenses', 'Wallet', 1, 4, true, true, true, true, true, '["super_admin","tenant_admin","admin"]'::jsonb, 'erp_lite_expenses:view', '["erp_lite_expenses_enabled"]'::jsonb, 1),
  ('erp_lite_bank_recon', 'erp_lite', 'Bank Reconciliation', 'تسوية البنك', '/dashboard/erp-lite/bank-recon', 'Landmark', 1, 5, true, true, true, true, true, '["super_admin","tenant_admin","admin"]'::jsonb, 'erp_lite_bank_recon:view', '["erp_lite_bank_recon_enabled"]'::jsonb, 1),
  ('erp_lite_ap', 'erp_lite', 'Accounts Payable', 'الذمم الدائنة', '/dashboard/erp-lite/ap', 'NotebookText', 1, 6, true, true, true, true, true, '["super_admin","tenant_admin","admin"]'::jsonb, 'erp_lite_ap:view', '["erp_lite_ap_enabled"]'::jsonb, 1),
  ('erp_lite_po', 'erp_lite', 'Purchase Orders', 'أوامر الشراء', '/dashboard/erp-lite/po', 'ShoppingCart', 1, 7, true, true, true, true, true, '["super_admin","tenant_admin","admin"]'::jsonb, 'erp_lite_po:view', '["erp_lite_po_enabled"]'::jsonb, 1),
  ('erp_lite_branch_pl', 'erp_lite', 'Branch P&L', 'أرباح وخسائر الفروع', '/dashboard/erp-lite/branch-pl', 'Building2', 1, 8, true, true, true, true, true, '["super_admin","tenant_admin","admin"]'::jsonb, 'erp_lite_branch_pl:view', '["erp_lite_branch_pl_enabled"]'::jsonb, 1)
ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_code = EXCLUDED.parent_comp_code,
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  comp_level = EXCLUDED.comp_level,
  display_order = EXCLUDED.display_order,
  is_leaf = EXCLUDED.is_leaf,
  is_navigable = EXCLUDED.is_navigable,
  is_active = EXCLUDED.is_active,
  is_for_tenant_use = EXCLUDED.is_for_tenant_use,
  roles = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  feature_flag = EXCLUDED.feature_flag,
  updated_at = CURRENT_TIMESTAMP;

UPDATE public.sys_components_cd child
SET parent_comp_id = parent.comp_id
FROM public.sys_components_cd parent
WHERE child.parent_comp_code = 'erp_lite'
  AND parent.comp_code = 'erp_lite'
  AND (child.parent_comp_id IS NULL OR child.parent_comp_id <> parent.comp_id);

COMMIT;
