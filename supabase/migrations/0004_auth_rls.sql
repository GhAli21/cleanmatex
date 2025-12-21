-- 0005_auth_rls.sql — Authentication RLS Policies & Helper Functions
-- Purpose: Implement Row-Level Security for auth tables and create helper functions
-- Author: CleanMateX Development Team
-- Created: 2025-10-17

BEGIN;

-- =========================
-- RLS HELPER FUNCTIONS (in public schema)
-- =========================

-- Get current tenant ID from JWT claims
CREATE OR REPLACE FUNCTION current_tenant_id()
RETURNS UUID AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::json->>'tenant_org_id',
    ''
  )::UUID;
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION current_tenant_id IS 'Extract tenant_org_id from JWT claims';

-- Get current user ID from JWT
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS UUID AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true)::json->>'sub', '')::UUID,
    auth.uid()
  );
$$ LANGUAGE SQL STABLE;

COMMENT ON FUNCTION current_user_id IS 'Extract user ID (sub claim) from JWT';

-- Get current user role within tenant
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS VARCHAR AS $$
  SELECT role
  FROM org_users_mst
  WHERE user_id = auth.uid()
    AND tenant_org_id = current_tenant_id()
    AND is_active = true
  LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

COMMENT ON FUNCTION current_user_role IS 'Get current user role within active tenant';

-- Check if current user is admin in their tenant
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role in('super_admin', 'tenant_admin')
      AND is_active = true
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

COMMENT ON FUNCTION is_admin IS 'Check if current user has admin role in active tenant';

-- Check if current user is at least operator (admin or operator)
CREATE OR REPLACE FUNCTION is_operator()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role IN ('super_admin', 'tenant_admin', 'operator')
      AND is_active = true
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

COMMENT ON FUNCTION is_operator IS 'Check if current user has operator or admin role';

-- Check if user has access to specific tenant
CREATE OR REPLACE FUNCTION has_tenant_access(p_tenant_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = p_tenant_id
      AND is_active = true
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

COMMENT ON FUNCTION has_tenant_access IS 'Check if user has access to specified tenant';

-- =========================
-- ENABLE RLS ON AUTH TABLES
-- =========================

ALTER TABLE org_users_mst ENABLE ROW LEVEL SECURITY;
-- sys_audit_log remains without RLS (accessed via service role only)

-- =========================
-- RLS POLICIES: org_users_mst
-- =========================

-- Policy 1: Users can view their own records across all tenants
CREATE POLICY user_view_own_records ON org_users_mst
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy 2: Users can update their own non-critical fields (display_name, preferences)
-- Note: WITH CHECK cannot reference OLD, so we rely on application logic to prevent
-- users from changing their own tenant_org_id, role, or is_active status
CREATE POLICY user_update_own_profile ON org_users_mst
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy 3: Admins can view all users in their tenant
CREATE POLICY admin_view_tenant_users ON org_users_mst
  FOR SELECT
  USING (
    tenant_org_id = current_tenant_id()
    AND is_admin()
  );

-- Policy 4: Admins can create users in their tenant
CREATE POLICY admin_create_tenant_users ON org_users_mst
  FOR INSERT
  WITH CHECK (
    tenant_org_id = current_tenant_id()
    AND is_admin()
  );

-- Policy 5: Admins can update users in their tenant (except themselves)
CREATE POLICY admin_update_tenant_users ON org_users_mst
  FOR UPDATE
  USING (
    tenant_org_id = current_tenant_id()
    AND is_admin()
    AND user_id != auth.uid() -- Cannot modify own record via admin panel
  )
  WITH CHECK (
    tenant_org_id = current_tenant_id()
    AND is_admin()
    AND user_id != auth.uid()
  );

-- Policy 6: Admins can delete (soft delete via is_active) users in their tenant
CREATE POLICY admin_delete_tenant_users ON org_users_mst
  FOR DELETE
  USING (
    tenant_org_id = current_tenant_id()
    AND is_admin()
    AND user_id != auth.uid() -- Cannot delete self
  );

-- Policy 7: Service role has full access (for system operations)
CREATE POLICY service_role_full_access ON org_users_mst
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =========================
-- ENHANCED RLS: UPDATE EXISTING POLICIES
-- =========================

-- Update org_tenants_mst policies to use helper functions
DROP POLICY IF EXISTS tenant_isolation_org_tenants ON org_tenants_mst;

CREATE POLICY tenant_access_own_tenant ON org_tenants_mst
  FOR ALL
  USING (id = current_tenant_id());

-- Admins can see their tenant details
CREATE POLICY admin_view_tenant_details ON org_tenants_mst
  FOR SELECT
  USING (
    id = current_tenant_id()
    AND is_admin()
  );

-- Service role full access
CREATE POLICY service_role_tenants_access ON org_tenants_mst
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- =========================
-- FUNCTION: GET USER TENANTS
-- =========================

-- Returns all tenants accessible by current user 
CREATE OR REPLACE FUNCTION get_user_tenants()
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

COMMENT ON FUNCTION get_user_tenants IS 'Get all tenants accessible by current authenticated user';

-- version2

CREATE OR REPLACE FUNCTION get_user_tenants_u(p_cur_user_id  UUID DEFAULT NULL)
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

COMMENT ON FUNCTION get_user_tenants_u IS 'Get all tenants accessible by current authenticated user or p_cur_user_id';

-- =========================
-- FUNCTION: SWITCH TENANT CONTEXT
-- =========================

-- Updates last_login_at for user-tenant association and returns tenant info
CREATE OR REPLACE FUNCTION switch_tenant_context(p_tenant_id UUID)
RETURNS TABLE (
  tenant_id UUID,
  tenant_name VARCHAR,
  tenant_slug VARCHAR,
  user_role VARCHAR,
  success BOOLEAN,
  message TEXT
) AS $$
DECLARE
  v_has_access BOOLEAN;
  v_user_record RECORD;
BEGIN
  -- Check if user has access to this tenant
  SELECT EXISTS (
    SELECT 1
    FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = p_tenant_id
      AND is_active = true
  ) INTO v_has_access;

  IF NOT v_has_access THEN
    RETURN QUERY
    SELECT
      NULL::UUID,
      NULL::VARCHAR,
      NULL::VARCHAR,
      NULL::VARCHAR,
      false,
      'Access denied: User does not have access to this tenant'::TEXT;
    RETURN;
  END IF;

  -- Update last login and increment login count
  UPDATE org_users_mst
  SET
    last_login_at = NOW(),
    login_count = COALESCE(login_count, 0) + 1,
    updated_at = NOW()
  WHERE user_id = auth.uid()
    AND tenant_org_id = p_tenant_id
  RETURNING * INTO v_user_record;

  -- Log the tenant switch
  PERFORM log_audit_event(
    auth.uid(),
    p_tenant_id,
    'tenant_switch',
    'tenant',
    p_tenant_id,
    NULL,
    jsonb_build_object('tenant_id', p_tenant_id, 'timestamp', NOW()),
    NULL,
    NULL,
    NULL,
    'success',
    NULL
  );

  -- Return tenant info
  RETURN QUERY
  SELECT
    t.id AS tenant_id,
    t.name AS tenant_name,
    t.slug AS tenant_slug,
    v_user_record.role AS user_role,
    true AS success,
    'Tenant context switched successfully'::TEXT AS message
  FROM org_tenants_mst t
  WHERE t.id = p_tenant_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION switch_tenant_context IS 'Switch active tenant context and update last login timestamp';

-- =========================
-- FUNCTION: RECORD LOGIN ATTEMPT
-- =========================

-- Records login attempts in audit log (called from application)
CREATE OR REPLACE FUNCTION record_login_attempt(
  p_email VARCHAR,
  p_success BOOLEAN,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_user_id UUID;
  v_log_id UUID;
BEGIN
  -- Try to find user by email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email
  LIMIT 1;

  -- Log the attempt
  SELECT log_audit_event(
    v_user_id,
    NULL, -- No tenant context yet
    CASE WHEN p_success THEN 'login_success' ELSE 'login_failure' END,
    'user',
    v_user_id,
    NULL,
    jsonb_build_object('email', p_email, 'timestamp', NOW()),
    p_ip_address,
    p_user_agent,
    NULL,
    CASE WHEN p_success THEN 'success' ELSE 'failure' END,
    p_error_message
  ) INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION record_login_attempt IS 'Record login attempts for audit and security monitoring';

-- =========================
-- VALIDATION & TESTING
-- =========================

-- Verify helper functions exist
DO $$
BEGIN
  ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname = 'current_tenant_id') > 0,
    'current_tenant_id function not created';
  ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname = 'is_admin') > 0,
    'is_admin function not created';
  ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname = 'get_user_tenants') > 0,
    'get_user_tenants function not created';

  -- Verify RLS is enabled
  ASSERT (SELECT relrowsecurity FROM pg_class WHERE relname = 'org_users_mst') = true,
    'RLS not enabled on org_users_mst';

  RAISE NOTICE '✅ Auth RLS policies and helper functions created successfully';
END $$;

COMMIT;

-- Rollback instructions (save to 0005_auth_rls_rollback.sql if needed):
-- BEGIN;
-- DROP POLICY IF EXISTS user_view_own_records ON org_users_mst;
-- DROP POLICY IF EXISTS user_update_own_profile ON org_users_mst;
-- DROP POLICY IF EXISTS admin_view_tenant_users ON org_users_mst;
-- DROP POLICY IF EXISTS admin_create_tenant_users ON org_users_mst;
-- DROP POLICY IF EXISTS admin_update_tenant_users ON org_users_mst;
-- DROP POLICY IF EXISTS admin_delete_tenant_users ON org_users_mst;
-- DROP POLICY IF EXISTS service_role_full_access ON org_users_mst;
-- DROP FUNCTION IF EXISTS current_tenant_id CASCADE;
-- DROP FUNCTION IF EXISTS current_user_id CASCADE;
-- DROP FUNCTION IF EXISTS current_user_role CASCADE;
-- DROP FUNCTION IF EXISTS is_admin CASCADE;
-- DROP FUNCTION IF EXISTS is_operator CASCADE;
-- DROP FUNCTION IF EXISTS has_tenant_access CASCADE;
-- DROP FUNCTION IF EXISTS get_user_tenants CASCADE;
-- DROP FUNCTION IF EXISTS switch_tenant_context CASCADE;
-- DROP FUNCTION IF EXISTS record_login_attempt CASCADE;
-- COMMIT;
