-- 0098_add_payments_refund_permission.sql
-- Purpose: Add payments:refund permission and assign to admin roles
-- Pattern: Follows 0095_add_payments_cancel_permission.sql

BEGIN;

INSERT INTO sys_auth_permissions (
  code,
  name,
  name2,
  category,
  description,
  description2,
  category_main,
  is_active,
  is_enabled,
  rec_status,
  created_at,
  created_by
) VALUES (
  'payments:refund',
  'Refund Payment',
  'استرداد الدفع',
  'actions',
  'Allows user to refund a completed payment and reverse invoice/order balances',
  'يسمح للمستخدم باسترداد دفعة مكتملة وعكس أرصدة الفواتير/الطلبات',
  'Payments',
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_auth_role_default_permissions (
  role_code, permission_code,
  is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM sys_auth_roles r
CROSS JOIN sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'operator')
  AND p.code = 'payments:refund'
  AND NOT EXISTS (
    SELECT 1 FROM sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

COMMIT;
