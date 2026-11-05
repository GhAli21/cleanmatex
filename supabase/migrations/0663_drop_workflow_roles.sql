-- ============================================================
-- Migration: 0663_drop_workflow_roles.sql
-- Purpose:   Remove the unused "workflow roles" concept (owner decision 2026-10-30).
--            Workflow access is governed by RBAC permissions (orders:transition, …)
--            and HQ workflow profiles. Workflow roles gated nothing: no screen, API,
--            RLS policy or function read them, the table had 0 rows and the flag
--            workflow_role_restrictions_enabled was off.
-- Affected:  org_auth_user_workflow_roles (table, its 6 RLS policies, 6 indexes);
--            functions get_user_workflow_roles(), has_workflow_role(text);
--            feature flag workflow_role_restrictions_enabled
--            (hq_ff_feature_flags_mst + sys_ff_pln_flag_mappings_dtl);
--            sys_components_cd row settings_workflow_roles
-- Related:   0034 (rbac foundation: table + functions), 0650 (policies), 0660
-- Plan:      docs/features/API_Route_Auth_Hardening/STATUS.md (Workflow roles retirement)
-- ============================================================
--
-- APPLY ORDER: apply only after the HQ app (cleanmatexsaas platform-api / platform-web)
-- no longer reads org_auth_user_workflow_roles (tenant-users workflow-roles endpoints,
-- TenantWorkflowRoleGuard). Applying earlier breaks those HQ endpoints.
--
-- Dependents checked on remote before writing (2026-10-30): no foreign keys into the
-- table, no views, no other function calls the two functions, 0 rows in the table,
-- 0 tenant overrides and 0 audit rows for the flag. Every DROP uses RESTRICT, so the
-- migration fails instead of removing anything unexpected.
--
-- ROLLBACK PLAN (forward-only): recreate the table, policies, indexes and functions from
-- 0034/0650 and re-insert the flag and its plan mappings. There is no data to restore.

BEGIN;

SET LOCAL lock_timeout = '10s';

-- Menu item for the retired Settings → Workflow Roles screen. Soft-retired (kept for
-- history): hidden from every navigation RPC.
UPDATE public.sys_components_cd
SET is_active    = false,
    is_navigable = false,
    rec_status   = 0,
    updated_at   = NOW(),
    updated_info = 'Migration 0663: workflow roles concept removed'
WHERE comp_code = 'settings_workflow_roles';

-- Removed: returned the caller's workflow roles; only the client login load called it.
DROP FUNCTION IF EXISTS public.get_user_workflow_roles() RESTRICT;

-- Removed: checked one workflow role for the caller; no caller left.
DROP FUNCTION IF EXISTS public.has_workflow_role(text) RESTRICT;

-- Removed: workflow role assignments per user and tenant (always empty). Dropping the
-- table also drops its own RLS policies and indexes; nothing else depends on it.
DROP TABLE IF EXISTS public.org_auth_user_workflow_roles RESTRICT;

-- Feature flag that would have switched workflow-role restrictions on. Plan mappings
-- reference the flag (FK ON DELETE RESTRICT), so they are removed first.
DELETE FROM public.sys_ff_pln_flag_mappings_dtl
WHERE flag_key = 'workflow_role_restrictions_enabled';

DELETE FROM public.hq_ff_feature_flags_mst
WHERE flag_key = 'workflow_role_restrictions_enabled';

COMMIT;
