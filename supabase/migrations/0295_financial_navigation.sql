-- ============================================================
-- Migration 0295: Financial Platform Navigation Entries
-- Phase 7.2 of the Order Financial Platform
--
-- Adds navigation entries to sys_components_cd for:
--   billing:  cash_drawers, refunds, reconciliation
--   customers: customer_stored_value
--   marketing: loyalty_program, promotions_engine
--   config_settings: tax_setup
--   reports: fin_reports
--
-- DUAL-WRITE: navigation.ts is updated in the same PR.
-- ============================================================

BEGIN;

-- ── billing → Cash Drawers ────────────────────────────────────────────────────

INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_code,
  label, label2,
  description, description2,
  comp_path, comp_icon,
  comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'billing_cash_drawers', 'billing',
  'Cash Drawers', 'الصناديق النقدية',
  'Cash drawer session management', 'إدارة جلسات الصندوق النقدي',
  '/dashboard/billing/cash-drawers', 'Wallet',
  1, 50,
  true, true, true, true, true,
  '["super_admin","tenant_admin","admin","branch_manager","operator"]'::jsonb,
  'cash_drawer:view', 1
) ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  comp_path            = EXCLUDED.comp_path,
  display_order        = EXCLUDED.display_order,
  roles                = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at           = CURRENT_TIMESTAMP;

-- ── billing → Refunds ─────────────────────────────────────────────────────────

INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_code,
  label, label2,
  description, description2,
  comp_path, comp_icon,
  comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'billing_refunds', 'billing',
  'Refunds', 'المرتجعات',
  'Order refund management', 'إدارة مرتجعات الطلبات',
  '/dashboard/billing/refunds', 'RotateCcw',
  1, 51,
  true, true, true, true, true,
  '["super_admin","tenant_admin","admin","branch_manager","operator"]'::jsonb,
  'orders:process_refund', 1
) ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  comp_path            = EXCLUDED.comp_path,
  display_order        = EXCLUDED.display_order,
  roles                = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at           = CURRENT_TIMESTAMP;

-- ── billing → Reconciliation ──────────────────────────────────────────────────

INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_code,
  label, label2,
  description, description2,
  comp_path, comp_icon,
  comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'billing_reconciliation', 'billing',
  'Reconciliation', 'التسوية المالية',
  'Financial reconciliation runs and issue management', 'إدارة جلسات التسوية المالية ومشاكلها',
  '/dashboard/billing/reconciliation', 'ClipboardCheck',
  1, 52,
  true, true, true, true, true,
  '["super_admin","tenant_admin","admin","branch_manager"]'::jsonb,
  'reconciliation:view', 1
) ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  comp_path            = EXCLUDED.comp_path,
  display_order        = EXCLUDED.display_order,
  roles                = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at           = CURRENT_TIMESTAMP;

-- ── customers → Stored Value ──────────────────────────────────────────────────

INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_code,
  label, label2,
  description, description2,
  comp_path, comp_icon,
  comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'customers_stored_value', 'customers',
  'Stored Value', 'القيمة المخزنة',
  'Customer wallet, advance, and credit note management', 'إدارة محفظة العميل والسلفة وإشعار الدائن',
  '/dashboard/customers/stored-value', 'Wallet',
  1, 50,
  true, true, true, true, true,
  '["super_admin","tenant_admin","admin","branch_manager","operator"]'::jsonb,
  'stored_value:view_balances', 1
) ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  comp_path            = EXCLUDED.comp_path,
  display_order        = EXCLUDED.display_order,
  roles                = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at           = CURRENT_TIMESTAMP;

-- ── marketing → Loyalty Program ───────────────────────────────────────────────

INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_code,
  label, label2,
  description, description2,
  comp_path, comp_icon,
  comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'marketing_loyalty', 'marketing',
  'Loyalty Program', 'برنامج الولاء',
  'Loyalty program and tier management', 'إدارة برنامج الولاء والمستويات',
  '/dashboard/marketing/loyalty', 'Star',
  1, 50,
  true, true, true, true, true,
  '["super_admin","tenant_admin","admin"]'::jsonb,
  'loyalty:view_config', 1
) ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  comp_path            = EXCLUDED.comp_path,
  display_order        = EXCLUDED.display_order,
  roles                = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at           = CURRENT_TIMESTAMP;

-- ── marketing → Promotions Engine ────────────────────────────────────────────

INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_code,
  label, label2,
  description, description2,
  comp_path, comp_icon,
  comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'marketing_promotions', 'marketing',
  'Promotions', 'العروض الترويجية',
  'Promotion campaigns and auto-apply rules', 'حملات العروض الترويجية والتطبيق التلقائي',
  '/dashboard/marketing/promotions', 'Tag',
  1, 51,
  true, true, true, true, true,
  '["super_admin","tenant_admin","admin","operator"]'::jsonb,
  'promotions:view', 1
) ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  comp_path            = EXCLUDED.comp_path,
  display_order        = EXCLUDED.display_order,
  roles                = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at           = CURRENT_TIMESTAMP;

-- ── config_settings → Tax Setup ───────────────────────────────────────────────

INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_code,
  label, label2,
  description, description2,
  comp_path, comp_icon,
  comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'settings_tax', 'config_settings',
  'Tax Setup', 'إعداد الضريبة',
  'Tax profile and exemption configuration', 'إعداد ملفات الضريبة والإعفاءات',
  '/dashboard/settings/tax', 'Calculator',
  1, 50,
  true, true, true, true, true,
  '["super_admin","tenant_admin","admin"]'::jsonb,
  'tax:view_config', 1
) ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  comp_path            = EXCLUDED.comp_path,
  display_order        = EXCLUDED.display_order,
  roles                = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at           = CURRENT_TIMESTAMP;

-- ── reports → Financial Reports ───────────────────────────────────────────────

INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_code,
  label, label2,
  description, description2,
  comp_path, comp_icon,
  comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'reports_financial', 'reports',
  'Financial Reports', 'التقارير المالية',
  'Financial summary, tax, and reconciliation reports', 'تقارير المالية والضريبة والتسوية',
  '/dashboard/reports/financial', 'BarChart3',
  1, 50,
  true, true, true, true, true,
  '["super_admin","tenant_admin","admin","branch_manager","viewer"]'::jsonb,
  'finance_reports:view', 1
) ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  comp_path            = EXCLUDED.comp_path,
  display_order        = EXCLUDED.display_order,
  roles                = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at           = CURRENT_TIMESTAMP;

-- ── Resolve parent_comp_id for all new children ───────────────────────────────

UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.parent_comp_code = p.comp_code
  AND c.comp_code IN (
    'billing_cash_drawers','billing_refunds','billing_reconciliation',
    'customers_stored_value',
    'marketing_loyalty','marketing_promotions',
    'settings_tax',
    'reports_financial'
  )
  AND (c.parent_comp_id IS NULL OR c.parent_comp_id <> p.comp_id);

-- ── Ensure all parent sections are flagged as non-leaf ────────────────────────

UPDATE sys_components_cd
SET is_leaf = false
WHERE comp_code IN ('billing','customers','marketing','config_settings','reports');

COMMIT;
