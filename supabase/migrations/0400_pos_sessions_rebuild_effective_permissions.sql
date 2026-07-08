-- 0400_pos_sessions_rebuild_effective_permissions.sql
-- Purpose:
--   POS Session Management v1 migration 0396 added new role-default
--   permissions. Existing users can still have stale rows in
--   cmx_effective_permissions because role-default changes do not trigger the
--   rebuild function automatically. Rebuild all active user/tenant permission
--   caches so the POS Sessions page/API can resolve pos_session:* grants.
--
-- Safety:
--   - No schema changes.
--   - No permission grants beyond those already seeded into role defaults.
--   - Idempotent: cmx_rebuild_user_permissions deletes/recomputes each
--     user/tenant effective-permission set from the current RBAC source tables.

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

  RAISE NOTICE 'POS session effective permissions rebuilt for % user/tenant rows', v_rebuilt_count;
END $$;
