-- 0131_add_orders_return_permission.sql
-- Purpose: Add orders:return permission for customer return flow
-- Plan: cancel_and_return_order_ddb29821.plan.md

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
  'orders:return',
  'Customer Return',
  'استلام إرجاع العميل',
  'actions',
  'Allows user to process customer return (delivered/closed orders)',
  'يسمح للمستخدم بمعالجة إرجاع العميل (الطلبات المسلمة/المغلقة)',
  'Orders',
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_auth_role_default_permissions (
  role_code,
  permission_code,
  is_enabled,
  is_active,
  rec_status,
  created_at,
  created_by
) VALUES
  ('super_admin', 'orders:return', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('tenant_admin', 'orders:return', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('operator', 'orders:return', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (role_code, permission_code) DO NOTHING;

COMMIT;
