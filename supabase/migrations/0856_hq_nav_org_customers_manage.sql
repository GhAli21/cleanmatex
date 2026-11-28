-- =============================================================================
-- Migration: 0856_hq_nav_org_customers_manage.sql
-- Program:   HQ Organization Customers Management Workspace (`/org-customers-manage`)
-- Purpose:
--   1. Seed HQ RBAC permissions (`hq_org_customers:read`, `hq_org_customers:manage`,
--      `hq_org_customers:link`) into `public.hq_permissions` and grant them to HQ
--      roles that already manage tenants (`tenant_users.manage`, `tenants.manage`, `*`).
--   2. Seed the HQ sidebar navigation entry `hq_org_customers` in
--      `public.hq_navigation_cd` under `tenant_gov` (Tenant Governance & Config)
--      at display_order = 117 — immediately below `hq_org_users` (115) and before
--      Feature Flags Registry (120).
--
-- Dual-write (in sibling repo `cleanmatexsaas`):
--   - `platform-web/messages/{en,ar}/layout.json` (`sidebar.routes.orgCustomers`)
--   - `platform-web/src/ui/navigation/cmx-sidebar.tsx` (`FALLBACK_SECTIONS` +
--     `HQ_NAV_ICON_MAP` entry for `UserCheck`)
--   - `platform-web/app/org-customers-manage/page.tsx` & `[customerId]/page.tsx`
--   - `platform-api/src/modules/org-customers-manage/*`
--
-- Target tables: public.hq_permissions, public.hq_role_permissions,
--                public.hq_navigation_cd (rows only; no schema change).
--
-- Deployment:
--   Forward-only draft. Review before application. Do not apply through an
--   agent, Supabase CLI, or MCP; the repository owner applies migrations.
--
-- Rollback:
--   Soft-retire the `hq_org_customers` row (`is_active = false, is_navigable = false,
--   rec_status = 0`).
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- -----------------------------------------------------------------------------
-- 1. Seed HQ permissions for Organization Customers workspace.
-- -----------------------------------------------------------------------------
INSERT INTO public.hq_permissions (
  permission_code,
  permission_name,
  permission_name_ar,
  resource_code,
  action_code,
  is_system,
  is_active,
  created_info
)
VALUES
  (
    'hq_org_customers:read',
    'Read organization customers',
    'عرض عملاء المنشآت',
    'hq_org_customers',
    'read',
    true,
    true,
    '0856 org customers workspace'
  ),
  (
    'hq_org_customers:manage',
    'Manage organization customers',
    'إدارة عملاء المنشآت',
    'hq_org_customers',
    'manage',
    true,
    true,
    '0856 org customers workspace'
  ),
  (
    'hq_org_customers:link',
    'Link organization customers',
    'ربط عملاء المنشآت',
    'hq_org_customers',
    'link',
    true,
    true,
    '0856 org customers workspace'
  )
ON CONFLICT (permission_code) DO UPDATE SET
  permission_name = EXCLUDED.permission_name,
  permission_name_ar = EXCLUDED.permission_name_ar,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Grant the new permissions to HQ roles that already hold tenant management access.
INSERT INTO public.hq_role_permissions (role_code, permission_code, created_info)
SELECT DISTINCT rp.role_code, seed.code, '0856 roles that already manage tenants'
FROM public.hq_role_permissions rp
CROSS JOIN (
  VALUES
    ('hq_org_customers:read'),
    ('hq_org_customers:manage'),
    ('hq_org_customers:link')
) AS seed(code)
WHERE rp.permission_code IN ('tenant_users.manage', 'tenants.manage', '*')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 2. Seed HQ sidebar navigation entry under Tenant Governance & Config.
-- -----------------------------------------------------------------------------
INSERT INTO public.hq_navigation_cd (
  nav_code,
  parent_nav_code,
  section_code,
  label,
  label2,
  description,
  description2,
  nav_path,
  nav_icon,
  badge,
  main_permission_code,
  nav_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  metadata,
  rec_status,
  created_by
)
VALUES (
  'hq_org_customers',
  NULL,
  'tenant_gov',
  'Organization Customers',
  'عملاء المنشآت',
  'Search global customers, manage customer codes, linked organizations, and audit history.',
  'ابحث عن العملاء الموحدين، وأدر رموز العملاء والمنشآت المرتبطة وسجل التغييرات.',
  '/org-customers-manage',
  'UserCheck',
  NULL,
  'hq_org_customers:read',
  1,
  117,
  true,
  true,
  true,
  true,
  '{"detail_path": "/org-customers-manage/[customerId]", "workspace": true}'::jsonb,
  1,
  'migration_0856'
)
ON CONFLICT (nav_code) DO UPDATE SET
  parent_nav_code = EXCLUDED.parent_nav_code,
  section_code = EXCLUDED.section_code,
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  nav_path = EXCLUDED.nav_path,
  nav_icon = EXCLUDED.nav_icon,
  main_permission_code = EXCLUDED.main_permission_code,
  nav_level = EXCLUDED.nav_level,
  display_order = EXCLUDED.display_order,
  is_leaf = EXCLUDED.is_leaf,
  is_navigable = EXCLUDED.is_navigable,
  is_active = EXCLUDED.is_active,
  metadata = EXCLUDED.metadata,
  updated_at = now(),
  updated_by = 'migration_0856',
  updated_count = COALESCE(public.hq_navigation_cd.updated_count, 0) + 1;

COMMIT;
