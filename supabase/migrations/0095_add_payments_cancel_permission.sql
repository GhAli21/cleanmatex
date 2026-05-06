-- 0095_add_payments_cancel_permission.sql
-- Purpose: Add payments:cancel permission and assign to admin roles
-- Pattern: Follows 0034_rbac_foundation.sql

BEGIN;

-- =====================================================
-- Permission: payments:cancel
-- Description: Cancel a payment
-- Roles: super_admin, tenant_admin, operator
-- Date: 2026-01-30
-- =====================================================

-- Insert permission into sys_auth_permissions
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
  'payments:cancel',
  'Cancel Payment',
  'إلغاء الدفع',
  'actions',
  'Allows user to cancel a payment and reverse invoice/order balances',
  'يسمح للمستخدم بإلغاء الدفعة وعكس أرصدة الفواتير/الطلبات',
  'Payments',
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (code) DO NOTHING;

-- Assign permission to super_admin, tenant_admin, operator roles
-- Uses INSERT ... SELECT with WHERE NOT EXISTS to be safe regardless of which PK is active
-- (avoids ON CONFLICT which requires a unique constraint that may not exist yet)
INSERT INTO sys_auth_role_default_permissions (
  role_code, permission_code,
  is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM sys_auth_roles r
CROSS JOIN sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'operator')
  AND p.code = 'payments:cancel'
  AND NOT EXISTS (
    SELECT 1 FROM sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

commit;
