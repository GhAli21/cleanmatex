-- 0036_rbac_rls_functions.sql — RBAC RLS Functions & Permission Checking
-- Purpose: Create permission checking functions, rebuild function, and automatic rebuild triggers
-- Author: CleanMateX Development Team
-- Created: 2025-01-XX
-- Dependencies: 0034_rbac_foundation.sql

BEGIN;

-- =========================
-- CORE PERMISSION REBUILD FUNCTION
-- =========================

-- Rebuild effective permissions for a user (called on changes)
-- Order of evaluation: broad → specific, last wins
CREATE OR REPLACE FUNCTION cmx_rebuild_user_permissions(
  p_user_id UUID,
  p_tenant_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Clear old effective permissions for this user-tenant combination
  DELETE FROM cmx_effective_permissions
  WHERE user_id = p_user_id
    AND tenant_org_id = p_tenant_id;

  -- 1) Tenant-level roles → permissions (broadest scope)
  INSERT INTO cmx_effective_permissions (
    user_id, tenant_org_id, permission_code,
    resource_type, resource_id, allow
  )
  SELECT
    p_user_id,
    p_tenant_id,
    sp.code,
    NULL::TEXT,                    -- NULL = tenant-wide
    NULL::UUID,                    -- NULL = tenant-wide
    true
  FROM org_auth_user_roles our
  JOIN sys_auth_role_default_permissions srdp ON srdp.role_id = our.role_id
  JOIN sys_auth_permissions sp ON sp.permission_id = srdp.permission_id
  WHERE our.user_id = p_user_id
    AND our.tenant_org_id = p_tenant_id
    AND our.is_active = true
    AND sp.is_active = true;

  -- 2) Resource-level roles → permissions (resource-scoped)
  INSERT INTO cmx_effective_permissions (
    user_id, tenant_org_id, permission_code,
    resource_type, resource_id, allow
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
  JOIN sys_auth_permissions sp ON sp.permission_id = srdp.permission_id
  WHERE urr.user_id = p_user_id
    AND urr.tenant_org_id = p_tenant_id
    AND urr.is_active = true
    AND sp.is_active = true
  ORDER BY p_user_id, p_tenant_id, sp.code, urr.resource_type, urr.resource_id;

  -- 3) Global user permission overrides (tenant-wide overrides)
  -- Use UPDATE first, then INSERT for new ones
  UPDATE cmx_effective_permissions ep
  SET allow = oup.allow,
      created_at = NOW()
  FROM org_auth_user_permissions oup
  JOIN sys_auth_permissions sp ON sp.permission_id = oup.permission_id
  WHERE ep.user_id = p_user_id
    AND ep.tenant_org_id = p_tenant_id
    AND ep.permission_code = sp.code
    AND ep.resource_type IS NULL
    AND ep.resource_id IS NULL
    AND oup.user_id = p_user_id
    AND oup.tenant_org_id = p_tenant_id
    AND sp.is_active = true;

  INSERT INTO cmx_effective_permissions (
    user_id, tenant_org_id, permission_code,
    resource_type, resource_id, allow
  )
  SELECT
    p_user_id,
    p_tenant_id,
    sp.code,
    NULL::TEXT,
    NULL::UUID,
    oup.allow
  FROM org_auth_user_permissions oup
  JOIN sys_auth_permissions sp ON sp.permission_id = oup.permission_id
  WHERE oup.user_id = p_user_id
    AND oup.tenant_org_id = p_tenant_id
    AND sp.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM cmx_effective_permissions ep
      WHERE ep.user_id = p_user_id
        AND ep.tenant_org_id = p_tenant_id
        AND ep.permission_code = sp.code
        AND ep.resource_type IS NULL
        AND ep.resource_id IS NULL
    );

  -- 4) Resource-scoped permission overrides (most specific, wins)
  -- Use UPDATE first, then INSERT for new ones
  UPDATE cmx_effective_permissions ep
  SET allow = ourp.allow,
      created_at = NOW()
  FROM org_auth_user_resource_permissions ourp
  JOIN sys_auth_permissions sp ON sp.permission_id = ourp.permission_id
  WHERE ep.user_id = p_user_id
    AND ep.tenant_org_id = p_tenant_id
    AND ep.permission_code = sp.code
    AND ep.resource_type = ourp.resource_type
    AND ep.resource_id = ourp.resource_id
    AND ourp.user_id = p_user_id
    AND ourp.tenant_org_id = p_tenant_id
    AND sp.is_active = true;

  INSERT INTO cmx_effective_permissions (
    user_id, tenant_org_id, permission_code,
    resource_type, resource_id, allow
  )
  SELECT
    p_user_id,
    p_tenant_id,
    sp.code,
    ourp.resource_type,
    ourp.resource_id,
    ourp.allow
  FROM org_auth_user_resource_permissions ourp
  JOIN sys_auth_permissions sp ON sp.permission_id = ourp.permission_id
  WHERE ourp.user_id = p_user_id
    AND ourp.tenant_org_id = p_tenant_id
    AND sp.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM cmx_effective_permissions ep
      WHERE ep.user_id = p_user_id
        AND ep.tenant_org_id = p_tenant_id
        AND ep.permission_code = sp.code
        AND ep.resource_type = ourp.resource_type
        AND ep.resource_id = ourp.resource_id
    );
END;
$$;

COMMENT ON FUNCTION cmx_rebuild_user_permissions IS 'Rebuild effective permissions for a user-tenant combination (called on role/permission changes)';

-- =========================
-- FAST PERMISSION CHECK FUNCTION (O(1) lookup)
-- =========================

-- Fast permission check for RLS (reads from effective_permissions table)
-- Uses indexed lookup for O(1) performance
/*
CREATE OR REPLACE FUNCTION cmx_can(
  p_perm TEXT,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM cmx_effective_permissions ep
    WHERE ep.user_id = auth.uid()
      AND ep.tenant_org_id = current_tenant_id()
      AND ep.permission_code = p_perm
      AND (
        -- Match tenant-wide permissions (resource_type IS NULL)
        (ep.resource_type IS NULL AND p_resource_type IS NULL)
        OR
        -- Match resource-scoped permissions
        (ep.resource_type = p_resource_type AND ep.resource_id = p_resource_id)
        OR
        -- Match tenant-wide permission when checking resource-scoped (fallback)
        (ep.resource_type IS NULL AND p_resource_type IS NOT NULL)
      )
      AND ep.allow = true
  );
$$;
*/
CREATE OR REPLACE FUNCTION cmx_can(
  p_perm TEXT,
  p_tenant_org_id UUID DEFAULT NULL,
  p_role_code TEXT DEFAULT NULL,
  p_is_user_id_org_or_auth INTEGER DEFAULT 2, -- 1=use p_org_user_id and org_users_mst.id, 2=use p_auth_user_id and org_users_mst.user_id
  p_auth_user_id UUID DEFAULT NULL,
  p_org_user_id UUID DEFAULT NULL,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    -- Check cmx_effective_permissions first (most common case, fastest lookup)
    (SELECT true
     FROM cmx_effective_permissions ep
     WHERE (
         ep.user_id = CASE 
           WHEN p_is_user_id_org_or_auth = 1 THEN (
             SELECT oum.user_id 
             FROM org_users_mst oum 
             WHERE oum.id = p_org_user_id 
               AND oum.tenant_org_id = COALESCE(p_tenant_org_id, current_tenant_id())
               AND oum.is_active = true
             LIMIT 1
           )
           ELSE COALESCE(p_auth_user_id, auth.uid())
         END
       )
       AND ep.tenant_org_id = COALESCE(p_tenant_org_id, current_tenant_id())
       AND ep.permission_code = p_perm
       AND (
         (ep.resource_type IS NULL AND p_resource_type IS NULL)
         OR
         (ep.resource_type = p_resource_type AND ep.resource_id = p_resource_id)
         OR
         (ep.resource_type IS NULL AND p_resource_type IS NOT NULL)
       )
       AND ep.allow = true
     LIMIT 1),
    -- Check sys_auth_role_default_permissions from org_users_mst.role (second check)
    (SELECT true
     FROM sys_auth_role_default_permissions rdp
     INNER JOIN org_users_mst oum
       ON oum.role = rdp.role_code
       AND (
         CASE 
           WHEN p_is_user_id_org_or_auth = 1 THEN oum.id = p_org_user_id
           ELSE oum.user_id = COALESCE(p_auth_user_id, auth.uid())
         END
       )
       AND oum.tenant_org_id = COALESCE(p_tenant_org_id, current_tenant_id())
       AND oum.is_active = true
     WHERE rdp.permission_code = p_perm
       AND rdp.is_active = true
       AND rdp.is_enabled = true
       AND (p_role_code IS NULL OR rdp.role_code = p_role_code)
     LIMIT 1),
    -- Check sys_auth_role_default_permissions from org_auth_user_roles (last check)
    (SELECT true
     FROM sys_auth_role_default_permissions rdp
     INNER JOIN org_auth_user_roles uar 
       ON uar.role_code = rdp.role_code
       AND (
         uar.user_id = CASE 
           WHEN p_is_user_id_org_or_auth = 1 THEN (
             SELECT oum.user_id 
             FROM org_users_mst oum 
             WHERE oum.id = p_org_user_id 
               AND oum.tenant_org_id = COALESCE(p_tenant_org_id, current_tenant_id())
               AND oum.is_active = true
             LIMIT 1
           )
           ELSE COALESCE(p_auth_user_id, auth.uid())
         END
       )
       AND uar.tenant_org_id = COALESCE(p_tenant_org_id, current_tenant_id())
       AND uar.is_active = true
     WHERE rdp.permission_code = p_perm
       AND rdp.is_active = true
       AND rdp.is_enabled = true
       AND (p_role_code IS NULL OR rdp.role_code = p_role_code)
     LIMIT 1),
    false  -- Default to false if none found
  );
$$;

COMMENT ON FUNCTION cmx_can IS 'Fast permission check using effective_permissions table (O(1) lookup for RLS)';

-- =========================
-- HELPER FUNCTIONS
-- =========================

-- Get all permissions for current user (tenant-wide and resource-scoped)
CREATE OR REPLACE FUNCTION get_user_permissions()
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
  WHERE ep.user_id = auth.uid()
    AND ep.tenant_org_id = current_tenant_id()
    AND ep.allow = true;
$$;

COMMENT ON FUNCTION get_user_permissions IS 'Get all permissions for current user (tenant-wide and resource-scoped)';
---- jh version
CREATE OR REPLACE FUNCTION get_user_permissions_jh(p_cur_user_id UUID DEFAULT NULL, p_cur_tenant_org_id UUID DEFAULT NULL)
RETURNS TABLE(permission_code TEXT, resource_type TEXT, resource_id UUID)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
--user_id, tenant_org_id, permission_code, resource_type, resource_id, allow
SELECT
    --our.user_id AS user_id,
    --our.tenant_id AS tenant_org_id,
    sp.code AS permission_code,
    NULL::TEXT AS resource_type,                    -- NULL = tenant-wide
    NULL::UUID AS resource_id                    -- NULL = tenant-wide
    --true AS allow
  FROM org_users_mst our
  JOIN sys_auth_role_default_permissions srdp ON srdp.role_code = our.role
  JOIN sys_auth_permissions sp ON sp.code = srdp.permission_code
  WHERE our.user_id =  COALESCE(p_cur_user_id, auth.uid())
    AND our.tenant_org_id = COALESCE(p_cur_tenant_org_id, current_tenant_id())
    AND our.is_active = true
    AND sp.is_active = true
  
  ;
/*
  SELECT DISTINCT
    ep.permission_code,
    ep.resource_type,
    ep.resource_id
  FROM cmx_effective_permissions ep
  WHERE ep.user_id = auth.uid()
    AND ep.tenant_org_id = current_tenant_id()
    AND ep.allow = true;
    */
$$;

---
CREATE OR REPLACE FUNCTION get_role_permissions_jh(p_role_code TEXT DEFAULT NULL)
RETURNS TABLE(permission_code TEXT, resource_type TEXT, resource_id UUID)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
SELECT
    sp.code AS permission_code,
    NULL::TEXT AS resource_type,                    -- NULL = tenant-wide
    NULL::UUID AS resource_id                    -- NULL = tenant-wide
    --true AS allow
  FROM sys_auth_role_default_permissions srdp
  JOIN sys_auth_permissions sp ON sp.code = srdp.permission_code
  WHERE lower(srdp.role_code) = lower(p_role_code)
    AND srdp.is_enabled = true
    AND srdp.is_active = true
    AND sp.is_active = true
  
  ;

$$;




-----------

-- Check if user has specific permission (tenant-wide)
CREATE OR REPLACE FUNCTION has_permission(p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT cmx_can(p_permission);
$$;

COMMENT ON FUNCTION has_permission IS 'Check if current user has specific permission (tenant-wide)';

-- Check resource-scoped permission
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
  SELECT cmx_can(p_permission, p_resource_type, p_resource_id);
$$;

COMMENT ON FUNCTION has_resource_permission IS 'Check if current user has resource-scoped permission';

-- Check multiple permissions (any)
CREATE OR REPLACE FUNCTION has_any_permission(p_permissions TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM unnest(p_permissions) AS perm
    WHERE cmx_can(perm, NULL, NULL)
  );
$$;

COMMENT ON FUNCTION has_any_permission IS 'Check if current user has any of the specified permissions';

-- Check multiple permissions (all)
CREATE OR REPLACE FUNCTION has_all_permissions(p_permissions TEXT[])
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT (
    SELECT COUNT(*) = array_length(p_permissions, 1)
    FROM unnest(p_permissions) AS perm
    WHERE cmx_can(perm, NULL, NULL)
  );
$$;

COMMENT ON FUNCTION has_all_permissions IS 'Check if current user has all of the specified permissions';

-- Get user roles
CREATE OR REPLACE FUNCTION get_user_roles()
RETURNS TABLE(role_id UUID, role_code TEXT, role_name TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT
    sr.role_id,
    sr.code AS role_code,
    sr.name AS role_name
  FROM org_auth_user_roles our
  JOIN sys_auth_roles sr ON sr.role_id = our.role_id
  WHERE our.user_id = auth.uid()
    AND our.tenant_org_id = current_tenant_id()
    AND our.is_active = true;
$$;

COMMENT ON FUNCTION get_user_roles IS 'Get all roles for current user in active tenant';

-- Get workflow roles (returns array for multi-role support)
CREATE OR REPLACE FUNCTION get_user_workflow_roles()
RETURNS TABLE(workflow_role TEXT)
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT
    uwr.workflow_role
  FROM org_auth_user_workflow_roles uwr
  WHERE uwr.user_id = auth.uid()
    AND uwr.tenant_org_id = current_tenant_id()
    AND uwr.is_active = true;
$$;

COMMENT ON FUNCTION get_user_workflow_roles IS 'Get all workflow roles for current user in active tenant (supports multiple workflow roles)';

-- Check if user has specific workflow role
CREATE OR REPLACE FUNCTION has_workflow_role(p_workflow_role TEXT)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM org_auth_user_workflow_roles uwr
    WHERE uwr.user_id = auth.uid()
      AND uwr.tenant_org_id = current_tenant_id()
      AND uwr.workflow_role = p_workflow_role
      AND uwr.is_active = true
  );
$$;

COMMENT ON FUNCTION has_workflow_role IS 'Check if current user has specific workflow role';

-- =========================
-- AUTOMATIC REBUILD TRIGGERS
-- =========================

-- Trigger function for org_auth_user_roles changes
CREATE OR REPLACE FUNCTION trg_cmx_rebuild_from_org_user_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM cmx_rebuild_user_permissions(OLD.user_id, OLD.tenant_org_id);
    RETURN OLD;
  ELSE
    PERFORM cmx_rebuild_user_permissions(NEW.user_id, NEW.tenant_org_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER cmx_rebuild_from_org_user_roles
AFTER INSERT OR UPDATE OR DELETE ON org_auth_user_roles
FOR EACH ROW
EXECUTE FUNCTION trg_cmx_rebuild_from_org_user_roles();

-- Trigger function for org_auth_user_resource_roles changes
CREATE OR REPLACE FUNCTION trg_cmx_rebuild_from_org_user_resource_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM cmx_rebuild_user_permissions(OLD.user_id, OLD.tenant_org_id);
    RETURN OLD;
  ELSE
    PERFORM cmx_rebuild_user_permissions(NEW.user_id, NEW.tenant_org_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER cmx_rebuild_from_org_user_resource_roles
AFTER INSERT OR UPDATE OR DELETE ON org_auth_user_resource_roles
FOR EACH ROW
EXECUTE FUNCTION trg_cmx_rebuild_from_org_user_resource_roles();

-- Trigger function for org_auth_user_permissions changes
CREATE OR REPLACE FUNCTION trg_cmx_rebuild_from_org_user_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM cmx_rebuild_user_permissions(OLD.user_id, OLD.tenant_org_id);
    RETURN OLD;
  ELSE
    PERFORM cmx_rebuild_user_permissions(NEW.user_id, NEW.tenant_org_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER cmx_rebuild_from_org_user_permissions
AFTER INSERT OR UPDATE OR DELETE ON org_auth_user_permissions
FOR EACH ROW
EXECUTE FUNCTION trg_cmx_rebuild_from_org_user_permissions();

-- Trigger function for org_auth_user_resource_permissions changes
CREATE OR REPLACE FUNCTION trg_cmx_rebuild_from_org_user_resource_permissions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM cmx_rebuild_user_permissions(OLD.user_id, OLD.tenant_org_id);
    RETURN OLD;
  ELSE
    PERFORM cmx_rebuild_user_permissions(NEW.user_id, NEW.tenant_org_id);
    RETURN NEW;
  END IF;
END;
$$;

CREATE TRIGGER cmx_rebuild_from_org_user_resource_permissions
AFTER INSERT OR UPDATE OR DELETE ON org_auth_user_resource_permissions
FOR EACH ROW
EXECUTE FUNCTION trg_cmx_rebuild_from_org_user_resource_permissions();

-- Note: Changes to sys_auth_role_default_permissions require manual rebuild
-- for all users with that role (can be done via scheduled job or admin API)

-- =========================
-- RLS POLICIES FOR RBAC TABLES
-- =========================

-- Enable RLS on RBAC tables
ALTER TABLE sys_auth_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_auth_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_auth_role_default_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_auth_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_auth_user_resource_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_auth_user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_auth_user_resource_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_auth_user_workflow_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cmx_effective_permissions ENABLE ROW LEVEL SECURITY;

-- sys_auth_permissions: Read-only for all authenticated users
CREATE POLICY sys_auth_permissions_select ON sys_auth_permissions
FOR SELECT
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- sys_auth_roles: Read-only for all authenticated users
CREATE POLICY sys_auth_roles_select ON sys_auth_roles
FOR SELECT
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- sys_auth_role_default_permissions: Read-only for all authenticated users
CREATE POLICY sys_auth_role_default_permissions_select ON sys_auth_role_default_permissions
FOR SELECT
USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- org_auth_user_roles: Users can view their own roles, admins can manage tenant users
CREATE POLICY org_auth_user_roles_select_own ON org_auth_user_roles
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY org_auth_user_roles_select_tenant ON org_auth_user_roles
FOR SELECT
USING (
  tenant_org_id = current_tenant_id()
  AND EXISTS (
    SELECT 1 FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role = 'admin'
      AND is_active = true
  )
);

CREATE POLICY org_auth_user_roles_insert_admin ON org_auth_user_roles
FOR INSERT
WITH CHECK (
  tenant_org_id = current_tenant_id()
  AND EXISTS (
    SELECT 1 FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role = 'admin'
      AND is_active = true
  )
);

CREATE POLICY org_auth_user_roles_update_admin ON org_auth_user_roles
FOR UPDATE
USING (
  tenant_org_id = current_tenant_id()
  AND EXISTS (
    SELECT 1 FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role = 'admin'
      AND is_active = true
  )
);

CREATE POLICY org_auth_user_roles_delete_admin ON org_auth_user_roles
FOR DELETE
USING (
  tenant_org_id = current_tenant_id()
  AND EXISTS (
    SELECT 1 FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role = 'admin'
      AND is_active = true
  )
);

-- org_auth_user_resource_roles: Similar policies as org_auth_user_roles
CREATE POLICY org_auth_user_resource_roles_select_own ON org_auth_user_resource_roles
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY org_auth_user_resource_roles_select_tenant ON org_auth_user_resource_roles
FOR SELECT
USING (
  tenant_org_id = current_tenant_id()
  AND EXISTS (
    SELECT 1 FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role = 'admin'
      AND is_active = true
  )
);

CREATE POLICY org_auth_user_resource_roles_insert_admin ON org_auth_user_resource_roles
FOR INSERT
WITH CHECK (
  tenant_org_id = current_tenant_id()
  AND EXISTS (
    SELECT 1 FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role = 'admin'
      AND is_active = true
  )
);

CREATE POLICY org_auth_user_resource_roles_update_admin ON org_auth_user_resource_roles
FOR UPDATE
USING (
  tenant_org_id = current_tenant_id()
  AND EXISTS (
    SELECT 1 FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role = 'admin'
      AND is_active = true
  )
);

CREATE POLICY org_auth_user_resource_roles_delete_admin ON org_auth_user_resource_roles
FOR DELETE
USING (
  tenant_org_id = current_tenant_id()
  AND EXISTS (
    SELECT 1 FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role = 'admin'
      AND is_active = true
  )
);

-- org_auth_user_permissions: Admin-only management
CREATE POLICY org_auth_user_permissions_select_tenant ON org_auth_user_permissions
FOR SELECT
USING (
  tenant_org_id = current_tenant_id()
  AND (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM org_users_mst
      WHERE user_id = auth.uid()
        AND tenant_org_id = current_tenant_id()
        AND role = 'admin'
        AND is_active = true
    )
  )
);

CREATE POLICY org_auth_user_permissions_insert_admin ON org_auth_user_permissions
FOR INSERT
WITH CHECK (
  tenant_org_id = current_tenant_id()
  AND EXISTS (
    SELECT 1 FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role = 'admin'
      AND is_active = true
  )
);

CREATE POLICY org_auth_user_permissions_update_admin ON org_auth_user_permissions
FOR UPDATE
USING (
  tenant_org_id = current_tenant_id()
  AND EXISTS (
    SELECT 1 FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role = 'admin'
      AND is_active = true
  )
);

CREATE POLICY org_auth_user_permissions_delete_admin ON org_auth_user_permissions
FOR DELETE
USING (
  tenant_org_id = current_tenant_id()
  AND EXISTS (
    SELECT 1 FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role = 'admin'
      AND is_active = true
  )
);

-- org_auth_user_resource_permissions: Admin-only management
CREATE POLICY org_auth_user_resource_permissions_select_tenant ON org_auth_user_resource_permissions
FOR SELECT
USING (
  tenant_org_id = current_tenant_id()
  AND (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM org_users_mst
      WHERE user_id = auth.uid()
        AND tenant_org_id = current_tenant_id()
        AND role = 'admin'
        AND is_active = true
    )
  )
);

CREATE POLICY org_auth_user_resource_permissions_insert_admin ON org_auth_user_resource_permissions
FOR INSERT
WITH CHECK (
  tenant_org_id = current_tenant_id()
  AND EXISTS (
    SELECT 1 FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role = 'admin'
      AND is_active = true
  )
);

CREATE POLICY org_auth_user_resource_permissions_update_admin ON org_auth_user_resource_permissions
FOR UPDATE
USING (
  tenant_org_id = current_tenant_id()
  AND EXISTS (
    SELECT 1 FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role = 'admin'
      AND is_active = true
  )
);

CREATE POLICY org_auth_user_resource_permissions_delete_admin ON org_auth_user_resource_permissions
FOR DELETE
USING (
  tenant_org_id = current_tenant_id()
  AND EXISTS (
    SELECT 1 FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role = 'admin'
      AND is_active = true
  )
);

-- org_auth_user_workflow_roles: Users can view their own, admins can manage
CREATE POLICY org_auth_user_workflow_roles_select_own ON org_auth_user_workflow_roles
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY org_auth_user_workflow_roles_select_tenant ON org_auth_user_workflow_roles
FOR SELECT
USING (
  tenant_org_id = current_tenant_id()
  AND EXISTS (
    SELECT 1 FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role = 'admin'
      AND is_active = true
  )
);

CREATE POLICY org_auth_user_workflow_roles_insert_admin ON org_auth_user_workflow_roles
FOR INSERT
WITH CHECK (
  tenant_org_id = current_tenant_id()
  AND EXISTS (
    SELECT 1 FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role = 'admin'
      AND is_active = true
  )
);

CREATE POLICY org_auth_user_workflow_roles_update_admin ON org_auth_user_workflow_roles
FOR UPDATE
USING (
  tenant_org_id = current_tenant_id()
  AND EXISTS (
    SELECT 1 FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role = 'admin'
      AND is_active = true
  )
);

CREATE POLICY org_auth_user_workflow_roles_delete_admin ON org_auth_user_workflow_roles
FOR DELETE
USING (
  tenant_org_id = current_tenant_id()
  AND EXISTS (
    SELECT 1 FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role = 'admin'
      AND is_active = true
  )
);

-- cmx_effective_permissions: Read-only for users (computed by system)
CREATE POLICY cmx_effective_permissions_select_own ON cmx_effective_permissions
FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY cmx_effective_permissions_select_tenant ON cmx_effective_permissions
FOR SELECT
USING (
  tenant_org_id = current_tenant_id()
  AND EXISTS (
    SELECT 1 FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role = 'admin'
      AND is_active = true
  )
);

-- Service role has full access to all RBAC tables
CREATE POLICY service_role_rbac_full_access ON sys_auth_permissions
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY service_role_rbac_roles_full_access ON sys_auth_roles
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY service_role_rbac_role_perms_full_access ON sys_auth_role_default_permissions
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY service_role_org_user_roles_full_access ON org_auth_user_roles
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY service_role_org_user_resource_roles_full_access ON org_auth_user_resource_roles
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY service_role_org_user_perms_full_access ON org_auth_user_permissions
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY service_role_org_user_resource_perms_full_access ON org_auth_user_resource_permissions
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY service_role_org_user_workflow_roles_full_access ON org_auth_user_workflow_roles
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY service_role_cmx_effective_perms_full_access ON cmx_effective_permissions
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- =========================
-- VALIDATION
-- =========================

DO $$
BEGIN
  -- Verify functions were created
  ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname = 'cmx_rebuild_user_permissions') > 0,
    'cmx_rebuild_user_permissions function not created';
  ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname = 'cmx_can') > 0,
    'cmx_can function not created';
  ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname = 'get_user_permissions') > 0,
    'get_user_permissions function not created';
  ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname = 'has_permission') > 0,
    'has_permission function not created';
  ASSERT (SELECT COUNT(*) FROM pg_proc WHERE proname = 'get_user_workflow_roles') > 0,
    'get_user_workflow_roles function not created';

  -- Verify triggers were created
  ASSERT (SELECT COUNT(*) FROM pg_trigger WHERE tgname = 'cmx_rebuild_from_org_user_roles') > 0,
    'cmx_rebuild_from_org_user_roles trigger not created';

  -- Verify RLS is enabled
  ASSERT (SELECT relrowsecurity FROM pg_class WHERE relname = 'org_auth_user_roles') = true,
    'RLS not enabled on org_auth_user_roles';

  RAISE NOTICE '✅ RBAC RLS functions and triggers created successfully';
END $$;

COMMIT;

