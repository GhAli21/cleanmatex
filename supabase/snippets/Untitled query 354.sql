-- =====================================================
-- Migration: Fix get_user_tenants VARCHAR → TEXT mismatch
-- Date: 2026-05-18
-- Description: org_users_mst.role and org_tenants_mst columns are TEXT,
--              but get_user_tenants() / get_user_tenants_u() declared their
--              return types as VARCHAR. PostgreSQL raises error 42804
--              ("Returned type text does not match expected type character varying")
--              on every call. Fix by aligning return type to TEXT throughout.
--
-- DROP CASCADE discovery: same 8 RLS policies as migration 0155/0156.
-- All are recreated below in the same transaction.
-- =====================================================

BEGIN;

-- 1. Drop both functions (CASCADE drops 8 dependent RLS policies)
DROP FUNCTION IF EXISTS get_user_tenants() CASCADE;
DROP FUNCTION IF EXISTS get_user_tenants_u(UUID) CASCADE;

-- 2. Recreate get_user_tenants() with TEXT return types
CREATE FUNCTION get_user_tenants()
RETURNS TABLE (
  tenant_id        UUID,
  tenant_name      TEXT,
  tenant_slug      TEXT,
  user_id          UUID,
  org_user_id      UUID,
  user_role        TEXT,
  is_active        BOOLEAN,
  last_login_at    TIMESTAMP,
  s_current_plan   TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id                                              AS tenant_id,
    t.name                                            AS tenant_name,
    t.slug                                            AS tenant_slug,
    u.user_id                                         AS user_id,
    u.id                                              AS org_user_id,
    u.role                                            AS user_role,
    u.is_active                                       AS is_active,
    u.last_login_at                                   AS last_login_at,
    COALESCE(t.s_current_plan, 'FREE_TRIAL')::TEXT    AS s_current_plan
  FROM org_users_mst u
  INNER JOIN org_tenants_mst t ON u.tenant_org_id = t.id
  WHERE u.user_id = auth.uid()
    AND u.is_active = true
    AND t.is_active = true
  ORDER BY u.last_login_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- 3. Recreate get_user_tenants_u() with TEXT return types
CREATE FUNCTION get_user_tenants_u(p_cur_user_id UUID DEFAULT NULL)
RETURNS TABLE (
  tenant_id        UUID,
  tenant_name      TEXT,
  tenant_slug      TEXT,
  user_id          UUID,
  org_user_id      UUID,
  user_role        TEXT,
  is_active        BOOLEAN,
  last_login_at    TIMESTAMP,
  s_current_plan   TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id                                              AS tenant_id,
    t.name                                            AS tenant_name,
    t.slug                                            AS tenant_slug,
    u.user_id                                         AS user_id,
    u.id                                              AS org_user_id,
    u.role                                            AS user_role,
    u.is_active                                       AS is_active,
    u.last_login_at                                   AS last_login_at,
    COALESCE(t.s_current_plan, 'FREE_TRIAL')::TEXT    AS s_current_plan
  FROM org_users_mst u
  INNER JOIN org_tenants_mst t ON u.tenant_org_id = t.id
  WHERE u.user_id = COALESCE(p_cur_user_id, auth.uid())
    AND u.is_active = true
    AND t.is_active = true
  ORDER BY u.last_login_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_user_tenants()        IS 'Get all tenants accessible by current authenticated user, including s_current_plan';
COMMENT ON FUNCTION get_user_tenants_u(UUID)  IS 'Get all tenants accessible by current authenticated user or p_cur_user_id, including s_current_plan';

-- 4. Recreate the 8 RLS policies dropped by CASCADE (same as 0155 / 0156)

-- org_svc_cat_proc_steps_cf
DROP POLICY IF EXISTS tenant_isolation_org_svc_cat_proc_steps_cf ON org_svc_cat_proc_steps_cf;
CREATE POLICY tenant_isolation_org_svc_cat_proc_steps_cf ON org_svc_cat_proc_steps_cf
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()))
  WITH CHECK (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- org_inv_stock_tr
DROP POLICY IF EXISTS tenant_isolation_org_inv_stock_tr ON org_inv_stock_tr;
CREATE POLICY tenant_isolation_org_inv_stock_tr ON org_inv_stock_tr
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()))
  WITH CHECK (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- org_inv_stock_by_branch
DROP POLICY IF EXISTS tenant_isolation_org_inv_stock_by_branch ON org_inv_stock_by_branch;
CREATE POLICY tenant_isolation_org_inv_stock_by_branch ON org_inv_stock_by_branch
  FOR ALL
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()))
  WITH CHECK (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

-- org_order_edit_locks (3 policies)
DROP POLICY IF EXISTS org_order_edit_locks_select_policy ON org_order_edit_locks;
CREATE POLICY org_order_edit_locks_select_policy ON org_order_edit_locks
  FOR SELECT
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

DROP POLICY IF EXISTS org_order_edit_locks_insert_policy ON org_order_edit_locks;
CREATE POLICY org_order_edit_locks_insert_policy ON org_order_edit_locks
  FOR INSERT
  WITH CHECK (
    tenant_org_id IN (SELECT tenant_id FROM get_user_tenants())
    AND locked_by = auth.uid()
  );

DROP POLICY IF EXISTS org_order_edit_locks_delete_policy ON org_order_edit_locks;
CREATE POLICY org_order_edit_locks_delete_policy ON org_order_edit_locks
  FOR DELETE
  USING (
    locked_by = auth.uid()
    OR tenant_org_id IN (
      SELECT tenant_id FROM get_user_tenants()
      WHERE user_role IN ('owner', 'super_admin', 'tenant_admin')
    )
  );

-- org_order_edit_history (2 policies)
DROP POLICY IF EXISTS org_order_edit_history_select_policy ON org_order_edit_history;
CREATE POLICY org_order_edit_history_select_policy ON org_order_edit_history
  FOR SELECT
  USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()));

DROP POLICY IF EXISTS org_order_edit_history_insert_policy ON org_order_edit_history;
CREATE POLICY org_order_edit_history_insert_policy ON org_order_edit_history
  FOR INSERT
  WITH CHECK (
    tenant_org_id IN (SELECT tenant_id FROM get_user_tenants())
    AND edited_by = auth.uid()
  );

COMMIT;
