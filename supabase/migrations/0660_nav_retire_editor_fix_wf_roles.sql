-- ============================================================
-- Migration: 0660_nav_retire_editor_fix_wf_roles.sql
-- Purpose:   API Route Auth Hardening (BF-23), Step 5.
--            (1) Retire the tenant-side navigation editor screen
--                (/dashboard/settings/navigation). sys_components_cd is a
--                global table: every tenant's sidebar reads it, so a tenant
--                user must not be able to change it. Navigation stays owned by
--                repository migrations (dual-write rule) and HQ.
--            (2) Remove the RLS policies that let a tenant user whose org role
--                is super_admin INSERT / UPDATE / DELETE sys_components_cd.
--            (3) The Workflow Roles menu item pointed at
--                'settings:workflow_roles:view', which is not a permission code
--                (three parts, not in sys_auth_permissions), so nobody without
--                '*:*' could see it. It now uses 'roles:update', the code its
--                APIs enforce.
-- Affected:  sys_components_cd (rows settings_navigation, settings_workflow_roles;
--            policies navigation_admin_insert_policy,
--            navigation_admin_update_policy, navigation_admin_delete_policy)
-- Related:   0594 (permission-only menu), 0650 (policies recreated there)
-- Plan:      docs/features/API_Route_Auth_Hardening/PLAN.md
-- ============================================================
--
-- ROLLBACK PLAN (forward-only): a later migration would set
-- settings_navigation back to is_active/is_navigable = true, rec_status = 1,
-- restore main_permission_code 'settings:workflow_roles:view', and recreate the
-- three policies as defined in 0650. The row is soft-retired, not deleted, so
-- nothing is lost.

BEGIN;

SET LOCAL lock_timeout = '10s';

-- (1) Soft-retire the navigation editor menu item. Hidden from the sidebar and
-- from every navigation RPC; kept for history (soft delete: is_active = false,
-- rec_status = 0). Its page, API routes and service are removed in the same change.
UPDATE public.sys_components_cd
SET is_active    = false,
    is_navigable = false,
    rec_status   = 0,
    updated_at   = NOW(),
    updated_info = 'Migration 0660: tenant navigation editor retired (global table, BF-23 Step 5)'
WHERE comp_code = 'settings_navigation';

-- (3) Workflow Roles menu item: use the real permission its APIs check.
UPDATE public.sys_components_cd
SET main_permission_code = 'roles:update',
    updated_at           = NOW(),
    updated_info         = 'Migration 0660: invalid code settings:workflow_roles:view replaced by roles:update'
WHERE comp_code = 'settings_workflow_roles';

-- (2) Write access to the global navigation table is removed for authenticated
-- users. Remaining access: service_role (BYPASSRLS, used by HQ and migrations)
-- and the read policies (navigation_read_policy, navigation_admin_read_policy),
-- which are unchanged.

-- Removed: let a tenant super_admin insert global menu rows for every tenant.
DROP POLICY IF EXISTS navigation_admin_insert_policy ON public.sys_components_cd;

-- Removed: let a tenant super_admin change global menu rows for every tenant.
DROP POLICY IF EXISTS navigation_admin_update_policy ON public.sys_components_cd;

-- Removed: let a tenant super_admin delete global menu rows for every tenant.
DROP POLICY IF EXISTS navigation_admin_delete_policy ON public.sys_components_cd;

COMMENT ON TABLE public.sys_components_cd IS
  'System components/navigation items with permission-based access control. Global: read by every tenant sidebar. Written only by migrations and service_role (HQ); authenticated users have read-only RLS access (0660).';

COMMIT;
