-- ============================================================================
-- Migration: 0845_fix_get_user_tenants_last_login_timestamptz.sql
-- Purpose:
--   1. Align column 8 (last_login_at) of get_user_tenants(),
--      get_user_tenants_u(UUID), and get_user_tenants_jh(UUID) from
--      TIMESTAMP (without time zone) to TIMESTAMPTZ after migration
--      0839_org_remaining_event_stamps_timestamptz.sql converted
--      public.org_users_mst.last_login_at to timestamptz.
--   2. Add public.is_tenant_admin(p_user_id UUID DEFAULT NULL) and update
--      public.is_admin() and public.current_user_role() so role checks read
--      from BOTH public.org_auth_user_roles (role_code) and
--      public.org_users_mst (role) within public.current_tenant_id().
--   3. Migrate the 8 RLS policies previously bound to get_user_tenants() to
--      public.current_tenant_id() (and public.is_admin() on
--      org_order_edit_locks_delete_policy), decoupling RLS from
--      get_user_tenants() and enforcing active-session & lock invariants.
--
-- Safety:
--   - PostgreSQL forbids changing RETURNS TABLE / scalar return types via
--     CREATE OR REPLACE FUNCTION (42P13). Dependent RLS policies are dropped
--     explicitly first so DROP FUNCTION ... RESTRICT succeeds without CASCADE
--     and fails safe if any unlisted dependent exists.
--   - All functions pin search_path = pg_catalog, public, auth, pg_temp and
--     restore explicit 0746-aligned execute grants (closed to PUBLIC/anon).
--   - Everything runs atomically inside BEGIN; ... COMMIT;.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Temporarily drop the 8 RLS policies that reference get_user_tenants()
--    so the functions can be dropped safely with RESTRICT (no CASCADE).
-- ----------------------------------------------------------------------------

-- Remove dependent policy on org_svc_cat_proc_steps_cf before RESTRICT drop; recreated using current_tenant_id() in section 6.
DROP POLICY IF EXISTS tenant_isolation_org_svc_cat_proc_steps_cf ON public.org_svc_cat_proc_steps_cf;

-- Remove dependent policy on org_inv_stock_tr before RESTRICT drop; recreated using current_tenant_id() in section 6.
DROP POLICY IF EXISTS tenant_isolation_org_inv_stock_tr ON public.org_inv_stock_tr;

-- Remove dependent policy on org_inv_stock_by_branch before RESTRICT drop; recreated using current_tenant_id() in section 6.
DROP POLICY IF EXISTS tenant_isolation_org_inv_stock_by_branch ON public.org_inv_stock_by_branch;

-- Remove dependent policies on org_order_edit_locks before RESTRICT drop; recreated using current_tenant_id() / is_admin() in section 6.
DROP POLICY IF EXISTS org_order_edit_locks_select_policy ON public.org_order_edit_locks;
DROP POLICY IF EXISTS org_order_edit_locks_insert_policy ON public.org_order_edit_locks;
DROP POLICY IF EXISTS org_order_edit_locks_delete_policy ON public.org_order_edit_locks;

-- Remove dependent policies on org_order_edit_history before RESTRICT drop; recreated using current_tenant_id() in section 6.
DROP POLICY IF EXISTS org_order_edit_history_select_policy ON public.org_order_edit_history;
DROP POLICY IF EXISTS org_order_edit_history_insert_policy ON public.org_order_edit_history;

-- ----------------------------------------------------------------------------
-- 2. Drop the 3 get_user_tenants* functions and current_user_role() with
--    RESTRICT so return types can be updated safely (no silent CASCADE).
-- ----------------------------------------------------------------------------

-- Drop existing overload whose RETURNS TABLE declares last_login_at as TIMESTAMP.
DROP FUNCTION IF EXISTS public.get_user_tenants() RESTRICT;

-- Drop parameterized helper whose RETURNS TABLE declares last_login_at as TIMESTAMP.
DROP FUNCTION IF EXISTS public.get_user_tenants_u(UUID) RESTRICT;

-- Drop legacy helper whose RETURNS TABLE declares last_login_at as TIMESTAMP.
DROP FUNCTION IF EXISTS public.get_user_tenants_jh(UUID) RESTRICT;

-- Drop legacy current_user_role() whose return type was VARCHAR (org_users_mst.role became TEXT in 0650).
DROP FUNCTION IF EXISTS public.current_user_role() RESTRICT;

-- ----------------------------------------------------------------------------
-- 3. Recreate all 3 get_user_tenants* functions with TIMESTAMPTZ, explicit
--    TEXT casts, and locked search_path (preserving 0299 and 0746 invariants).
-- ----------------------------------------------------------------------------

-- Returns active tenant memberships for the current authenticated user (auth.uid()).
CREATE FUNCTION public.get_user_tenants()
RETURNS TABLE (
  tenant_id        UUID,
  tenant_name      TEXT,
  tenant_slug      TEXT,
  user_id          UUID,
  org_user_id      UUID,
  user_role        TEXT,
  is_active        BOOLEAN,
  last_login_at    TIMESTAMPTZ,
  s_current_plan   TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id                                              AS tenant_id,
    t.name::TEXT                                      AS tenant_name,
    t.slug::TEXT                                      AS tenant_slug,
    u.user_id                                         AS user_id,
    u.id                                              AS org_user_id,
    u.role::TEXT                                      AS user_role,
    u.is_active                                       AS is_active,
    u.last_login_at                                   AS last_login_at,
    COALESCE(t.s_current_plan, 'FREE_TRIAL')::TEXT    AS s_current_plan
  FROM public.org_users_mst u
  INNER JOIN public.org_tenants_mst t ON u.tenant_org_id = t.id
  WHERE u.user_id = auth.uid()
    AND u.is_active = true
    AND t.is_active = true
  ORDER BY u.last_login_at DESC NULLS LAST;
END;
$$;

COMMENT ON FUNCTION public.get_user_tenants() IS
  'Get all active tenants accessible by the current authenticated user (auth.uid()), including s_current_plan and UTC last_login_at (timestamptz).';

-- Returns active tenant memberships for p_cur_user_id (or auth.uid() when NULL); service_role only.
CREATE FUNCTION public.get_user_tenants_u(p_cur_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  tenant_id        UUID,
  tenant_name      TEXT,
  tenant_slug      TEXT,
  user_id          UUID,
  org_user_id      UUID,
  user_role        TEXT,
  is_active        BOOLEAN,
  last_login_at    TIMESTAMPTZ,
  s_current_plan   TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id                                              AS tenant_id,
    t.name::TEXT                                      AS tenant_name,
    t.slug::TEXT                                      AS tenant_slug,
    u.user_id                                         AS user_id,
    u.id                                              AS org_user_id,
    u.role::TEXT                                      AS user_role,
    u.is_active                                       AS is_active,
    u.last_login_at                                   AS last_login_at,
    COALESCE(t.s_current_plan, 'FREE_TRIAL')::TEXT    AS s_current_plan
  FROM public.org_users_mst u
  INNER JOIN public.org_tenants_mst t ON u.tenant_org_id = t.id
  WHERE u.user_id = COALESCE(p_cur_user_id, auth.uid())
    AND u.is_active = true
    AND t.is_active = true
  ORDER BY u.last_login_at DESC NULLS LAST;
END;
$$;

COMMENT ON FUNCTION public.get_user_tenants_u(UUID) IS
  'Get all active tenants accessible by p_cur_user_id (or auth.uid() when NULL), including s_current_plan and UTC last_login_at (timestamptz).';

-- Legacy helper returning active tenant memberships without s_current_plan; service_role only.
CREATE FUNCTION public.get_user_tenants_jh(p_cur_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  tenant_id        UUID,
  tenant_name      TEXT,
  tenant_slug      TEXT,
  user_id          UUID,
  org_user_id      UUID,
  user_role        TEXT,
  is_active        BOOLEAN,
  last_login_at    TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id              AS tenant_id,
    t.name::TEXT      AS tenant_name,
    t.slug::TEXT      AS tenant_slug,
    u.user_id         AS user_id,
    u.id              AS org_user_id,
    u.role::TEXT      AS user_role,
    u.is_active       AS is_active,
    u.last_login_at   AS last_login_at
  FROM public.org_users_mst u
  INNER JOIN public.org_tenants_mst t ON u.tenant_org_id = t.id
  WHERE u.user_id = COALESCE(p_cur_user_id, auth.uid())
    AND u.is_active = true
    AND t.is_active = true
  ORDER BY u.last_login_at DESC NULLS LAST;
END;
$$;

COMMENT ON FUNCTION public.get_user_tenants_jh(UUID) IS
  'Legacy helper to get active tenants accessible by p_cur_user_id (or auth.uid() when NULL) with UTC last_login_at (timestamptz).';

-- ----------------------------------------------------------------------------
-- 4. Create is_tenant_admin(p_user_id) and update is_admin() and
--    current_user_role() to check BOTH org_auth_user_roles and org_users_mst
--    scoped strictly to public.current_tenant_id().
-- ----------------------------------------------------------------------------

-- Checks whether p_user_id (default auth.uid()) is an active, unlocked admin
-- of the active session tenant via either org_users_mst.role or org_auth_user_roles.role_code.
CREATE OR REPLACE FUNCTION public.is_tenant_admin(p_user_id UUID DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
DECLARE
  v_tenant_id UUID;
  v_caller_id UUID;
  v_target_id UUID;
BEGIN
  v_tenant_id := public.current_tenant_id();
  v_caller_id := auth.uid();
  v_target_id := COALESCE(p_user_id, v_caller_id);

  IF v_tenant_id IS NULL OR v_target_id IS NULL THEN
    RETURN false;
  END IF;

  -- Prevent non-admin authenticated callers from probing another user's admin status.
  IF p_user_id IS NOT NULL AND v_caller_id IS NOT NULL AND v_target_id <> v_caller_id THEN
    IF NOT public.is_tenant_admin(NULL) THEN
      RETURN false;
    END IF;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.org_users_mst ou
    WHERE ou.user_id = v_target_id
      AND ou.tenant_org_id = v_tenant_id
      AND ou.is_active = true
      AND ou.is_membership_locked = false
      AND (
        ou.role IN ('super_admin', 'tenant_admin', 'admin', 'owner')
        OR EXISTS (
          SELECT 1
          FROM public.org_auth_user_roles our
          WHERE our.user_id = v_target_id
            AND our.tenant_org_id = v_tenant_id
            AND our.is_active = true
            AND our.role_code IN ('super_admin', 'tenant_admin', 'admin', 'owner')
        )
      )
  );
END;
$$;

COMMENT ON FUNCTION public.is_tenant_admin(UUID) IS
  'True when p_user_id (default auth.uid()) has an active, unlocked membership in current_tenant_id() with an admin role (super_admin, tenant_admin, admin, owner) in either org_users_mst.role or org_auth_user_roles.role_code. Non-admin JWT callers cannot inspect other users.';

-- Single-source-of-truth admin check for RLS policies; preserves all 21 existing RBAC policies from 0650.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
  SELECT public.is_tenant_admin(NULL);
$$;

COMMENT ON FUNCTION public.is_admin() IS
  'True when auth.uid() is an active, unlocked admin (super_admin, tenant_admin, admin, owner) of current_tenant_id() via org_users_mst or org_auth_user_roles. Delegates to is_tenant_admin(NULL).';

-- Returns the highest-priority active role code for auth.uid() in current_tenant_id()
-- across both org_auth_user_roles.role_code and org_users_mst.role.
CREATE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
  WITH active_membership AS (
    SELECT ou.tenant_org_id, ou.user_id, ou.role::TEXT AS primary_role
    FROM public.org_users_mst ou
    WHERE ou.user_id = auth.uid()
      AND ou.tenant_org_id = public.current_tenant_id()
      AND ou.is_active = true
      AND ou.is_membership_locked = false
    LIMIT 1
  ),
  all_roles AS (
    SELECT our.role_code::TEXT AS role_code
    FROM public.org_auth_user_roles our
    INNER JOIN active_membership am
      ON am.tenant_org_id = our.tenant_org_id
     AND am.user_id = our.user_id
    WHERE our.is_active = true
    UNION
    SELECT am.primary_role AS role_code
    FROM active_membership am
    WHERE am.primary_role IS NOT NULL
  )
  SELECT ar.role_code
  FROM all_roles ar
  ORDER BY
    CASE ar.role_code
      WHEN 'super_admin'  THEN 1
      WHEN 'tenant_admin' THEN 2
      WHEN 'admin'        THEN 3
      WHEN 'owner'        THEN 4
      ELSE 100
    END,
    ar.role_code
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.current_user_role() IS
  'Returns the highest-priority active role code (TEXT) for auth.uid() in current_tenant_id() across both org_auth_user_roles.role_code and org_users_mst.role.';

-- ----------------------------------------------------------------------------
-- 5. Restore execute grants matching 0746 security lockdown
--    - get_user_tenants(), is_tenant_admin(UUID), is_admin(), current_user_role():
--      authenticated + service_role (never PUBLIC/anon)
--    - get_user_tenants_u(UUID), get_user_tenants_jh(UUID): service_role only
-- ----------------------------------------------------------------------------

-- Keep get_user_tenants() closed to PUBLIC and anon; allow authenticated JWT callers and service_role.
REVOKE ALL ON FUNCTION public.get_user_tenants() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_tenants() TO authenticated, service_role;

-- Keep parameterized get_user_tenants_u(UUID) closed to PUBLIC, anon, and authenticated; service_role only.
REVOKE ALL ON FUNCTION public.get_user_tenants_u(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tenants_u(UUID) TO service_role;

-- Keep legacy get_user_tenants_jh(UUID) closed to PUBLIC, anon, and authenticated; service_role only.
REVOKE ALL ON FUNCTION public.get_user_tenants_jh(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_tenants_jh(UUID) TO service_role;

-- Allow authenticated JWT callers (and RLS evaluation) and service_role to call is_tenant_admin(UUID); keep closed to PUBLIC and anon.
REVOKE ALL ON FUNCTION public.is_tenant_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tenant_admin(UUID) TO authenticated, service_role;

-- Allow authenticated JWT callers (and RLS evaluation) and service_role to call is_admin(); keep closed to PUBLIC and anon.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- Allow authenticated JWT callers and service_role to call current_user_role(); keep closed to PUBLIC and anon.
REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. Recreate the 8 RLS policies using public.current_tenant_id() (and
--    public.is_admin() for order edit lock release) so no policy depends on
--    get_user_tenants() anymore.
-- ----------------------------------------------------------------------------

-- Restrict org_svc_cat_proc_steps_cf access to the caller's active session tenant.
CREATE POLICY tenant_isolation_org_svc_cat_proc_steps_cf ON public.org_svc_cat_proc_steps_cf
  FOR ALL
  USING (tenant_org_id = (SELECT public.current_tenant_id()))
  WITH CHECK (tenant_org_id = (SELECT public.current_tenant_id()));

COMMENT ON POLICY tenant_isolation_org_svc_cat_proc_steps_cf ON public.org_svc_cat_proc_steps_cf IS
  'Tenant isolation policy scoping all operations on org_svc_cat_proc_steps_cf to current_tenant_id().';

-- Restrict org_inv_stock_tr access to the caller's active session tenant.
CREATE POLICY tenant_isolation_org_inv_stock_tr ON public.org_inv_stock_tr
  FOR ALL
  USING (tenant_org_id = (SELECT public.current_tenant_id()))
  WITH CHECK (tenant_org_id = (SELECT public.current_tenant_id()));

COMMENT ON POLICY tenant_isolation_org_inv_stock_tr ON public.org_inv_stock_tr IS
  'Tenant isolation policy scoping all operations on org_inv_stock_tr to current_tenant_id().';

-- Restrict org_inv_stock_by_branch access to the caller's active session tenant.
CREATE POLICY tenant_isolation_org_inv_stock_by_branch ON public.org_inv_stock_by_branch
  FOR ALL
  USING (tenant_org_id = (SELECT public.current_tenant_id()))
  WITH CHECK (tenant_org_id = (SELECT public.current_tenant_id()));

COMMENT ON POLICY tenant_isolation_org_inv_stock_by_branch ON public.org_inv_stock_by_branch IS
  'Tenant isolation policy scoping all operations on org_inv_stock_by_branch to current_tenant_id().';

-- Allow reading order edit locks only within the caller's active session tenant.
CREATE POLICY org_order_edit_locks_select_policy ON public.org_order_edit_locks
  FOR SELECT
  USING (tenant_org_id = (SELECT public.current_tenant_id()));

COMMENT ON POLICY org_order_edit_locks_select_policy ON public.org_order_edit_locks IS
  'Tenant isolation SELECT policy for org_order_edit_locks scoped to current_tenant_id().';

-- Allow inserting order edit locks only for the caller's active session tenant and own user id.
CREATE POLICY org_order_edit_locks_insert_policy ON public.org_order_edit_locks
  FOR INSERT
  WITH CHECK (
    tenant_org_id = (SELECT public.current_tenant_id())
    AND locked_by = (SELECT auth.uid())
  );

COMMENT ON POLICY org_order_edit_locks_insert_policy ON public.org_order_edit_locks IS
  'Tenant isolation INSERT policy ensuring callers only create order edit locks for themselves within current_tenant_id().';

-- Allow deleting order edit locks within the caller's active session tenant by the lock holder or a tenant admin.
CREATE POLICY org_order_edit_locks_delete_policy ON public.org_order_edit_locks
  FOR DELETE
  USING (
    tenant_org_id = (SELECT public.current_tenant_id())
    AND (
      locked_by = (SELECT auth.uid())
      OR (SELECT public.is_admin())
    )
  );

COMMENT ON POLICY org_order_edit_locks_delete_policy ON public.org_order_edit_locks IS
  'Allows lock owner or active tenant admin (is_admin()) to release order edit locks within current_tenant_id().';

-- Allow reading order edit history only within the caller's active session tenant.
CREATE POLICY org_order_edit_history_select_policy ON public.org_order_edit_history
  FOR SELECT
  USING (tenant_org_id = (SELECT public.current_tenant_id()));

COMMENT ON POLICY org_order_edit_history_select_policy ON public.org_order_edit_history IS
  'Tenant isolation SELECT policy for org_order_edit_history scoped to current_tenant_id().';

-- Allow inserting order edit history only for the caller's active session tenant and own user id.
CREATE POLICY org_order_edit_history_insert_policy ON public.org_order_edit_history
  FOR INSERT
  WITH CHECK (
    tenant_org_id = (SELECT public.current_tenant_id())
    AND edited_by = (SELECT auth.uid())
  );

COMMENT ON POLICY org_order_edit_history_insert_policy ON public.org_order_edit_history IS
  'Tenant isolation INSERT policy ensuring callers only record order edit history under their own user id within current_tenant_id().';

COMMIT;
