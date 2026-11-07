-- =============================================================================
-- Migration: 0710_setup_health_perms_nav.sql
-- Purpose:   Setup Health (docs/features/Setup_Health/PLAN.md §3.2, §3.3, §3.5):
--            1. Tenant permission setup_health:view (read-only Setup Health
--               screen + list API), granted to super_admin / tenant_admin / admin.
--            2. HQ permission tenant_setup_health:view (HQ tenant workspace ›
--               Setup Health), granted to the HQ roles that can already view
--               tenants (TECH_ADMIN, SUPPORT, BUSINESS_ADMIN, ANALYST).
--               SUPER_ADMIN holds '*' already.
--            3. Tenant navigation Settings › Setup Health (dual-write: the other
--               half is web-admin/config/navigation.ts, entry settings_setup_health).
--            4. Rebuild of the effective-permission cache for users holding the
--               granted roles, so the new code is live without re-login logic.
-- Affected:  sys_auth_permissions, sys_auth_role_default_permissions,
--            hq_permissions, hq_role_permissions, hq_roles.permissions,
--            sys_components_cd, cmx_effective_permissions (via rebuild)
-- Related:   0709 (Setup Health registry). The banner/summary API needs only
--            sign-in, so no permission is added for it.
--            HQ tenant workspace sidebar is code-only (tenant-sidebar.tsx);
--            hq_navigation_cd has no per-tenant subpage rows, so none is added.
-- Idempotent: ON CONFLICT DO UPDATE for definitions, UPDATE + INSERT…NOT EXISTS
--            for grants, upsert for the menu row.
-- Rollback (forward-only, manual): delete the settings_setup_health component,
--            the role grants and the two permission rows, then rebuild users.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- -----------------------------------------------------------------------------
-- 1. Tenant permission
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by, created_info
) VALUES (
  'setup_health:view',
  'View setup health',
  'عرض صحة الإعداد',
  'settings',
  'See what is missing or wrong in the organization setup and where to fix it.',
  'عرض ما ينقص أو ما هو خاطئ في إعداد المنشأة وأين يتم إصلاحه.',
  'Settings',
  true, true, 1, CURRENT_TIMESTAMP, 'system_admin', '0710 setup health'
)
ON CONFLICT (code) DO UPDATE SET
  name          = EXCLUDED.name,
  name2         = EXCLUDED.name2,
  category      = EXCLUDED.category,
  description   = EXCLUDED.description,
  description2  = EXCLUDED.description2,
  category_main = EXCLUDED.category_main,
  is_active     = EXCLUDED.is_active,
  is_enabled    = EXCLUDED.is_enabled,
  rec_status    = EXCLUDED.rec_status,
  updated_at    = CURRENT_TIMESTAMP;

-- Remember who holds the target roles now (their cache is rebuilt in step 5).
CREATE TEMP TABLE _shc_perm_users ON COMMIT DROP AS
SELECT DISTINCT ur.user_id, ur.tenant_org_id
FROM public.org_auth_user_roles ur
WHERE ur.role_code IN ('super_admin', 'tenant_admin', 'admin')
  AND ur.is_active = TRUE
  AND COALESCE(ur.rec_status, 1) = 1;

-- Re-enable a grant that exists but was switched off.
UPDATE public.sys_auth_role_default_permissions
SET is_enabled = true, is_active = true, rec_status = 1, updated_at = CURRENT_TIMESTAMP
WHERE role_code IN ('super_admin', 'tenant_admin', 'admin')
  AND permission_code = 'setup_health:view';

-- Add missing grants (owner / admin roles only; cashiers see the banner via the auth-only summary API).
INSERT INTO public.sys_auth_role_default_permissions
  (role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin')
  AND p.code = 'setup_health:view'
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- -----------------------------------------------------------------------------
-- 2. HQ permission
-- -----------------------------------------------------------------------------
INSERT INTO public.hq_permissions (
  permission_code, permission_name, permission_name_ar,
  description, description_ar,
  resource_code, action_code, is_system, is_active, created_info
) VALUES (
  'tenant_setup_health:view',
  'View tenant setup health', 'عرض صحة إعداد المنشأة',
  'See the Setup Health results of any organization and open the HQ fix screens.',
  'عرض نتائج صحة الإعداد لأي منشأة وفتح شاشات الإصلاح في إدارة المنصة.',
  'tenant_setup_health', 'view', true, true, '0710 setup health'
)
ON CONFLICT (permission_code) DO UPDATE SET
  permission_name    = EXCLUDED.permission_name,
  permission_name_ar = EXCLUDED.permission_name_ar,
  description        = EXCLUDED.description,
  description_ar     = EXCLUDED.description_ar,
  is_active          = true,
  updated_at         = NOW();

-- Read-only view: every HQ role that can already view tenants gets it.
INSERT INTO public.hq_role_permissions (role_code, permission_code, created_info)
SELECT r.role_code, 'tenant_setup_health:view', '0710 setup health'
FROM public.hq_roles r
WHERE r.role_code IN ('TECH_ADMIN', 'SUPPORT', 'BUSINESS_ADMIN', 'ANALYST')
  AND NOT EXISTS (
    SELECT 1 FROM public.hq_role_permissions e
    WHERE e.role_code = r.role_code AND e.permission_code = 'tenant_setup_health:view'
  );

-- Keep the role's permissions array in step with hq_role_permissions (both are read by HQ auth).
UPDATE public.hq_roles r
SET permissions = COALESCE(r.permissions, '[]'::jsonb) || '["tenant_setup_health:view"]'::jsonb,
    updated_at  = NOW()
WHERE r.role_code IN ('TECH_ADMIN', 'SUPPORT', 'BUSINESS_ADMIN', 'ANALYST')
  AND NOT COALESCE(r.permissions, '[]'::jsonb) ? 'tenant_setup_health:view';

-- -----------------------------------------------------------------------------
-- 3. Tenant navigation: Settings › Setup Health (display order 13 is free,
--    between Navigation 12 and Tenant 15).
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_id, parent_comp_code, label, label2,
  description, description2, comp_path, comp_icon, main_permission_code,
  display_order, comp_level, is_leaf, is_navigable, is_active, is_system,
  is_for_tenant_use, roles, permissions, feature_flag, rec_status, created_info
)
VALUES (
  'settings_setup_health',
  (SELECT comp_id FROM public.sys_components_cd WHERE comp_code = 'config_settings'),
  'config_settings',
  'Setup Health',
  'صحة الإعداد',
  'What is missing or wrong in your setup, why it matters and where to fix it.',
  'ما ينقص أو ما هو خاطئ في الإعداد، ولماذا يهم، وأين يتم إصلاحه.',
  '/dashboard/setup-health',
  'ShieldCheck',
  'setup_health:view',
  13, 1, TRUE, TRUE, TRUE, TRUE, TRUE,
  '["super_admin","tenant_admin","admin"]'::jsonb,
  '["setup_health:view"]'::jsonb,
  '[]'::jsonb,
  1,
  '0710 setup health'
)
ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_id       = EXCLUDED.parent_comp_id,
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  description          = EXCLUDED.description,
  description2         = EXCLUDED.description2,
  comp_path            = EXCLUDED.comp_path,
  comp_icon            = EXCLUDED.comp_icon,
  main_permission_code = EXCLUDED.main_permission_code,
  display_order        = EXCLUDED.display_order,
  roles                = EXCLUDED.roles,
  permissions          = EXCLUDED.permissions,
  is_active            = TRUE,
  rec_status           = 1,
  updated_at           = NOW(),
  updated_info         = '0710 setup health';

-- -----------------------------------------------------------------------------
-- 4. Rebuild effective permissions of the users captured above
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_user RECORD;
  v_n    INTEGER := 0;
BEGIN
  FOR v_user IN SELECT user_id, tenant_org_id FROM _shc_perm_users LOOP
    PERFORM public.cmx_rebuild_user_permissions(v_user.user_id, v_user.tenant_org_id);
    v_n := v_n + 1;
  END LOOP;
  RAISE NOTICE '0710: effective permissions rebuilt for % user/tenant rows', v_n;
END $$;

-- -----------------------------------------------------------------------------
-- 5. Verification
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT count(*) FROM public.sys_auth_role_default_permissions
      WHERE permission_code = 'setup_health:view' AND is_enabled
        AND role_code IN ('super_admin', 'tenant_admin', 'admin')) <> 3 THEN
    RAISE EXCEPTION '0710: setup_health:view not granted to all three admin roles';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sys_components_cd
                 WHERE comp_code = 'settings_setup_health' AND parent_comp_id IS NOT NULL) THEN
    RAISE EXCEPTION '0710: settings_setup_health menu row missing or not linked to config_settings';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.hq_permissions WHERE permission_code = 'tenant_setup_health:view') THEN
    RAISE EXCEPTION '0710: tenant_setup_health:view missing';
  END IF;
END $$;

COMMIT;
