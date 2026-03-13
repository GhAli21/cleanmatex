-- 0148_b2b_navigation_and_permissions.sql
-- Purpose: Add B2B navigation section and permissions
-- Plan: full_b2b_feature_implementation_a4bb16a5.plan.md
-- Feature flag: b2b_contracts

BEGIN;

-- Relax permission code format to allow digits (e.g. b2b_customers:view)
ALTER TABLE sys_auth_permissions DROP CONSTRAINT IF EXISTS check_permission_code_format;
ALTER TABLE sys_auth_permissions ADD CONSTRAINT check_permission_code_format
  CHECK (code ~ '^[a-z0-9_]+:([a-z0-9_]+|\*)$|^\*:\*$');

-- ==================================================================
-- 1. B2B Permissions
-- ==================================================================
-- =====================================================
-- B2B Feature Permissions
-- Description: B2B customers, contacts, contracts, statements
-- Roles: super_admin, tenant_admin
-- Date: 2026-03-14
-- =====================================================

INSERT INTO sys_auth_permissions (code, name, name2, category, description, description2, category_main, is_active, is_enabled, rec_status, created_at, created_by)
VALUES
  ('b2b_customers:view', 'View B2B Customers', 'عرض عملاء B2B', 'crud', 'View B2B customers list', 'عرض قائمة عملاء B2B', 'B2B', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('b2b_customers:create', 'Create B2B Customer', 'إنشاء عميل B2B', 'crud', 'Create B2B customer', 'إنشاء عميل B2B', 'B2B', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('b2b_customers:edit', 'Edit B2B Customer', 'تعديل عميل B2B', 'crud', 'Edit B2B customer', 'تعديل عميل B2B', 'B2B', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('b2b_contacts:view', 'View B2B Contacts', 'عرض جهات اتصال B2B', 'crud', 'View B2B contacts', 'عرض جهات اتصال B2B', 'B2B', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('b2b_contacts:create', 'Create B2B Contact', 'إنشاء جهة اتصال B2B', 'crud', 'Create B2B contact', 'إنشاء جهة اتصال B2B', 'B2B', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('b2b_contracts:view', 'View B2B Contracts', 'عرض عقود B2B', 'crud', 'View B2B contracts', 'عرض عقود B2B', 'B2B', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('b2b_contracts:create', 'Create B2B Contract', 'إنشاء عقد B2B', 'crud', 'Create B2B contract', 'إنشاء عقد B2B', 'B2B', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('b2b_statements:view', 'View B2B Statements', 'عرض كشوف حساب B2B', 'crud', 'View B2B statements', 'عرض كشوف حساب B2B', 'B2B', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('b2b_statements:create', 'Generate B2B Statement', 'إنشاء كشف حساب B2B', 'crud', 'Generate B2B statement', 'إنشاء كشف حساب B2B', 'B2B', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_auth_role_default_permissions (role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by)
SELECT r, p, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM (VALUES ('super_admin'), ('tenant_admin')) AS roles(r)
CROSS JOIN (VALUES
  ('b2b_customers:view'), ('b2b_customers:create'), ('b2b_customers:edit'),
  ('b2b_contacts:view'), ('b2b_contacts:create'),
  ('b2b_contracts:view'), ('b2b_contracts:create'),
  ('b2b_statements:view'), ('b2b_statements:create')
) AS perms(p)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- ==================================================================
-- 2. B2B Navigation Section (gated by b2b_contracts feature flag)
-- ==================================================================

-- B2B parent (section)
INSERT INTO sys_components_cd (
  comp_code,
  label,
  label2,
  comp_path,
  comp_icon,
  comp_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  main_permission_code,
  feature_flag,
  rec_status
) VALUES (
  'b2b',
  'B2B',
  'B2B',
  '/dashboard/b2b/customers',
  'Building2',
  0,
  15,
  false,
  true,
  true,
  true,
  true,
  'b2b_customers:view',
  '["b2b_contracts"]'::jsonb,
  1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  is_leaf = EXCLUDED.is_leaf,
  main_permission_code = EXCLUDED.main_permission_code,
  feature_flag = EXCLUDED.feature_flag,
  updated_at = CURRENT_TIMESTAMP;

-- B2B Customers
INSERT INTO sys_components_cd (
  comp_code,
  parent_comp_code,
  label,
  label2,
  comp_path,
  comp_icon,
  comp_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  main_permission_code,
  feature_flag,
  rec_status
) VALUES (
  'b2b_customers',
  'b2b',
  'B2B Customers',
  'عملاء B2B',
  '/dashboard/b2b/customers',
  'Users',
  1,
  0,
  true,
  true,
  true,
  true,
  true,
  'b2b_customers:view',
  '["b2b_contracts"]'::jsonb,
  1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  main_permission_code = EXCLUDED.main_permission_code,
  feature_flag = EXCLUDED.feature_flag,
  updated_at = CURRENT_TIMESTAMP;

-- B2B Contracts
INSERT INTO sys_components_cd (
  comp_code,
  parent_comp_code,
  label,
  label2,
  comp_path,
  comp_icon,
  comp_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  main_permission_code,
  feature_flag,
  rec_status
) VALUES (
  'b2b_contracts',
  'b2b',
  'Contracts',
  'العقود',
  '/dashboard/b2b/contracts',
  'FileText',
  1,
  1,
  true,
  true,
  true,
  true,
  true,
  'b2b_contracts:view',
  '["b2b_contracts"]'::jsonb,
  1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  main_permission_code = EXCLUDED.main_permission_code,
  feature_flag = EXCLUDED.feature_flag,
  updated_at = CURRENT_TIMESTAMP;

-- B2B Statements
INSERT INTO sys_components_cd (
  comp_code,
  parent_comp_code,
  label,
  label2,
  comp_path,
  comp_icon,
  comp_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  main_permission_code,
  feature_flag,
  rec_status
) VALUES (
  'b2b_statements',
  'b2b',
  'Statements',
  'كشوف الحساب',
  '/dashboard/b2b/statements',
  'Receipt',
  1,
  2,
  true,
  true,
  true,
  true,
  true,
  'b2b_statements:view',
  '["b2b_contracts"]'::jsonb,
  1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  main_permission_code = EXCLUDED.main_permission_code,
  feature_flag = EXCLUDED.feature_flag,
  updated_at = CURRENT_TIMESTAMP;

-- Link B2B children to parent
UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.parent_comp_code = 'b2b'
  AND p.comp_code = 'b2b'
  AND (c.parent_comp_id IS NULL OR c.parent_comp_id != p.comp_id);

COMMIT;
