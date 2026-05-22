-- ============================================================================
-- 0323_ar_v2_ops_navigation.sql
-- Purpose:
--   Add AR v2 operational navigation entries under Internal Finance.
-- DUAL-WRITE:
--   web-admin/config/navigation.ts must add matching children.
-- ============================================================================

BEGIN;

INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_code,
  label, label2,
  description, description2,
  comp_path, comp_icon,
  comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES
  (
    'billing_ar_credits', 'billing',
    'AR Credits', 'أرصدة الذمم',
    'Unapplied AR credits and credit allocations',
    'الأرصدة الدائنة غير المخصصة وتطبيقاتها',
    '/dashboard/internal_fin/ar/credits', 'Wallet',
    1, 15,
    true, true, true, true, true,
    '["super_admin","tenant_admin","admin","branch_manager","operator","cashier"]'::jsonb,
    'ar_credits:view', 1
  ),
  (
    'billing_ar_disputes', 'billing',
    'AR Disputes', 'منازعات الذمم',
    'Invoice disputes and resolution workflow',
    'منازعات الفواتير وسير حلها',
    '/dashboard/internal_fin/ar/disputes', 'LifeBuoy',
    1, 16,
    true, true, true, true, true,
    '["super_admin","tenant_admin","admin","branch_manager","operator"]'::jsonb,
    'ar_disputes:view', 1
  ),
  (
    'billing_ar_dunning', 'billing',
    'AR Dunning', 'إجراءات التحصيل',
    'Overdue reminders, notices, and credit holds',
    'تذكيرات المتأخرات وإشعاراتها وإيقاف الائتمان',
    '/dashboard/internal_fin/ar/dunning', 'Megaphone',
    1, 17,
    true, true, true, true, true,
    '["super_admin","tenant_admin","admin","branch_manager","operator"]'::jsonb,
    'ar_dunning:view', 1
  ),
  (
    'billing_ar_cycles', 'billing',
    'AR Statement Cycles', 'دورات كشوف الذمم',
    'Recurring statement-cycle billing configuration',
    'إعداد دورات إصدار كشوف الذمم المتكررة',
    '/dashboard/internal_fin/ar/cycles', 'RotateCcw',
    1, 18,
    true, true, true, true, true,
    '["super_admin","tenant_admin","admin","branch_manager"]'::jsonb,
    'ar_stmt_cycles:view', 1
  )
ON CONFLICT (comp_code) DO UPDATE SET
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

UPDATE public.sys_components_cd c
SET parent_comp_id = p.comp_id
FROM public.sys_components_cd p
WHERE c.parent_comp_code = 'billing'
  AND p.comp_code = 'billing'
  AND c.comp_code IN (
    'billing_ar_credits',
    'billing_ar_disputes',
    'billing_ar_dunning',
    'billing_ar_cycles'
  )
  AND (c.parent_comp_id IS NULL OR c.parent_comp_id <> p.comp_id);

UPDATE public.sys_components_cd
SET is_leaf = false,
    updated_at = CURRENT_TIMESTAMP
WHERE comp_code = 'billing';

COMMIT;
