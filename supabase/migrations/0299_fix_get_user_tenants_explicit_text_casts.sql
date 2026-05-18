-- =====================================================
-- Migration: Fix get_user_tenants — add explicit ::TEXT casts
-- Date: 2026-05-19
-- Description: org_tenants_mst.name (VARCHAR 255), slug (VARCHAR 100), and
--              org_users_mst.role (VARCHAR 50) are not TEXT. Without explicit
--              ::TEXT casts in the query body PostgreSQL raises error 42804
--              ("Returned type character varying does not match expected type
--              text"). The function signature already declares TEXT (fixed in
--              0298) — this migration adds ::TEXT to the three VARCHAR columns
--              in the SELECT body of both functions.
--
--              Uses CREATE OR REPLACE — no DROP, no CASCADE, RLS policies
--              on dependent tables are unaffected.
-- =====================================================

BEGIN;

CREATE OR REPLACE FUNCTION get_user_tenants()
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
    t.name::TEXT                                      AS tenant_name,
    t.slug::TEXT                                      AS tenant_slug,
    u.user_id                                         AS user_id,
    u.id                                              AS org_user_id,
    u.role::TEXT                                      AS user_role,
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

CREATE OR REPLACE FUNCTION get_user_tenants_u(p_cur_user_id UUID DEFAULT NULL)
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
    t.name::TEXT                                      AS tenant_name,
    t.slug::TEXT                                      AS tenant_slug,
    u.user_id                                         AS user_id,
    u.id                                              AS org_user_id,
    u.role::TEXT                                      AS user_role,
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

COMMIT;
