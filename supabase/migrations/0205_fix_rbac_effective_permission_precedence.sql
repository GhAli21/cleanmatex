-- Harden RBAC effective-permission rebuild and evaluation.
--
-- Fixes:
-- 1) Deduplicate tenant-wide role permissions during rebuild.
-- 2) Respect sys_auth_role_default_permissions.is_active / is_enabled during rebuild.
-- 3) Make global user overrides override role-derived permissions across all scopes.
-- 4) Make resource-scoped overrides win over broader rules.
-- 5) Make cmx_can() use the effective-permissions cache as the authoritative source,
--    preserving deny precedence instead of re-granting access through raw role fallback.
--
-- Scope:
-- - Function-only migration
-- - No table/index/RLS/trigger changes

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
  JOIN sys_auth_role_default_permissions srdp ON srdp.role_id = our.role_id
  JOIN sys_auth_permissions sp ON sp.code = srdp.permission_code
  WHERE our.user_id = p_user_id
    AND our.tenant_org_id = p_tenant_id
    AND our.is_active = true
    AND srdp.is_active = true
    AND srdp.is_enabled = true
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
  JOIN sys_auth_role_default_permissions srdp ON srdp.role_id = urr.role_id
  JOIN sys_auth_permissions sp ON sp.code = srdp.permission_code
  WHERE urr.user_id = p_user_id
    AND urr.tenant_org_id = p_tenant_id
    AND urr.is_active = true
    AND srdp.is_active = true
    AND srdp.is_enabled = true
    AND sp.is_active = true
  ORDER BY p_user_id, p_tenant_id, sp.code, urr.resource_type, urr.resource_id;

  -- 3) Global user permission overrides (tenant-wide overrides)
  -- Apply to all existing rows for the permission so global overrides truly override
  -- role-derived permissions across tenant-wide and resource-scoped entries.
  UPDATE cmx_effective_permissions ep
  SET allow = oup.allow,
      created_at = NOW()
  FROM org_auth_user_permissions oup
  JOIN sys_auth_permissions sp ON sp.code = oup.permission_code
  WHERE ep.user_id = p_user_id
    AND ep.tenant_org_id = p_tenant_id
    AND ep.permission_code = sp.code
    AND oup.user_id = p_user_id
    AND oup.tenant_org_id = p_tenant_id
    AND sp.is_active = true;

  -- Ensure there is always a tenant-wide row for a global override, even when no role granted it.
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
  -- Update exact-scope rows first, then insert missing exact-scope rows.
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

COMMENT ON FUNCTION cmx_rebuild_user_permissions IS 'Rebuild effective permissions for a user-tenant combination with deduped role grants and correct override precedence';

CREATE OR REPLACE FUNCTION cmx_can(
  p_perm TEXT,
  p_tenant_org_id UUID DEFAULT NULL,
  p_role_code TEXT DEFAULT NULL,
  p_is_user_id_org_or_auth INTEGER DEFAULT 2,
  p_auth_user_id UUID DEFAULT NULL,
  p_org_user_id UUID DEFAULT NULL,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_tenant_id UUID;
  v_effective_allow BOOLEAN;
BEGIN
  -- Resolve user_id.
  IF p_is_user_id_org_or_auth = 1 THEN
    SELECT oum.user_id INTO v_user_id
    FROM org_users_mst oum
    WHERE oum.id = p_org_user_id
      AND oum.tenant_org_id = COALESCE(p_tenant_org_id, current_tenant_id())
      AND oum.is_active = true
    LIMIT 1;
  ELSE
    v_user_id := COALESCE(p_auth_user_id, auth.uid());
  END IF;

  v_tenant_id := COALESCE(p_tenant_org_id, current_tenant_id());

  -- Preserve the explicit tenant admin / super admin bypass.
  IF EXISTS (
    SELECT 1
    FROM org_users_mst oum
    WHERE oum.user_id = v_user_id
      AND oum.tenant_org_id = v_tenant_id
      AND oum.role IN ('super_admin', 'tenant_admin')
      AND oum.is_active = true
  ) OR EXISTS (
    SELECT 1
    FROM org_auth_user_roles uar
    JOIN sys_auth_roles sr ON sr.role_id = uar.role_id
    WHERE uar.user_id = v_user_id
      AND uar.tenant_org_id = v_tenant_id
      AND sr.code IN ('super_admin', 'tenant_admin')
      AND uar.is_active = true
  ) THEN
    RETURN true;
  END IF;

  -- 1) Exact permission resolution: exact resource match first, then tenant-wide fallback.
  SELECT ep.allow
  INTO v_effective_allow
  FROM cmx_effective_permissions ep
  WHERE ep.user_id = v_user_id
    AND ep.tenant_org_id = v_tenant_id
    AND ep.permission_code = p_perm
    AND (
      (p_resource_type IS NULL AND ep.resource_type IS NULL AND ep.resource_id IS NULL)
      OR
      (p_resource_type IS NOT NULL AND ep.resource_type = p_resource_type AND ep.resource_id = p_resource_id)
      OR
      (p_resource_type IS NOT NULL AND ep.resource_type IS NULL AND ep.resource_id IS NULL)
    )
  ORDER BY CASE
    WHEN p_resource_type IS NOT NULL
      AND ep.resource_type = p_resource_type
      AND ep.resource_id = p_resource_id THEN 0
    ELSE 1
  END
  LIMIT 1;

  IF FOUND THEN
    RETURN COALESCE(v_effective_allow, false);
  END IF;

  -- 2) Wildcard fallback with the same precedence rules.
  SELECT ep.allow
  INTO v_effective_allow
  FROM cmx_effective_permissions ep
  WHERE ep.user_id = v_user_id
    AND ep.tenant_org_id = v_tenant_id
    AND ep.permission_code = '*:*'
    AND (
      (p_resource_type IS NULL AND ep.resource_type IS NULL AND ep.resource_id IS NULL)
      OR
      (p_resource_type IS NOT NULL AND ep.resource_type = p_resource_type AND ep.resource_id = p_resource_id)
      OR
      (p_resource_type IS NOT NULL AND ep.resource_type IS NULL AND ep.resource_id IS NULL)
    )
  ORDER BY CASE
    WHEN p_resource_type IS NOT NULL
      AND ep.resource_type = p_resource_type
      AND ep.resource_id = p_resource_id THEN 0
    ELSE 1
  END
  LIMIT 1;

  IF FOUND THEN
    RETURN COALESCE(v_effective_allow, false);
  END IF;

  RETURN false;
END;
$$;

COMMENT ON FUNCTION cmx_can IS 'Authoritative RBAC permission check using effective permissions with exact-scope-first precedence and deny-safe evaluation';
