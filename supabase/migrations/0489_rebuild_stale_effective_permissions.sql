-- 0489_rebuild_stale_effective_permissions.sql
-- Purpose:
--   Migration 0455 (workboard_permission_navigation) added `workboard:read`
--   to sys_auth_role_default_permissions for super_admin/tenant_admin/admin/
--   branch_manager/supervisor, but — unlike migration 0400
--   (pos_sessions_rebuild_effective_permissions), which hit the identical bug
--   for pos_session:* permissions — it did not rebuild cmx_effective_permissions
--   afterward. Role-default changes never auto-trigger the rebuild function
--   (rebuildUserPermissions() in permission-service-server.ts is only invoked
--   by in-app role/permission edits), so any tenant/user whose cache predates
--   0455 is missing workboard:read entirely. The web-admin Workboard page gate
--   (RequireAnyPermission with no fallback) then renders nothing — a fully
--   blank page with no console error — instead of an access-denied message.
--
--   Confirmed on remote: Demo Saudi Riyadh Dry Clean tenant
--   (c9ac29d1-219c-4a3a-8887-f860550c32be) has cmx_effective_permissions rows
--   for both its users stamped 2026-07-11, predating 0455, with zero
--   workboard:read rows.
--
--   This also recovers any other default permission seeded between 0455 and
--   0488 that likewise skipped a rebuild step, not just workboard:read.
--
-- Safety:
--   - No schema changes.
--   - No permission grants beyond those already seeded into role defaults.
--   - Idempotent: cmx_rebuild_user_permissions deletes/recomputes each
--     user/tenant effective-permission set from the current RBAC source tables.
-- Review manually, then apply through the normal migration process.

DO $$
DECLARE
  v_user RECORD;
  v_rebuilt_count INTEGER := 0;
BEGIN
  FOR v_user IN
    SELECT DISTINCT ou.user_id, ou.tenant_org_id
    FROM public.org_users_mst ou
    WHERE ou.user_id IS NOT NULL
      AND ou.tenant_org_id IS NOT NULL
      AND COALESCE(ou.is_active, TRUE) = TRUE
      AND COALESCE(ou.rec_status, 1) = 1
  LOOP
    PERFORM public.cmx_rebuild_user_permissions(v_user.user_id, v_user.tenant_org_id);
    v_rebuilt_count := v_rebuilt_count + 1;
  END LOOP;

  RAISE NOTICE 'Stale effective permissions rebuilt for % user/tenant rows', v_rebuilt_count;
END $$;
