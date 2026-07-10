-- Fix cmx_can() to use the code-based RBAC schema for the admin bypass path.
--
-- Why:
-- - The RBAC schema migrated from UUID role_id references to string role_code/code.
-- - Some environments still execute a compiled cmx_can() body that joins through
--   removed role_id columns, which raises 42703 at runtime.
-- - A later migration also introduced an invalid sys_auth_roles.role_code reference.
--
-- Scope:
-- - Function-only migration
-- - No table, index, trigger, or RLS changes

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
  -- Resolve the auth user id for either org-user or auth-user callers.
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

  -- Preserve the explicit tenant-wide admin bypass without depending on removed role_id columns.
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
    WHERE uar.user_id = v_user_id
      AND uar.tenant_org_id = v_tenant_id
      AND uar.role_code IN ('super_admin', 'tenant_admin')
      AND uar.is_active = true
  ) THEN
    RETURN true;
  END IF;

  -- Exact resource scope wins; tenant-wide rows are the fallback for the same permission.
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

  -- Apply the same scope precedence for the global wildcard permission.
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

COMMENT ON FUNCTION cmx_can IS 'Authoritative RBAC permission check using effective permissions with code-based admin bypass and exact-scope-first precedence';
