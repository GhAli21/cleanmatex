-- 0146_cmx_fix_admin_role_permissions.sql
-- Purpose: Add function to fix missing admin role permissions (super_admin, tenant_admin)
-- Inserts all permissions from sys_auth_permissions that are not yet in sys_auth_role_default_permissions
-- Used by Tenant Maintenance feature in platform HQ
-- Date: 2026-03-12

BEGIN;

-- Create function to fix admin role permissions
-- Returns: inserted_count, updated_count, inserted_permissions (jsonb array), updated_permissions (jsonb array)
CREATE OR REPLACE FUNCTION public.cmx_fix_admin_role_permissions()
RETURNS TABLE(
  inserted_count bigint,
  updated_count bigint,
  inserted_permissions jsonb,
  updated_permissions jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_inserted_count bigint := 0;
  v_updated_count bigint := 0;
  v_inserted_permissions jsonb := '[]'::jsonb;
  v_updated_permissions jsonb := '[]'::jsonb;
BEGIN
  -- Insert missing permissions and capture what was inserted
  WITH to_insert AS (
    SELECT
      r.role_code,
      p.code AS permission_code
    FROM (SELECT unnest(ARRAY['super_admin', 'tenant_admin']) AS role_code) r
    CROSS JOIN sys_auth_permissions p
    WHERE p.is_active = true
      AND NOT EXISTS (
        SELECT 1
        FROM sys_auth_role_default_permissions rd
        WHERE rd.role_code = r.role_code
          AND rd.permission_code = p.code
      )
  ),
  inserted AS (
    INSERT INTO sys_auth_role_default_permissions (
      role_code,
      permission_code,
      is_enabled,
      is_active,
      rec_status,
      created_at,
      created_by
    )
    SELECT
      ti.role_code,
      ti.permission_code,
      true,
      true,
      1,
      CURRENT_TIMESTAMP,
      'tenant_maintenance'
    FROM to_insert ti
    ON CONFLICT (role_code, permission_code) DO NOTHING
    RETURNING role_code, permission_code
  )
  SELECT
    COUNT(*)::bigint,
    COALESCE(jsonb_agg(jsonb_build_object('role_code', role_code, 'permission_code', permission_code)), '[]'::jsonb)
  INTO v_inserted_count, v_inserted_permissions
  FROM inserted;

  -- updated_count and updated_permissions are 0/empty for now (ON CONFLICT DO NOTHING does not update)
  v_updated_count := 0;
  v_updated_permissions := '[]'::jsonb;

  RETURN QUERY SELECT
    v_inserted_count,
    v_updated_count,
    v_inserted_permissions,
    v_updated_permissions;
END;
$$;

COMMENT ON FUNCTION public.cmx_fix_admin_role_permissions() IS 'Insert missing permissions into sys_auth_role_default_permissions for super_admin and tenant_admin roles. Returns inserted_count, updated_count, inserted_permissions (array of {role_code, permission_code}), updated_permissions.';

-- Grant execute to service role and authenticated
GRANT EXECUTE ON FUNCTION public.cmx_fix_admin_role_permissions() TO service_role;
GRANT EXECUTE ON FUNCTION public.cmx_fix_admin_role_permissions() TO authenticated;

COMMIT;
