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

-- Assign permission to super_admin role
INSERT INTO sys_auth_role_default_permissions (
  role_code,
  permission_code,
  is_enabled,
  is_active,
  rec_status,
  created_at,
  created_by
) VALUES (
  'super_admin',
  'payments:cancel',
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- Assign permission to tenant_admin role
INSERT INTO sys_auth_role_default_permissions (
  role_code,
  permission_code,
  is_enabled,
  is_active,
  rec_status,
  created_at,
  created_by
) VALUES (
  'tenant_admin',
  'payments:cancel',
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- Assign permission to operator role
INSERT INTO sys_auth_role_default_permissions (
  role_code,
  permission_code,
  is_enabled,
  is_active,
  rec_status,
  created_at,
  created_by
) VALUES (
  'operator',
  'payments:cancel',
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

commit;
