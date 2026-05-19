-- ==================================================================
-- 0305_finance_vouchers_nav.sql
-- Business Voucher Module (BVM) — Phase 1, Step 6
-- Navigation entries for the Internal Finance section.
--
-- DUAL-WRITE: web-admin/config/navigation.ts updated in same PR:
--   - UserRole type extended with 'cashier'
--   - billing section renamed to internal_fin (key, label, label2, path, icon)
--   - BVM voucher children added under internal_fin
--
-- DB changes:
--   1. UPDATE existing billing comp_code entry:
--      rename label → Internal Finance, path → /dashboard/internal_fin
--      extend roles to include cashier
--   2. INSERT finance_vouchers    — Business Vouchers list
--   3. INSERT finance_vouchers_new — New Voucher form
--   4. INSERT finance_vouchers_reports — Voucher Reports
-- ==================================================================

BEGIN;

-- ── 1. Rename billing entry to Internal Finance ───────────────────

UPDATE public.sys_components_cd SET
  label                = 'Internal Finance And Operations',
  label2               = 'المالية الداخلية والتشغيل',
  description          = 'Internal finance operations including billing, payments, and business vouchers',
  description2         = 'العمليات المالية الداخلية بما فيها الفواتير والمدفوعات والسندات التجارية',
  comp_path            = '/dashboard/internal_fin',
  comp_icon            = 'BookOpen',
  roles                = '["super_admin","tenant_admin","admin","branch_manager","operator","cashier"]'::jsonb,
  updated_at           = CURRENT_TIMESTAMP
WHERE comp_code = 'billing';

-- ── 2. finance_vouchers — Business Vouchers list ──────────────────

INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_code,
  label, label2,
  description, description2,
  comp_path, comp_icon,
  comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'finance_vouchers', 'billing',
  'Business Vouchers', 'السندات التجارية',
  'View and manage all business finance vouchers',
  'عرض وإدارة جميع السندات المالية التجارية',
  '/dashboard/internal_fin/vouchers', 'FileText',
  1, 70,
  true, true, true, true, true,
  '["super_admin","tenant_admin","admin","branch_manager","operator","cashier"]'::jsonb,
  'fin_vouchers:view', 1
) ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  description          = EXCLUDED.description,
  description2         = EXCLUDED.description2,
  comp_path            = EXCLUDED.comp_path,
  comp_icon            = EXCLUDED.comp_icon,
  comp_level           = EXCLUDED.comp_level,
  display_order        = EXCLUDED.display_order,
  is_leaf              = EXCLUDED.is_leaf,
  is_navigable         = EXCLUDED.is_navigable,
  is_active            = EXCLUDED.is_active,
  is_for_tenant_use    = EXCLUDED.is_for_tenant_use,
  roles                = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at           = CURRENT_TIMESTAMP;

-- ── 3. finance_vouchers_new — New Voucher form ────────────────────

INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_code,
  label, label2,
  description, description2,
  comp_path, comp_icon,
  comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'finance_vouchers_new', 'billing',
  'New Voucher', 'سند جديد',
  'Create a new business finance voucher',
  'إنشاء سند مالي تجاري جديد',
  '/dashboard/internal_fin/vouchers/new', 'FilePlus',
  1, 71,
  true, true, true, true, true,
  '["super_admin","tenant_admin","admin","branch_manager","operator","cashier"]'::jsonb,
  'fin_vouchers:create', 1
) ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  description          = EXCLUDED.description,
  description2         = EXCLUDED.description2,
  comp_path            = EXCLUDED.comp_path,
  comp_icon            = EXCLUDED.comp_icon,
  comp_level           = EXCLUDED.comp_level,
  display_order        = EXCLUDED.display_order,
  is_leaf              = EXCLUDED.is_leaf,
  is_navigable         = EXCLUDED.is_navigable,
  is_active            = EXCLUDED.is_active,
  is_for_tenant_use    = EXCLUDED.is_for_tenant_use,
  roles                = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at           = CURRENT_TIMESTAMP;

-- ── 4. finance_vouchers_reports — Voucher Reports ─────────────────

INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_code,
  label, label2,
  description, description2,
  comp_path, comp_icon,
  comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'finance_vouchers_reports', 'billing',
  'Voucher Reports', 'تقارير السندات',
  'Finance voucher summary and analytics reports',
  'تقارير وتحليلات السندات المالية',
  '/dashboard/internal_fin/vouchers/reports', 'BarChart3',
  1, 72,
  true, true, true, true, true,
  '["super_admin","tenant_admin","admin","branch_manager"]'::jsonb,
  'fin_vouchers:reports', 1
) ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  description          = EXCLUDED.description,
  description2         = EXCLUDED.description2,
  comp_path            = EXCLUDED.comp_path,
  comp_icon            = EXCLUDED.comp_icon,
  comp_level           = EXCLUDED.comp_level,
  display_order        = EXCLUDED.display_order,
  is_leaf              = EXCLUDED.is_leaf,
  is_navigable         = EXCLUDED.is_navigable,
  is_active            = EXCLUDED.is_active,
  is_for_tenant_use    = EXCLUDED.is_for_tenant_use,
  roles                = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at           = CURRENT_TIMESTAMP;

-- ── 5. Resolve parent_comp_id for the three new children ──────────

UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.parent_comp_code = 'billing'
  AND p.comp_code = 'billing'
  AND c.comp_code IN ('finance_vouchers', 'finance_vouchers_new', 'finance_vouchers_reports')
  AND (c.parent_comp_id IS NULL OR c.parent_comp_id <> p.comp_id);

-- ── 6. Ensure billing parent is flagged as a node ─────────────────

UPDATE sys_components_cd SET is_leaf = false WHERE comp_code = 'billing';

COMMIT;
