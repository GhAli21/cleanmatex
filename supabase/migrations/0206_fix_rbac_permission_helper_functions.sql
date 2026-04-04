-- Align RBAC helper functions with the current effective-permissions model.
--
-- Fixes:
-- 1) has_resource_permission() currently calls cmx_can() with an outdated positional signature.
-- 2) has_any_permission() / has_all_permissions() should call cmx_can() using named arguments
--    to avoid future signature drift.
-- 3) get_user_permissions_jh() currently reads legacy org_users_mst.role mappings instead of the
--    authoritative cmx_effective_permissions cache.
-- 4) get_user_role_compat() should rank super_admin above tenant_admin for stable compatibility.
--
-- Scope:
-- - Function-only migration
-- - No schema, trigger, or policy changes

CREATE OR REPLACE FUNCTION get_user_permissions_jh(
  p_cur_user_id UUID DEFAULT NULL,
  p_cur_tenant_org_id UUID DEFAULT NULL
)
RETURNS TABLE(permission_code TEXT, resource_type TEXT, resource_id UUID)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT
    ep.permission_code,
    ep.resource_type,
    ep.resource_id
  FROM cmx_effective_permissions ep
  WHERE ep.user_id = COALESCE(p_cur_user_id, auth.uid())
    AND ep.tenant_org_id = COALESCE(p_cur_tenant_org_id, current_tenant_id())
    AND ep.allow = true;
$$;

COMMENT ON FUNCTION get_user_permissions_jh IS 'Get effective permissions for a specific or current user/tenant using the authoritative effective-permissions cache';

CREATE OR REPLACE FUNCTION has_permission(p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT cmx_can(p_perm => p_permission);
$$;

COMMENT ON FUNCTION has_permission IS 'Check if current user has a specific tenant-wide permission using cmx_can';

CREATE OR REPLACE FUNCTION has_resource_permission(
  p_permission TEXT,
  p_resource_type TEXT,
  p_resource_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT cmx_can(
    p_perm => p_permission,
    p_resource_type => p_resource_type,
    p_resource_id => p_resource_id
  );
$$;

COMMENT ON FUNCTION has_resource_permission IS 'Check if current user has a specific resource-scoped permission using cmx_can';

CREATE OR REPLACE FUNCTION has_any_permission(p_permissions TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM unnest(p_permissions) AS perm
    WHERE cmx_can(p_perm => perm)
  );
$$;

COMMENT ON FUNCTION has_any_permission IS 'Check if current user has any of the specified permissions using cmx_can';

CREATE OR REPLACE FUNCTION has_all_permissions(p_permissions TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT (
    SELECT COUNT(*) = array_length(p_permissions, 1)
    FROM unnest(p_permissions) AS perm
    WHERE cmx_can(p_perm => perm)
  );
$$;

COMMENT ON FUNCTION has_all_permissions IS 'Check if current user has all of the specified permissions using cmx_can';

CREATE OR REPLACE FUNCTION get_user_role_compat(
  p_user_id UUID,
  p_tenant_id UUID
)
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (
      SELECT sr.code
      FROM org_auth_user_roles oaur
      JOIN sys_auth_roles sr ON sr.code = oaur.role_code
      WHERE oaur.user_id = p_user_id
        AND oaur.tenant_org_id = p_tenant_id
        AND oaur.is_active = true
      ORDER BY CASE sr.code
        WHEN 'super_admin' THEN 0
        WHEN 'tenant_admin' THEN 1
        WHEN 'operator' THEN 2
        WHEN 'viewer' THEN 3
        ELSE 100
      END,
      sr.code
      LIMIT 1
    ),
    (
      SELECT role
      FROM org_users_mst
      WHERE user_id = p_user_id
        AND tenant_org_id = p_tenant_id
        AND is_active = true
      LIMIT 1
    )
  );
$$;

COMMENT ON FUNCTION get_user_role_compat IS 'Get the highest-priority role for backward compatibility, preferring RBAC roles over legacy org_users_mst.role';
