-- ============================================================================
-- 0316_ar_invoice_navigation.sql
-- Purpose:
--   Add AR Invoice v1 navigation entries under Internal Finance.
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
    'billing_invoices_new', 'billing',
    'New Invoice', 'فاتورة جديدة',
    'Create a new AR invoice',
    'إنشاء فاتورة ذمم مدينة جديدة',
    '/dashboard/internal_fin/invoices/new', 'FilePlus',
    1, 11,
    true, true, true, true, true,
    '["super_admin","tenant_admin","admin","branch_manager"]'::jsonb,
    'invoices:create', 1
  ),
  (
    'billing_ar_aging', 'billing',
    'AR Aging', 'تقادم الذمم المدينة',
    'Accounts receivable aging report',
    'تقرير تقادم الذمم المدينة',
    '/dashboard/internal_fin/ar/aging', 'BarChart3',
    1, 12,
    true, true, true, true, true,
    '["super_admin","tenant_admin","admin","branch_manager","operator"]'::jsonb,
    'ar_aging:view', 1
  ),
  (
    'billing_ar_balances', 'billing',
    'Customer Balances', 'أرصدة العملاء',
    'Customer receivable balances and ledger access',
    'أرصدة العملاء المدينة والوصول إلى الدفتر',
    '/dashboard/internal_fin/ar/customers', 'Wallet',
    1, 13,
    true, true, true, true, true,
    '["super_admin","tenant_admin","admin","branch_manager","operator","cashier"]'::jsonb,
    'ar_ledger:view', 1
  ),
  (
    'billing_ar_statements', 'billing',
    'Customer Statements', 'كشوف العملاء',
    'Customer AR statements and history',
    'كشوف حساب العملاء وسجلهم',
    '/dashboard/internal_fin/ar/statements', 'FileText',
    1, 14,
    true, true, true, true, true,
    '["super_admin","tenant_admin","admin","branch_manager"]'::jsonb,
    'customer_statements:view', 1
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
    'billing_invoices_new',
    'billing_ar_aging',
    'billing_ar_balances',
    'billing_ar_statements'
  )
  AND (c.parent_comp_id IS NULL OR c.parent_comp_id <> p.comp_id);

UPDATE public.sys_components_cd
SET is_leaf = false,
    updated_at = CURRENT_TIMESTAMP
WHERE comp_code = 'billing';

COMMIT;
