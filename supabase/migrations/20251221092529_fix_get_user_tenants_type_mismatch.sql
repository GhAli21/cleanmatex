-- ==================================================================
-- Fix get_user_tenants function type mismatch
-- Purpose: Fix column type mismatch in get_user_tenants functions
--          user_id and org_user_id should be UUID not VARCHAR
-- Created: 2025-12-21
-- Issue: PostgreSQL error 42804 - Returned type uuid does not match 
--        expected type character varying in column 4
-- ==================================================================

BEGIN;

-- Drop existing functions first (PostgreSQL doesn't allow changing return types)
-- Note: CASCADE is needed because RLS policies depend on these functions.
-- The policies will need to reference the recreated functions after this migration.
DROP FUNCTION IF EXISTS get_user_tenants() CASCADE;
DROP FUNCTION IF EXISTS get_user_tenants_u(p_cur_user_id UUID) CASCADE;

-- Recreate get_user_tenants() function with correct types
CREATE FUNCTION get_user_tenants()
RETURNS TABLE (
  tenant_id UUID,
  tenant_name VARCHAR,
  tenant_slug VARCHAR,
  user_id UUID,
  org_user_id UUID,
  user_role VARCHAR,
  is_active BOOLEAN,
  last_login_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.slug AS tenant_slug,
    u.user_id AS user_id,
    u.id AS org_user_id,
    u.role AS user_role,
    u.is_active AS is_active,
    u.last_login_at AS last_login_at
  FROM org_users_mst u
  INNER JOIN org_tenants_mst t ON u.tenant_org_id = t.id
  WHERE u.user_id = auth.uid()
    AND u.is_active = true
    AND t.is_active = true
  ORDER BY u.last_login_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Recreate get_user_tenants_u() function with correct types
CREATE FUNCTION get_user_tenants_u(p_cur_user_id  UUID DEFAULT NULL)
RETURNS TABLE (
  tenant_id UUID,
  tenant_name VARCHAR,
  tenant_slug VARCHAR,
  user_id UUID,
  org_user_id UUID,
  user_role VARCHAR,
  is_active BOOLEAN,
  last_login_at TIMESTAMP
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.slug AS tenant_slug,
    u.user_id AS user_id,
    u.id AS org_user_id,
    u.role AS user_role,
    u.is_active AS is_active,
    u.last_login_at AS last_login_at
  FROM org_users_mst u
  INNER JOIN org_tenants_mst t ON u.tenant_org_id = t.id
  WHERE u.user_id = COALESCE(p_cur_user_id, auth.uid())
    AND u.is_active = true
    AND t.is_active = true
  ORDER BY u.last_login_at DESC NULLS LAST;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

COMMENT ON FUNCTION get_user_tenants() IS 'Get all tenants accessible by current authenticated user';
COMMENT ON FUNCTION get_user_tenants_u(p_cur_user_id UUID) IS 'Get all tenants accessible by current authenticated user or p_cur_user_id';

-- Note: RLS policies that were dropped by CASCADE will need to be recreated
-- They should reference get_user_tenants() in their USING clauses like:
-- USING (tenant_org_id IN (SELECT tenant_id FROM get_user_tenants()))
-- The policies were originally created in migration 0028_update_rls_to_get_user_tenants.sql
-- If policies are missing after this migration, they need to be recreated.

COMMIT;