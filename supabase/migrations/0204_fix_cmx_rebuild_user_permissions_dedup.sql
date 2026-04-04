-- Fix duplicate effective permission inserts when a user has multiple tenant-wide roles
-- that grant the same permission code.
--
-- Root cause:
--   cmx_rebuild_user_permissions() inserted tenant-wide role permissions without
--   deduplicating overlapping permission codes across assigned roles.
--   That could violate idx_cmx_effective_perms_unique during rebuild.
--
-- Scope:
--   Function-only fix. No table, index, RLS, or trigger changes.

CREATE OR REPLACE FUNCTION cmx_rebuild_user_permissions(
  p_user_id UUID,
  p_tenant_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Clear old effective permissions for this user-tenant combination.
  DELETE FROM cmx_effective_permissions
  WHERE user_id = p_user_id
    AND tenant_org_id = p_tenant_id;

  -- 1) Tenant-level roles -> permissions (broadest scope)
  -- Deduplicate overlapping permissions granted by multiple tenant-wide roles.
  INSERT INTO cmx_effective_permissions (
    user_id,
    tenant_org_id,
    permission_code,
    resource_type,
    resource_id,
    allow
  )
  SELECT DISTINCT
    p_user_id,
    p_tenant_id,
    sp.code,
    NULL::TEXT,
    NULL::UUID,
    true
  FROM org_auth_user_roles our
  JOIN sys_auth_role_default_permissions srdp ON srdp.role_code = our.role_code
  JOIN sys_auth_permissions sp ON sp.code = srdp.permission_code
  WHERE our.user_id = p_user_id
    AND our.tenant_org_id = p_tenant_id
    AND our.is_active = true
    AND sp.is_active = true;

  -- 2) Resource-level roles -> permissions (resource-scoped)
  INSERT INTO cmx_effective_permissions (
    user_id,
    tenant_org_id,
    permission_code,
    resource_type,
    resource_id,
    allow
  )
  SELECT DISTINCT ON (p_user_id, p_tenant_id, sp.code, urr.resource_type, urr.resource_id)
    p_user_id,
    p_tenant_id,
    sp.code,
    urr.resource_type,
    urr.resource_id,
    true
  FROM org_auth_user_resource_roles urr
  JOIN sys_auth_role_default_permissions srdp ON srdp.role_code = urr.role_code
  JOIN sys_auth_permissions sp ON sp.code = srdp.permission_code
  WHERE urr.user_id = p_user_id
    AND urr.tenant_org_id = p_tenant_id
    AND urr.is_active = true
    AND sp.is_active = true
  ORDER BY p_user_id, p_tenant_id, sp.code, urr.resource_type, urr.resource_id;

  -- 3) Global user permission overrides (tenant-wide overrides)
  -- Use UPDATE first, then INSERT for new ones.
  UPDATE cmx_effective_permissions ep
  SET allow = oup.allow,
      created_at = NOW()
  FROM org_auth_user_permissions oup
  JOIN sys_auth_permissions sp ON sp.code = oup.permission_code
  WHERE ep.user_id = p_user_id
    AND ep.tenant_org_id = p_tenant_id
    AND ep.permission_code = sp.code
    AND ep.resource_type IS NULL
    AND ep.resource_id IS NULL
    AND oup.user_id = p_user_id
    AND oup.tenant_org_id = p_tenant_id
    AND sp.is_active = true;

  INSERT INTO cmx_effective_permissions (
    user_id,
    tenant_org_id,
    permission_code,
    resource_type,
    resource_id,
    allow
  )
  SELECT
    p_user_id,
    p_tenant_id,
    sp.code,
    NULL::TEXT,
    NULL::UUID,
    oup.allow
  FROM org_auth_user_permissions oup
  JOIN sys_auth_permissions sp ON sp.code = oup.permission_code
  WHERE oup.user_id = p_user_id
    AND oup.tenant_org_id = p_tenant_id
    AND sp.is_active = true
    AND NOT EXISTS (
      SELECT 1
      FROM cmx_effective_permissions ep
      WHERE ep.user_id = p_user_id
        AND ep.tenant_org_id = p_tenant_id
        AND ep.permission_code = sp.code
        AND ep.resource_type IS NULL
        AND ep.resource_id IS NULL
    );

  -- 4) Resource-scoped permission overrides (most specific, wins)
  -- Use UPDATE first, then INSERT for new ones.
  UPDATE cmx_effective_permissions ep
  SET allow = ourp.allow,
      created_at = NOW()
  FROM org_auth_user_resource_permissions ourp
  JOIN sys_auth_permissions sp ON sp.code = ourp.permission_code
  WHERE ep.user_id = p_user_id
    AND ep.tenant_org_id = p_tenant_id
    AND ep.permission_code = sp.code
    AND ep.resource_type = ourp.resource_type
    AND ep.resource_id = ourp.resource_id
    AND ourp.user_id = p_user_id
    AND ourp.tenant_org_id = p_tenant_id
    AND sp.is_active = true;

  INSERT INTO cmx_effective_permissions (
    user_id,
    tenant_org_id,
    permission_code,
    resource_type,
    resource_id,
    allow
  )
  SELECT
    p_user_id,
    p_tenant_id,
    sp.code,
    ourp.resource_type,
    ourp.resource_id,
    ourp.allow
  FROM org_auth_user_resource_permissions ourp
  JOIN sys_auth_permissions sp ON sp.code = ourp.permission_code
  WHERE ourp.user_id = p_user_id
    AND ourp.tenant_org_id = p_tenant_id
    AND sp.is_active = true
    AND NOT EXISTS (
      SELECT 1
      FROM cmx_effective_permissions ep
      WHERE ep.user_id = p_user_id
        AND ep.tenant_org_id = p_tenant_id
        AND ep.permission_code = sp.code
        AND ep.resource_type = ourp.resource_type
        AND ep.resource_id = ourp.resource_id
    );
END;
$$;

COMMENT ON FUNCTION cmx_rebuild_user_permissions IS 'Rebuild effective permissions for a user-tenant combination; deduplicates tenant-wide role permissions before insert';
