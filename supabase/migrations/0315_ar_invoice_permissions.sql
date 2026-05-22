-- ============================================================================
-- 0315_ar_invoice_permissions.sql
-- Purpose:
--   Seed missing AR Invoice v1 permissions and default role mappings.
-- Notes:
--   Reuses existing invoice permissions where they already exist in the DB.
-- ============================================================================

BEGIN;

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('invoices:issue',
   'Issue Invoices', 'إصدار الفواتير',
   'actions', 'Issue draft AR invoices into open receivable documents',
   'إصدار مسودات فواتير العملاء إلى مستندات ذمم مفتوحة',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),

  ('invoices:allocate_payment',
   'Allocate Invoice Payments', 'تخصيص مدفوعات الفواتير',
   'actions', 'Allocate receipts and credits against AR invoices',
   'تخصيص المقبوضات والأرصدة مقابل فواتير الذمم المدينة',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),

  ('invoices:debit_note',
   'Issue Debit Notes', 'إصدار إشعارات مدينة',
   'actions', 'Create debit notes that increase receivable balances',
   'إنشاء إشعارات مدينة تزيد أرصدة الذمم المدينة',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),

  ('invoices:write_off',
   'Write Off Invoices', 'شطب الفواتير',
   'actions', 'Write off invoice balances with audit trail',
   'شطب أرصدة الفواتير مع الاحتفاظ بأثر تدقيقي',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),

  ('invoices:approve_sensitive',
   'Approve Sensitive AR Actions', 'اعتماد إجراءات الذمم الحساسة',
   'actions', 'Approve credit notes, debit notes, write-offs, and invoice voids',
   'اعتماد الإشعارات المدينة والدائنة والشطب وإلغاء الفواتير',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),

  ('ar_ledger:view',
   'View AR Ledger', 'عرض دفتر الذمم المدينة',
   'crud', 'View customer accounts receivable ledger activity',
   'عرض حركة دفتر حسابات الذمم المدينة للعملاء',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),

  ('ar_aging:view',
   'View AR Aging', 'عرض تقادم الذمم المدينة',
   'reports', 'View accounts receivable aging reports',
   'عرض تقارير تقادم الذمم المدينة',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),

  ('customer_statements:view',
   'View Customer Statements', 'عرض كشوف العملاء',
   'reports', 'View customer AR statements and balance history',
   'عرض كشوف حساب العملاء وسجل الأرصدة',
   'Finance', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO NOTHING;

-- branch_manager gets daily operational AR access but not sensitive approval.
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'branch_manager'
  AND p.code IN (
    'invoices:read',
    'invoices:create',
    'invoices:update',
    'invoices:issue',
    'invoices:print',
    'invoices:allocate_payment',
    'invoices:credit_note',
    'ar_ledger:view',
    'ar_aging:view',
    'customer_statements:view'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );

-- operator and cashier get read/print/allocation only.
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('operator', 'cashier')
  AND p.code IN (
    'invoices:read',
    'invoices:print',
    'invoices:allocate_payment',
    'ar_ledger:view'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );

-- admin / tenant_admin / super_admin get the full AR v1 permission set.
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('admin', 'tenant_admin', 'super_admin')
  AND p.code IN (
    'invoices:read',
    'invoices:create',
    'invoices:update',
    'invoices:issue',
    'invoices:void',
    'invoices:allocate_payment',
    'invoices:credit_note',
    'invoices:debit_note',
    'invoices:write_off',
    'invoices:approve_sensitive',
    'invoices:print',
    'invoices:export',
    'ar_ledger:view',
    'ar_aging:view',
    'customer_statements:view'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );

COMMIT;
