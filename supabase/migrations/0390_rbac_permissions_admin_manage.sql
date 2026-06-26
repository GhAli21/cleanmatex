-- =============================================================================
-- 0390_rbac_permissions_admin_manage.sql
-- Purpose: Seed admin:manage permission and default role assignments.
-- Roles: super_admin, tenant_admin, admin
-- Created: 2026-06-26
-- =============================================================================

BEGIN;

-- =============================================================================
-- 0. Permission definition
-- =============================================================================

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES (
  'admin:manage',
  'Manage Administration',
  'إدارة النظام الإداري',
  'management',
  'Full administrative management access',
  'وصول كامل لإدارة النظام الإداري',
  'Admin',
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (code) DO UPDATE SET
  name            = EXCLUDED.name,
  name2           = EXCLUDED.name2,
  category        = EXCLUDED.category,
  description     = EXCLUDED.description,
  description2    = EXCLUDED.description2,
  category_main   = EXCLUDED.category_main,
  is_active       = EXCLUDED.is_active,
  is_enabled      = EXCLUDED.is_enabled,
  rec_status      = EXCLUDED.rec_status,
  updated_at      = CURRENT_TIMESTAMP;

-- =============================================================================
-- 1. Role default permissions
-- =============================================================================

UPDATE public.sys_auth_role_default_permissions
SET
  is_enabled = true,
  is_active = true,
  rec_status = 1,
  updated_at = CURRENT_TIMESTAMP
WHERE role_code IN ('super_admin', 'tenant_admin', 'admin')
  AND permission_code = 'admin:manage';

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin')
  AND p.code = 'admin:manage'
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code
      AND e.permission_code = p.code
  );

COMMIT;
