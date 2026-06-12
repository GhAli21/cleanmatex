-- Migration 0358: Customer account receipt allocation permission (Phase 5)
-- Standalone account receipt screen RBAC

BEGIN;

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES (
  'customers:receipt_allocate',
  'Allocate Customer Account Receipts',
  'تخصيص إيصالات حساب العميل',
  'actions',
  'Create and allocate standalone customer account receipts',
  'إنشاء وتخصيص إيصالات حساب العميل المستقلة',
  'Customers',
  true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.sys_auth_role_default_permissions (role_code, permission_code, is_active)
SELECT r.code, 'customers:receipt_allocate', true
FROM public.sys_auth_roles r
WHERE r.code IN ('super_admin', 'tenant_admin', 'branch_manager', 'cashier')
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions dp
    WHERE dp.role_code = r.code AND dp.permission_code = 'customers:receipt_allocate'
  );

COMMIT;
